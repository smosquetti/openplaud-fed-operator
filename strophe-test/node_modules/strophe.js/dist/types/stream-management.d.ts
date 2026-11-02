/**
 * A minimal, environment-free view of a top-level stanza or nonza.
 *
 * The page adapter builds it from a DOM Element (tagName/getAttribute/serialize),
 * the worker adapter from a raw frame string (via the sm-parse peeker).
 */
export interface StanzaView {
    name: string; /** The local (unprefixed) tag name of the top-level element. */
    attrs: Record<string, string>; /** The attributes of the top-level element. */
    serialized: string; /** The serialized element — used as the unacked queue payload. */
}
/** An entry in the unacked queue. */
export interface QueuedStanza {
    name: string; /** The local tag name (needed to decide XEP-0203 delay-stamping on re-send). */
    stanza: string; /** The serialized stanza. */
    queuedAt: number; /** When the stanza was first queued (ms since epoch) the XEP-0203 delay stamp value. */
}
/** The serialisable Stream Management session state. */
export interface SMState {
    /**
     * Whether <enable/> has been sent on the current stream. The XEP starts the
     * two counters asymmetrically: outbound tracking begins at enable-*send*,
     * inbound counting at <enabled/>-*receipt* (XEP-0198 §4, note).
     */
    enableSent: boolean;
    enabled: boolean; /** Whether <enabled/> has been received; inbound counting is active. */
    id: string; /** The SM-ID from <enabled/>; sent as `previd` when resuming. */
    boundJid: string; /** The full JID that was bound when <enable/> was sent (re-applied resume). */
    max: number; /** Server's preferred max resumption time in seconds (from <enabled/>). */
    location: string; /** Server's preferred reconnection location (from <enabled/>). Stored but not acted upon. */
    resumeSupported: boolean; /** Whether the server allows this session to be resumed. */
    resumed: boolean; /** Whether the current session was established by resuming a previous one. */
    hIn: number; /** Count of inbound stanzas handled by us. The client's 'h', mod 2^32. */
    hOutAcked: number; /** The last 'h' value acknowledged by the server. */
    unacked: QueuedStanza[]; /** Outbound stanzas sent but not yet acknowledged by the server. */
    sinceLastAck: number; /** Outbound countable stanzas since the server's last <a/>. */
}
/**
 * Pluggable persistence for resumable SM state.
 * Implementations must be synchronous. The <resumed/> handler runs inside the
 * synchronous stanza dispatch and state must be consistent immediately after.
 */
export interface SMStorageBackend {
    load(key: string): SMState | null;
    save(key: string, state: SMState): void;
    clear(key: string): void;
}
export interface StreamManagementOptions {
    maxUnacked?: number; /** Request an ack via <r/> after this many outbound stanzas. 0 disables. Default: 5. */
    requestResume?: boolean; /** Ask for a resumable session (resume="true" on <enable/>). Default: true. */
    max?: number; /** The client's preferred max resumption time in seconds (max attribute on <enable/>). */
    storage?: SMStorageBackend; /** Storage backend for resumable state. Default: per-instance MemoryStorageBackend. */
}
/**
 * @param name - A top-level element's local tag name.
 * @returns true if the element counts towards the SM 'h' counters.
 */
export declare function isCountableStanza(name: string): boolean;
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
export declare function stampDelay(serialized: string, name: string, queuedAt: number): string;
/**
 * Build the environment-free {@link StanzaView} consumed by the XEP-0198
 * engine from a DOM Element. This is the page-adapter side of the
 * core/adapter split — the worker adapter builds the same view from a raw
 * frame string (see sm-parse.ts). It lives here (rather than in utils.ts) to
 * keep the worker bundle free of utils and its dependencies: XMLSerializer
 * is a DOM global, but this function is only ever called on the page.
 * @param el
 */
export declare function toStanzaView(el: Element): StanzaView;
/**
 * In-memory storage backend (Node, tests, or non-resumable setups).
 * State is serialized on save so callers can't mutate stored state by reference.
 */
export declare class MemoryStorageBackend implements SMStorageBackend {
    private store;
    constructor();
    /**
     * @param key
     */
    load(key: string): SMState;
    /**
     * @param key
     * @param state
     */
    save(key: string, state: SMState): void;
    /**
     * @param key
     */
    clear(key: string): void;
}
/**
 * sessionStorage-backed storage backend (browser pages).
 * Survives page reloads within a tab, which is exactly the resumption window.
 */
export declare class SessionStorageBackend implements SMStorageBackend {
    constructor();
    /**
     * @param key
     */
    load(key: string): SMState;
    /**
     * @param key
     * @param state
     */
    save(key: string, state: SMState): void;
    /**
     * @param key
     */
    clear(key: string): void;
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
declare class StreamManagement {
    /** Whether the current stream's features advertised <sm xmlns="urn:xmpp:sm:3"/>. Not persisted. */
    serverSupported: boolean;
    private _sendRaw;
    private _options;
    private _storage;
    private _storageKey;
    private _state;
    /**
     * Stanzas salvaged from a failed resumption, awaiting re-send once the
     * fresh session reaches <enabled/>. Deliberately not persisted: storage is
     * cleared on <failed/>, and this buffer is best-effort redelivery.
     */
    private _pendingResend;
    /**
     * @param sendRaw - Emits a serialized nonza (or re-sent stanza) towards the server.
     * @param options
     */
    constructor(sendRaw: (data: string) => void, options?: StreamManagementOptions);
    /** The live SM state. Treat as read-only outside of tests. */
    get state(): SMState;
    /** Whether <enabled/> has been received and the SM session is active. */
    get enabled(): boolean;
    /** Whether the current session was established by resumption. */
    get resumed(): boolean;
    /** The full JID bound when the SM session was enabled. */
    get boundJid(): string;
    /**
     * Set the storage key (from the user's bare JID) and load any persisted
     * resumable state. Call before deciding between resume and fresh bind.
     * @param jid - The user's JID (a full JID is reduced to its bare form).
     */
    initialize(jid: string): void;
    /**
     * @returns true if persisted state allows attempting <resume/>.
     */
    hasResumableState(): boolean;
    /**
     * Reset the in-memory engine (e.g. from Connection.reset()).
     * Persisted state is NOT touched — clearing storage is tied to intent
     * (clean close, logout, failed resume), not to connection reuse.
     */
    reset(): void;
    /** Remove persisted state (clean close, logout, failed resume). */
    clearPersistedState(): void;
    /**
     * Send <enable/> to start a new SM session. Call after resource binding,
     * at the point CONNECTED is emitted. At most one <enable/> is sent per
     * stream — a second attempt SHOULD get the stream killed by the server
     * (XEP-0198 §3).
     * @param boundJid - The full JID that was just bound.
     */
    sendEnable(boundJid: string): void;
    /**
     * Send <resume/> for the persisted previous session. Call instead of
     * binding, once the post-SASL stream features advertise SM support.
     */
    sendResume(): void;
    /**
     * Track an outbound top-level element. Called for every element that
     * enters the send queue; non-countable elements are ignored here.
     * Active from the moment <enable/> is sent (not from <enabled/> receipt —
     * XEP-0198 starts the outbound counter at enable-send).
     * @param view
     */
    trackOutbound(view: StanzaView): void;
    /**
     * Process an inbound top-level element.
     * @param view
     * @returns true if the element was an SM nonza (consumed by the engine),
     *     false if it's a regular stanza (counted here when the session is
     *     enabled, but still to be dispatched to handlers by the caller).
     */
    onInbound(view: StanzaView): boolean;
    /**
     * @param name - A top-level element's local tag name.
     * @returns true if the element is an SM nonza.
     */
    isNonza(name: string): boolean;
    /** Send an unrequested ack request <r/> to the server. */
    requestAck(): void;
    /**
     * Send an ack <a/> with the current inbound count. Used to answer <r/>,
     * and RECOMMENDED right before gracefully closing the stream (XEP-0198 §4)
     * so the server doesn't redeliver stanzas that were actually received.
     */
    sendAck(): void;
    /**
     * Count an inbound top-level stanza by name. Adapters call this from
     * their dispatch loop for every inbound child element — non-countable
     * names and inactive sessions are no-ops, so no StanzaView needs to be
     * built for the common case.
     * @param name - The element's local tag name.
     */
    onInboundStanza(name: string): void;
    /**
     * Call when the stream is about to be closed cleanly: sends a final
     * <a/> so the server doesn't redeliver stanzas that were actually
     * received (RECOMMENDED, XEP-0198 §4), clears persisted state (a
     * cleanly closed stream is not resumable, XEP-0198 §Stream Closure) and
     * deactivates the engine, so nothing sent during teardown is tracked or
     * re-persisted.
     */
    onGracefulClose(): void;
    /** Overridable event hook: an SM session was established via <enabled/>. */
    onEnabled(): void;
    /** Overridable event hook: the previous session was resumed via <resumed/>. */
    onResumed(): void;
    /**
     * Overridable event hook: <enable/> or <resume/> failed.
     * @param _view - The <failed/> nonza (inspect e.g. for <item-not-found/>).
     */
    onFailed(_view?: StanzaView): void;
    /**
     * Reconcile the server-reported 'h' against the unacked queue (mod 2^32).
     * An 'h' above our send count is logged and clamped rather than answered
     * with the spec's <handled-count-too-high/> stream close — a client
     * killing the stream over a server bug only hurts the user.
     * @param h
     */
    private _reconcile;
    /**
     * @param view
     */
    private _handleAck;
    /**
     * @param view
     */
    private _handleEnabled;
    /**
     * @param view
     */
    private _handleResumed;
    /**
     * <enable/> or <resume/> failed. Trim the queue by the optional 'h' on
     * <failed/>, salvage the remainder for re-send once a fresh session
     * reaches <enabled/> (a SHOULD, XEP-0198 §4), reset the dead session and
     * clear its persisted state.
     * @param view
     */
    private _handleFailed;
    /**
     * Re-send stanzas salvaged from a failed resumption on the freshly
     * enabled session. Messages are stamped with a XEP-0203 <delay/> carrying
     * their original send time. The re-sent stanzas enter the new session's
     * unacked queue in wire order.
     */
    private _resendPending;
    /** Persist the current state, if a storage key has been configured. */
    private _persist;
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
export declare class StreamManagementMirror extends StreamManagement {
    constructor();
    initialize(_jid: string): void;
    hasResumableState(): boolean;
    sendEnable(_boundJid: string): void;
    sendResume(): void;
    requestAck(): void;
    sendAck(): void;
    trackOutbound(_view: StanzaView): void;
    onInbound(_view: StanzaView): boolean;
    onInboundStanza(_name: string): void;
    onGracefulClose(): void;
    clearPersistedState(): void;
    /**
     * @param id - The SM-ID of the fresh session.
     * @param max - The server's preferred maximum resumption time.
     * @param boundJid - The JID that was bound when the session was enabled.
     */
    _onEnabled(id: string, max: number, boundJid: string): void;
    /**
     * @param boundJid - The worker's boundJid for the resumed session.
     */
    _onResumed(boundJid: string): void;
    _onFailed(): void;
}
export default StreamManagement;
//# sourceMappingURL=stream-management.d.ts.map