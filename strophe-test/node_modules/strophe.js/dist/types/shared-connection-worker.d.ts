import StreamManagement from './stream-management/engine';
/** How often the worker pings its ports (and sweeps for gone ones). */
export declare const PING_INTERVAL = 30000;
/**
 * How long the primary may stay silent before the worker fails over to the
 * freshest other port. Pongs are posted from the page's message handler,
 * which runs even in background-throttled tabs, so silence this long means
 * the tab is frozen, crashed or gone — not merely backgrounded.
 */
export declare const PRIMARY_TIMEOUT = 70000;
/**
 * How long any port may stay silent before it is dropped entirely. Generous:
 * a frozen tab posts nothing but keeps its MessagePort, and every broadcast
 * posted to it while frozen is delivered when it thaws — dropping it early
 * would forfeit that replay. A dropped port that speaks again is re-admitted.
 */
export declare const PORT_GC_TIMEOUT: number;
/** How long the socket is kept open after the last port has gone away. */
export declare const SOCKET_GRACE = 10000;
/**
 * How long the worker waits for the server to answer an ack probe (<r/>)
 * before presuming the socket dead. Probes are sent from the sweep when an
 * SM-enabled stream has been quiet for a full PING_INTERVAL, and when a
 * tab (re)joins the established session. Without them, a silently dead
 * socket (NAT timeout, sleep/wake) is only discovered by the OS's TCP
 * timeout, which can take many minutes.
 */
export declare const PROBE_TIMEOUT = 10000;
type Role = 'primary' | 'secondary';
interface PortInfo {
    role: Role;
    lastSeen: number;
}
/**
 * Manages the shared websocket connection as well as the ports of the
 * connected tabs.
 */
declare class ConnectionManager {
    ports: Map<MessagePort, PortInfo>;
    jid: string;
    service: string;
    socket: WebSocket | null;
    /**
     * Where the shared stream is in its lifecycle. 'connecting' spans from
     * socket creation until the primary reports the bound JID (_bound) or a
     * worker-driven resumption succeeds; only in 'established' are join
     * requests answered — earlier ones wait in _pendingJoins.
     */
    session: 'none' | 'connecting' | 'established';
    /**
     * The worker-resident XEP-0198 engine (created lazily on the first SM
     * negotiation). The worker is the only party that sees all inbound
     * traffic (one socket) and all outbound traffic (every port's send
     * relays through here), so it is the only correct owner of the SM
     * counters and queue once more than one tab sends — a stanza sent from
     * a secondary tab survives resumption, and failover needs no reconnect.
     */
    sm: StreamManagement | null;
    /**
     * Ports whose join arrived while the handshake was still in flight,
     * with the method they joined through: on failure, an '_attach' join is
     * answered with ATTACHFAIL (the attach() contract), while a '_connect'
     * join is told the socket closed, so its page fails the connect attempt
     * and the embedder's reconnect logic takes over.
     */
    private _pendingJoins;
    private _sweepTimer;
    private _graceTimer;
    /** Pending death sentence for an unanswered ack probe (see _probe). */
    private _probeTimer;
    /** When the socket last delivered anything (probes count inbound only). */
    private _lastInbound;
    constructor();
    /**
     * Register a newly connected port. It is admitted (and given a role) when
     * it first speaks.
     */
    addPort(port: MessagePort): void;
    /**
     * Dispatch a message from a port. Any message counts as liveness; a port
     * that was dropped (e.g. a long-frozen tab) is re-admitted here.
     */
    private _onPortMessage;
    /**
     * Connect, or (when a live socket for the same user already exists)
     * join the shared session as a secondary instead of reconnecting (§2.5).
     * The first joiner becomes primary and drives the connection.
     */
    _connect(port: MessagePort, service: string, jid: string, version?: number): void;
    /**
     * Attach to the shared session, if there is one.
     * @param port
     * @param _service
     * @param version - The page's SHARED_WORKER_PROTOCOL_VERSION.
     */
    _attach(port: MessagePort, _service?: string, version?: number): void;
    /**
     * The primary reports that the post-SASL stream features advertise
     * XEP-0198 (§2.3). This is the resume-vs-bind decision point: only the
     * worker knows whether resumable state exists, so it either sends
     * <resume/> itself (answering with _smResumed/_smFailed once the server
     * replies) or tells the requesting port to proceed with binding.
     * @param port
     */
    _smFeatures(port: MessagePort): void;
    /**
     * The primary reports that the connect flow completed (resource bound,
     * or legacy auth/session establishment finished): adopt the bound JID as
     * the shared one so attaching secondaries and promotions hand out a
     * resource the server actually knows about, start a fresh SM session if
     * this stream's features advertised support (_smFeatures), and release
     * any joins parked on the handshake. The <enable/> is written before the
     * parked joins drain, so it precedes anything a newly attached tab sends.
     * @param _port
     * @param jid - The server-assigned full JID.
     */
    _bound(_port: MessagePort, jid: string): void;
    /**
     * Lazily create the worker-resident engine. Its nonzas go straight to
     * the socket (outbound frames relay in receipt order, so nothing can be
     * overtaken), and its lifecycle events are forwarded to the tabs as the
     * _smEnabled/_smResumed/_smFailed messages that feed the page-side
     * mirrors and drive the primary's connect flow.
     */
    private _ensureSM;
    /**
     * Liveness reply to the worker's _ping. The lastSeen update happens in
     * the dispatcher, so any message from a port counts. This method only
     * needs to exist.
     * @param _port
     */
    _pong(_port: MessagePort): void;
    /**
     * The page announces it is about to be frozen (its CPU stops): hand the
     * primary role to the freshest other port right away instead of making
     * the worker discover the freeze through missed pongs.
     * @param port
     */
    _relinquish(port: MessagePort): void;
    /**
     * Graceful removal (sent from pagehide). If the primary leaves, the next
     * live port is promoted on the same socket.
     * @param port
     */
    _bye(port: MessagePort): void;
    /**
     * Relay an outbound frame to the socket, feeding it to the XEP-0198
     * engine and reflecting messages/presences to the other tabs.
     * @param port
     * @param data
     */
    send(port: MessagePort, data: string): void;
    /**
     * Reflect an outbound message/presence to every tab except the sender,
     * so all tabs can render what any one of them sent. Delivered as its own
     * `_onStanzaSent` page message — never as `_onMessage` — because a sent
     * stanza must not enter the receiving tabs' inbound pipeline (stanza
     * handlers, SM counting, xmlInput). IQs are not reflected: they are
     * request/response traffic private to the sending tab.
     * @param sender - The port the stanza came from (gets no reflection).
     * @param name - The frame's tag name (from the peeker).
     * @param data - The raw outbound frame.
     */
    private _reflect;
    /**
     * Send the stream-closing frame before disconnecting.
     * @param port
     * @param data
     */
    close(port: MessagePort, data: string): void;
    /**
     * Explicitly close the shared socket (a deliberate disconnect/logout —
     * a mere tab close sends `_bye` instead). Joins parked on the handshake
     * are answered with ATTACHFAIL: the session they were waiting for is
     * not going to happen.
     * @param _port
     */
    _closeSocket(_port?: MessagePort): void;
    /**
     * @param e
     */
    _onClose(e: CloseEvent): void;
    /**
     * Deliver an inbound frame to the tabs, feeding it to the XEP-0198
     * engine first: counting and <r/> → <a/> replies happen exactly once.
     * Lifecycle transitions (<enabled/>/<resumed/>/<failed/>) surface
     * through the engine's event hooks (see _ensureSM).
     *
     * Until the session is established, frames go only to the primary,
     * since only it is responsible for SASL negotiation and session setup.
     * Once established, frames are broadcast to all tabs.
     * @param message
     */
    _onMessage(message: MessageEvent): void;
    /**
     * @param error
     */
    _onError(error: Event): void;
    /**
     * Verify that the page and this worker were built against the same
     * page↔worker protocol. On mismatch the port is refused (and told the
     * socket is closed, so the page fails loudly rather than misbehaving).
     * @param port
     * @param version - The version the page sent along with _connect/_attach.
     * @returns true when the page speaks this worker's protocol.
     */
    private _checkVersion;
    /**
     * @returns true when the socket exists and is not closing/closed. A
     *     CONNECTING socket counts: joins arriving during the handshake must
     *     be parked, not refused.
     */
    private _socketLive;
    /**
     * @returns true when the socket is OPEN, i.e. ready to carry frames.
     */
    private _socketReady;
    /**
     * @returns true if any live port currently holds the primary role.
     */
    private _hasPrimary;
    /**
     * @returns The port currently holding the primary role, or null.
     */
    private _primaryPort;
    /**
     * Join a port onto the shared session: it becomes secondary (or primary,
     * if no primary is left) and is attached. Joins that arrive while the
     * handshake is still in flight are parked.
     * @param port
     * @param origin - The method the join arrived through (see _pendingJoins).
     */
    private _joinShared;
    /**
     * The stream reached its usable state (resource bound or resumed):
     * record it and answer the joins that were parked on the handshake.
     */
    private _sessionEstablished;
    /**
     * Fail parked joins. The session they were waiting for died before it
     * was established. '_attach' joins get ATTACHFAIL; '_connect' joins are
     * told the socket closed, which fails the page's connect attempt so the
     * embedder's reconnect logic can retry.
     */
    private _failPendingJoins;
    /**
     * The primary is gone (bye, GC or freeze). If the session is established
     * the freshest remaining port takes over on the same socket. If the
     * handshake was still in flight, nobody else can finish it (only the
     * primary holds credentials): kill the socket so the remaining tabs
     * reconnect and elect a new primary.
     */
    private _primaryLost;
    /**
     * Promote the freshest port to primary — same socket, no reconnect.
     * @param exclude - A port that must not be picked (e.g. the one
     *     relinquishing the role).
     */
    private _promoteNext;
    /**
     * Hand the primary role from `port` to the freshest other port, if any.
     * @param port - The current primary.
     * @param minLastSeen - Only consider candidates seen at or after this
     *     timestamp (so a failover never picks an equally-dead port).
     * @returns true if a failover happened.
     */
    private _failover;
    /**
     * @param exclude - A port to skip.
     * @param minLastSeen - Minimum lastSeen for a port to qualify.
     * @returns The most recently seen qualifying port, or null.
     */
    private _freshestPort;
    /**
     * A frame was sent into a dead socket. If an SM session was active, feed
     * a stanza to the engine anyway: it lands in the unacked queue and is
     * replayed when the session is resumed over the next socket, so the
     * message the user just sent isn't lost to the bad timing. A <close/>
     * still ends the session: the final <a/> can't be delivered anymore
     * (the engine's sendRaw is null-guarded), but the persisted state is
     * cleared so the deliberately-ended session isn't resumed later.
     * @param port - The port the frame came from.
     * @param data - The raw outbound frame.
     */
    private _salvageFrame;
    /**
     * Report a frame the regex peeker (see parse.ts) could not parse while an
     * SM session was active. Such a frame passes through uncounted and
     * untracked, so the XEP-0198 handled-stanza counters drift and stanzas
     * get duplicated (inbound) or lost (outbound) on the next resume —
     * exactly the silent corruption SM exists to prevent, so make it loud.
     *
     * Only frames that look like an element open are reported: the stream
     * prolog, whitespace keepalives and empty frames legitimately don't peek
     * and are never countable stanzas.
     *
     * The opening tag is included so the peeker can actually be fixed — it is
     * where the parse failed (peekElement only ever inspects the opening tag)
     * and is the whole diagnostic. The report stops at the first '>' (capped),
     * which keeps the stanza payload — message bodies and the like — out of
     * the logs.
     * @param direction
     * @param frame
     */
    private _warnUnpeekable;
    /**
     * Ping every port and act on prolonged silence. A live page answers
     * pings from its message handler even when its timers are throttled, so:
     * a primary silent past PRIMARY_TIMEOUT is failed over (but keeps
     * receiving — it may merely be frozen and will learn of its demotion on
     * thaw), and a port silent past PORT_GC_TIMEOUT is dropped for good.
     */
    private _sweep;
    /**
     * Ask the server for an ack and treat a missing reply as socket death.
     * The <r/> doubles as a keepalive on quiet connections.
     */
    private _probe;
    private _cancelProbe;
    /**
     * The probe went unanswered: the socket is transmitting into the void.
     * Close it and tell the tabs, so they reconnect. The engine's state is
     * untouched, so the next stream resumes and replays the unacked queue.
     */
    private _onSocketDead;
    /**
     * Close the socket if no port shows up within the grace period.
     */
    private _startGrace;
    private _cancelGrace;
    /**
     * Send a message to a single port (worker→page traffic is port-targeted;
     * only genuine broadcasts use _broadcast).
     * @param port
     * @param msg
     */
    private _post;
    /**
     * Send a message to all live ports.
     * @param msg
     */
    private _broadcast;
}
export default ConnectionManager;
//# sourceMappingURL=shared-connection-worker.d.ts.map