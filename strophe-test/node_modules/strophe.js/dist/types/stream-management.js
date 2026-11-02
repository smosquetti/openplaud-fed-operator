/**
 * XEP-0198 Stream Management
 *
 * This module holds all SM state and logic (counters, the unacked queue, the
 * enable/resume lifecycle) and never touches a DOM Element or a raw websocket
 * frame, so the same class can be hosted by a page-side Connection or inside a
 * SharedWorker. Everything it needs from a stanza is captured in a minimal
 * {@link StanzaView}, produced by whichever side hosts it. Nonzas are emitted
 * as strings through the injected `sendRaw` function.
 *
 * IMPORTANT: this module must be loadable in a SharedWorker global (it is
 * bundled into dist/shared-connection-worker.js), so keep it free of imports
 * beyond log/constants — in particular no utils.ts or builder.ts, and no
 * module-level DOM access. Functions that touch the DOM (toStanzaView) are
 * only ever *called* on the page.
 */
import log from './log';
import { NS } from './constants';
/**
 * Escapes invalid xml characters (duplicated from utils.ts so the worker
 * bundle doesn't pull in utils and its dependencies).
 * @param text
 */
function xmlEscape(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/'/g, '&apos;')
        .replace(/"/g, '&quot;');
}
/** The 'h' counter is an unsignedInt that wraps back to zero (XEP-0198 §4). */
const H_WRAP = 2 ** 32;
/** Stanza names that count towards the 'h' counters (XEP-0198 §4). */
const COUNTABLE = ['iq', 'presence', 'message'];
/** SM nonza names in the urn:xmpp:sm:3 namespace. */
const NONZAS = ['r', 'a', 'enabled', 'resumed', 'failed'];
/**
 * @returns A fresh, inactive SM state object.
 */
function freshState() {
    return {
        boundJid: null,
        enableSent: false,
        enabled: false,
        hIn: 0,
        hOutAcked: 0,
        id: null,
        location: null,
        max: null,
        resumeSupported: false,
        resumed: false,
        sinceLastAck: 0,
        unacked: [],
    };
}
/**
 * Parse an 'h' attribute value into a wrapped unsigned 32-bit counter value.
 * @param value - The attribute value (may be undefined).
 * @returns The parsed value, or null if missing or invalid.
 */
function parseH(value) {
    if (typeof value !== 'string')
        return null;
    const h = parseInt(value, 10);
    return Number.isNaN(h) || h < 0 ? null : h % H_WRAP;
}
/**
 * @param name - A top-level element's local tag name.
 * @returns true if the element counts towards the SM 'h' counters.
 */
export function isCountableStanza(name) {
    return COUNTABLE.includes(name);
}
/**
 * Insert a XEP-0203 <delay/> child into a serialized stanza (DOM-free string
 * surgery). Used when re-sending salvaged stanzas after a failed resumption,
 * so the receiving client can show the original send time.
 * @param serialized - The serialized stanza.
 * @param name - The stanza's local tag name.
 * @param queuedAt - The original queueing time (ms since epoch).
 * @returns The stanza with a <delay/> child, or the unmodified input if it
 *     already carries one (or is malformed).
 */
export function stampDelay(serialized, name, queuedAt) {
    if (serialized.includes(NS.DELAY)) {
        return serialized;
    }
    const delay = `<delay xmlns="${NS.DELAY}" stamp="${new Date(queuedAt).toISOString()}"/>`;
    if (serialized.endsWith('/>')) {
        return `${serialized.slice(0, -2)}>${delay}</${name}>`;
    }
    const idx = serialized.lastIndexOf(`</${name}`);
    if (idx === -1) {
        return serialized;
    }
    return serialized.slice(0, idx) + delay + serialized.slice(idx);
}
/**
 * Build the environment-free {@link StanzaView} consumed by the XEP-0198
 * engine from a DOM Element. This is the page-adapter side of the
 * core/adapter split — the worker adapter builds the same view from a raw
 * frame string (see sm-parse.ts). It lives here (rather than in utils.ts) to
 * keep the worker bundle free of utils and its dependencies: XMLSerializer
 * is a DOM global, but this function is only ever called on the page.
 * @param el
 */
export function toStanzaView(el) {
    const attrs = {};
    for (let i = 0; i < el.attributes.length; i++) {
        const attr = el.attributes[i];
        attrs[attr.name] = attr.value;
    }
    return { name: el.tagName, attrs, serialized: new XMLSerializer().serializeToString(el) };
}
/**
 * In-memory storage backend (Node, tests, or non-resumable setups).
 * State is serialized on save so callers can't mutate stored state by reference.
 */
export class MemoryStorageBackend {
    constructor() {
        this.store = new Map();
    }
    /**
     * @param key
     */
    load(key) {
        const stored = this.store.get(key);
        return stored ? JSON.parse(stored) : null;
    }
    /**
     * @param key
     * @param state
     */
    save(key, state) {
        this.store.set(key, JSON.stringify(state));
    }
    /**
     * @param key
     */
    clear(key) {
        this.store.delete(key);
    }
}
/**
 * sessionStorage-backed storage backend (browser pages).
 * Survives page reloads within a tab, which is exactly the resumption window.
 */
export class SessionStorageBackend {
    constructor() {
        if (typeof sessionStorage === 'undefined') {
            throw new Error('SessionStorageBackend requires a sessionStorage global (browser page context)');
        }
    }
    /**
     * @param key
     */
    load(key) {
        const stored = sessionStorage.getItem(key);
        if (!stored)
            return null;
        try {
            return JSON.parse(stored);
        }
        catch (e) {
            log.warn(`Discarding unparseable SM state for ${key}: ${e.message}`);
            return null;
        }
    }
    /**
     * @param key
     * @param state
     */
    save(key, state) {
        sessionStorage.setItem(key, JSON.stringify(state));
    }
    /**
     * @param key
     */
    clear(key) {
        sessionStorage.removeItem(key);
    }
}
/**
 * The XEP-0198 Stream Management engine.
 *
 * Hosted by {@link Connection} (page) or by the shared-connection worker; fed
 * {@link StanzaView}s by a thin per-environment adapter. Emits nonzas through
 * the injected `sendRaw` function — on the page that appends to the
 * connection's send queue (never a direct socket write, to preserve stanza
 * ordering), in the worker it writes to the socket.
 */
class StreamManagement {
    /**
     * @param sendRaw - Emits a serialized nonza (or re-sent stanza) towards the server.
     * @param options
     */
    constructor(sendRaw, options = {}) {
        this._sendRaw = sendRaw;
        this._options = Object.assign({ maxUnacked: 5, requestResume: true }, options);
        this._storage = this._options.storage || new MemoryStorageBackend();
        this._storageKey = null;
        this._state = freshState();
        this._pendingResend = [];
        this.serverSupported = false;
    }
    /** The live SM state. Treat as read-only outside of tests. */
    get state() {
        return this._state;
    }
    /** Whether <enabled/> has been received and the SM session is active. */
    get enabled() {
        return this._state.enabled;
    }
    /** Whether the current session was established by resumption. */
    get resumed() {
        return this._state.resumed;
    }
    /** The full JID bound when the SM session was enabled. */
    get boundJid() {
        return this._state.boundJid;
    }
    /**
     * Set the storage key (from the user's bare JID) and load any persisted
     * resumable state. Call before deciding between resume and fresh bind.
     * @param jid - The user's JID (a full JID is reduced to its bare form).
     */
    initialize(jid) {
        this._storageKey = `strophe-sm:${jid.split('/')[0].toLowerCase()}`;
        const stored = this._storage.load(this._storageKey);
        if (stored) {
            this._state = Object.assign(Object.assign({}, freshState()), stored);
        }
    }
    /**
     * @returns true if persisted state allows attempting <resume/>.
     */
    hasResumableState() {
        return !!(this._state.id && this._state.resumeSupported);
    }
    /**
     * Reset the in-memory engine (e.g. from Connection.reset()).
     * Persisted state is NOT touched — clearing storage is tied to intent
     * (clean close, logout, failed resume), not to connection reuse.
     */
    reset() {
        this._state = freshState();
        this._pendingResend = [];
        this.serverSupported = false;
    }
    /** Remove persisted state (clean close, logout, failed resume). */
    clearPersistedState() {
        if (this._storageKey) {
            this._storage.clear(this._storageKey);
        }
    }
    /**
     * Send <enable/> to start a new SM session. Call after resource binding,
     * at the point CONNECTED is emitted. At most one <enable/> is sent per
     * stream — a second attempt SHOULD get the stream killed by the server
     * (XEP-0198 §3).
     * @param boundJid - The full JID that was just bound.
     */
    sendEnable(boundJid) {
        const s = this._state;
        if (s.enableSent) {
            log.warn('StreamManagement.sendEnable called but <enable/> was already sent for this session');
            return;
        }
        s.enableSent = true;
        s.enabled = false;
        s.resumed = false;
        s.id = null;
        s.max = null;
        s.location = null;
        s.resumeSupported = false;
        s.hIn = 0;
        s.hOutAcked = 0;
        s.sinceLastAck = 0;
        s.unacked = [];
        s.boundJid = boundJid;
        const resume = this._options.requestResume ? ' resume="true"' : '';
        const max = this._options.max ? ` max="${this._options.max}"` : '';
        this._sendRaw(`<enable xmlns="${NS.SM}"${resume}${max}/>`);
        this._persist();
    }
    /**
     * Send <resume/> for the persisted previous session. Call instead of
     * binding, once the post-SASL stream features advertise SM support.
     */
    sendResume() {
        const s = this._state;
        if (!this.hasResumableState()) {
            log.warn('StreamManagement.sendResume called without resumable state');
            return;
        }
        this._sendRaw(`<resume xmlns="${NS.SM}" h="${s.hIn}" previd="${xmlEscape(s.id)}"/>`);
    }
    /**
     * Track an outbound top-level element. Called for every element that
     * enters the send queue; non-countable elements are ignored here.
     * Active from the moment <enable/> is sent (not from <enabled/> receipt —
     * XEP-0198 starts the outbound counter at enable-send).
     * @param view
     */
    trackOutbound(view) {
        const s = this._state;
        if (!s.enableSent || !isCountableStanza(view.name)) {
            return;
        }
        s.unacked.push({ name: view.name, stanza: view.serialized, queuedAt: Date.now() });
        s.sinceLastAck += 1;
        const max = this._options.maxUnacked;
        if (max > 0 && s.sinceLastAck % max === 0) {
            this.requestAck();
        }
        this._persist();
    }
    /**
     * Process an inbound top-level element.
     * @param view
     * @returns true if the element was an SM nonza (consumed by the engine),
     *     false if it's a regular stanza (counted here when the session is
     *     enabled, but still to be dispatched to handlers by the caller).
     */
    onInbound(view) {
        if (isCountableStanza(view.name)) {
            this.onInboundStanza(view.name);
            return false;
        }
        switch (view.name) {
            case 'r':
                if (this._state.enabled)
                    this.sendAck();
                return true;
            case 'a':
                this._handleAck(view);
                return true;
            case 'enabled':
                this._handleEnabled(view);
                return true;
            case 'resumed':
                this._handleResumed(view);
                return true;
            case 'failed':
                this._handleFailed(view);
                return true;
            default:
                return false;
        }
    }
    /**
     * @param name - A top-level element's local tag name.
     * @returns true if the element is an SM nonza.
     */
    isNonza(name) {
        return NONZAS.includes(name);
    }
    /** Send an unrequested ack request <r/> to the server. */
    requestAck() {
        this._sendRaw(`<r xmlns="${NS.SM}"/>`);
    }
    /**
     * Send an ack <a/> with the current inbound count. Used to answer <r/>,
     * and RECOMMENDED right before gracefully closing the stream (XEP-0198 §4)
     * so the server doesn't redeliver stanzas that were actually received.
     */
    sendAck() {
        this._sendRaw(`<a xmlns="${NS.SM}" h="${this._state.hIn}"/>`);
    }
    /**
     * Count an inbound top-level stanza by name. Adapters call this from
     * their dispatch loop for every inbound child element — non-countable
     * names and inactive sessions are no-ops, so no StanzaView needs to be
     * built for the common case.
     * @param name - The element's local tag name.
     */
    onInboundStanza(name) {
        if (this._state.enabled && isCountableStanza(name)) {
            this._state.hIn = (this._state.hIn + 1) % H_WRAP;
            this._persist();
        }
    }
    /**
     * Call when the stream is about to be closed cleanly: sends a final
     * <a/> so the server doesn't redeliver stanzas that were actually
     * received (RECOMMENDED, XEP-0198 §4), clears persisted state (a
     * cleanly closed stream is not resumable, XEP-0198 §Stream Closure) and
     * deactivates the engine, so nothing sent during teardown is tracked or
     * re-persisted.
     */
    onGracefulClose() {
        if (this._state.enabled) {
            this.sendAck();
        }
        this.clearPersistedState();
        this._state = freshState();
        this._pendingResend = [];
    }
    /** Overridable event hook: an SM session was established via <enabled/>. */
    onEnabled() {
        return;
    }
    /** Overridable event hook: the previous session was resumed via <resumed/>. */
    onResumed() {
        return;
    }
    /**
     * Overridable event hook: <enable/> or <resume/> failed.
     * @param _view - The <failed/> nonza (inspect e.g. for <item-not-found/>).
     */
    onFailed(_view) {
        return;
    }
    /**
     * Reconcile the server-reported 'h' against the unacked queue (mod 2^32).
     * An 'h' above our send count is logged and clamped rather than answered
     * with the spec's <handled-count-too-high/> stream close — a client
     * killing the stream over a server bug only hurts the user.
     * @param h
     */
    _reconcile(h) {
        const s = this._state;
        let delta = (h - s.hOutAcked + H_WRAP) % H_WRAP;
        if (delta > s.unacked.length) {
            log.error(`StreamManagement: server acked ${delta} stanzas but only ` +
                `${s.unacked.length} are unacknowledged (h=${h}, previous h=${s.hOutAcked})`);
            delta = s.unacked.length;
        }
        s.unacked = s.unacked.slice(delta);
        s.hOutAcked = h;
    }
    /**
     * @param view
     */
    _handleAck(view) {
        const s = this._state;
        if (!s.enableSent && !s.enabled) {
            return;
        }
        const h = parseH(view.attrs.h);
        if (h === null) {
            log.error('StreamManagement: received <a/> without a valid h attribute');
            return;
        }
        this._reconcile(h);
        s.sinceLastAck = 0;
        this._persist();
    }
    /**
     * @param view
     */
    _handleEnabled(view) {
        const s = this._state;
        if (!s.enableSent) {
            log.warn('StreamManagement: received <enabled/> but <enable/> was not sent; ignoring');
            return;
        }
        s.enabled = true;
        s.id = view.attrs.id || null;
        const max = parseInt(view.attrs.max, 10);
        s.max = Number.isNaN(max) ? null : max;
        s.location = view.attrs.location || null;
        s.resumeSupported = ['true', '1'].includes(view.attrs.resume);
        this._resendPending();
        this._persist();
        this.onEnabled();
    }
    /**
     * @param view
     */
    _handleResumed(view) {
        const s = this._state;
        if (!s.id) {
            log.warn('StreamManagement: received <resumed/> without resumable state; ignoring');
            return;
        }
        s.resumed = true;
        s.enabled = true;
        s.enableSent = true;
        const h = parseH(view.attrs.h);
        if (h !== null) {
            this._reconcile(h);
        }
        s.sinceLastAck = 0;
        // Re-send whatever the server didn't acknowledge (a MUST, XEP-0198
        // §5). The entries stay in `unacked` — they're still unacknowledged —
        // and are not re-tracked.
        for (const entry of s.unacked) {
            this._sendRaw(entry.stanza);
        }
        if (s.unacked.length) {
            this.requestAck();
        }
        this._persist();
        this.onResumed();
    }
    /**
     * <enable/> or <resume/> failed. Trim the queue by the optional 'h' on
     * <failed/>, salvage the remainder for re-send once a fresh session
     * reaches <enabled/> (a SHOULD, XEP-0198 §4), reset the dead session and
     * clear its persisted state.
     * @param view
     */
    _handleFailed(view) {
        const s = this._state;
        if (!s.enableSent && !s.id) {
            return;
        }
        const h = parseH(view.attrs.h);
        if (h !== null) {
            this._reconcile(h);
        }
        this._pendingResend = this._pendingResend.concat(s.unacked);
        this._state = freshState();
        this.clearPersistedState();
        this.onFailed(view);
    }
    /**
     * Re-send stanzas salvaged from a failed resumption on the freshly
     * enabled session. Messages are stamped with a XEP-0203 <delay/> carrying
     * their original send time. The re-sent stanzas enter the new session's
     * unacked queue in wire order.
     */
    _resendPending() {
        const pending = this._pendingResend;
        if (!pending.length) {
            return;
        }
        this._pendingResend = [];
        const s = this._state;
        for (const entry of pending) {
            const stanza = entry.name === 'message' ? stampDelay(entry.stanza, entry.name, entry.queuedAt) : entry.stanza;
            this._sendRaw(stanza);
            s.unacked.push(Object.assign(Object.assign({}, entry), { stanza }));
            s.sinceLastAck += 1;
        }
        this.requestAck();
    }
    /** Persist the current state, if a storage key has been configured. */
    _persist() {
        if (this._storageKey) {
            this._storage.save(this._storageKey, this._state);
        }
    }
}
/**
 * A page-side stand-in for the worker-resident engine: when the connection
 * runs through a SharedWorker, the worker owns all counting, queueing and
 * nonza handling, and the page only mirrors the session state so that
 * `Connection.hasResumed()` and friends keep working. Every engine action is
 * overridden as a no-op — double-counting is structurally impossible — and
 * the state is updated exclusively from the worker's
 * `_smEnabled`/`_smResumed`/`_smFailed` messages (see WorkerWebsocket).
 */
export class StreamManagementMirror extends StreamManagement {
    constructor() {
        super(() => { });
    }
    /* Inert overrides — the worker owns these responsibilities. */
    initialize(_jid) {
        return;
    }
    hasResumableState() {
        return false;
    }
    sendEnable(_boundJid) {
        return;
    }
    sendResume() {
        return;
    }
    requestAck() {
        return;
    }
    sendAck() {
        return;
    }
    trackOutbound(_view) {
        return;
    }
    onInbound(_view) {
        return false;
    }
    onInboundStanza(_name) {
        return;
    }
    onGracefulClose() {
        return;
    }
    clearPersistedState() {
        return;
    }
    /* Mirror updates, driven by the worker's lifecycle messages. */
    /**
     * @param id - The SM-ID of the fresh session.
     * @param max - The server's preferred maximum resumption time.
     * @param boundJid - The JID that was bound when the session was enabled.
     */
    _onEnabled(id, max, boundJid) {
        const s = this.state;
        s.enabled = true;
        s.id = id;
        s.max = max;
        s.boundJid = boundJid;
        this.onEnabled();
    }
    /**
     * @param boundJid - The worker's boundJid for the resumed session.
     */
    _onResumed(boundJid) {
        const s = this.state;
        s.resumed = true;
        s.enabled = true;
        s.boundJid = boundJid;
        this.onResumed();
    }
    _onFailed() {
        Object.assign(this.state, freshState());
        this.onFailed();
    }
}
export default StreamManagement;
