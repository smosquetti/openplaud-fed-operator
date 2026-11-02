import { SMState, StanzaView, StreamManagementController, StreamManagementOptions } from './types';
/**
 * The XEP-0198 Stream Management engine.
 *
 * Hosted by {@link Connection} (page) or by the shared-connection worker; fed
 * {@link StanzaView}s by a thin per-environment adapter. Emits nonzas through
 * the injected `sendRaw` function.
 */
declare class StreamManagement implements StreamManagementController {
    /** Whether the current stream's features advertised <sm xmlns="urn:xmpp:sm:3"/>. Not persisted. */
    serverSupported: boolean;
    private _sendRaw;
    private _options;
    private _storage;
    private _storageKey;
    private _state;
    /**
     * Whether a <resume/> has been sent and not yet answered. Deliberately
     * not part of the persisted state: it describes the current stream's
     * negotiation, not the resumable session, so a reloaded page must not
     * inherit it.
     */
    private _resumePending;
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
    /** Whether a <resume/> has been sent and not yet answered. */
    get resumePending(): boolean;
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
     * @returns true once <enable/> has been sent, i.e. outbound stanzas are
     *     being tracked. Lets the caller skip building a {@link StanzaView}
     *     for {@link trackOutbound} when tracking is inactive, without
     *     reaching into the engine's state.
     */
    isTracking(): boolean;
    /**
     * Track an outbound top-level element. Called for every element that
     * enters the send queue; non-countable elements are ignored here.
     * Active from the moment <enable/> is sent (not from <enabled/> receipt —
     * XEP-0198 starts the outbound counter at enable-send).
     * @param view
     */
    trackOutbound(view: StanzaView): void;
    /**
     * Process one inbound top-level element: count it if it is a countable
     * stanza (when the session is enabled), otherwise handle it as an SM
     * nonza (<r>/<a>/<enabled>/<resumed>/<failed>). Unrecognised elements are
     * ignored. Each host dispatches inbound elements to its own handlers
     * independently of this call, so nothing is returned.
     * @param view
     */
    onInbound(view: StanzaView): void;
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
     * @param _resumeFailed - true when the failure answered a <resume/> (the
     *     unacked queue was salvaged for re-send on the next session), false
     *     when it answered an <enable/>.
     */
    onFailed(_view?: StanzaView, _resumeFailed?: boolean): void;
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
     * <failed/>, reset the dead session and clear its persisted state.
     *
     * Only a failed *resumption* strands sent-but-undelivered stanzas, so
     * only then is the remaining queue salvaged for re-send once a fresh
     * session reaches <enabled/> (a SHOULD, XEP-0198 §4). When <failed/>
     * answers an <enable/> the stream is alive and bound — everything in
     * `unacked` was delivered normally; re-sending it later would duplicate
     * it.
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
export default StreamManagement;
//# sourceMappingURL=engine.d.ts.map