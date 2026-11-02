import type Connection from './connection';
import Websocket from './websocket';
import Builder from './builder';
import { WebsocketLike } from './types';
/**
 * Helper class that handles a websocket connection inside a shared worker.
 */
declare class WorkerWebsocket extends Websocket {
    worker: SharedWorker;
    _messageHandler: (m: MessageEvent) => void;
    socket: WebsocketLike | null;
    private _lifecycleAttached;
    /**
     * Create and initialize a WorkerWebsocket object.
     * @param connection - The Connection
     */
    constructor(connection: Connection);
    /**
     * (Re)create the SharedWorker. Called for every connection attempt: if
     * the worker for this URL is still running, the browser just opens
     * another port to it (the previous port is said goodbye to and closed),
     * but if it terminated (it shuts itself down when it detects a page from
     * a newer build, and the browser reclaims it when the last tab goes away
     * or it crashes), a fresh worker running the *current* script is
     * spawned. Ports to a dead worker fail silently, so re-creating per
     * attempt is the only reliable way to recover from worker death.
     */
    private _initWorker;
    /**
     * @private
     */
    _setSocket(): void;
    _connect(): void;
    /**
     * @param callback
     */
    _attach(callback: (status: number, condition?: string | Element, response?: Element | string) => void): void;
    /**
     * Called by the worker to assign this tab's role. A secondary shares the
     * already-established session, so it must not treat inbound frames as its
     * own connection handshake.
     * @param role
     * @param jid - The shared connection's JID.
     */
    _role(role: 'primary' | 'secondary', jid?: string): void;
    /**
     * Called by the worker when this tab is promoted to primary after the
     * previous primary went away. Same socket — no reconnect happens.
     * @param jid - The shared connection's JID.
     */
    _promote(jid?: string): void;
    /**
     * Ask the worker to negotiate XEP-0198 for the freshly authenticated
     * stream (§2.3): it sends <resume/> if it holds resumable state,
     * otherwise it replies with _smNoState and the connection proceeds to
     * bind a resource.
     */
    _smFeatures(): void;
    /**
     * Report that the connect flow completed (resource bound, or legacy
     * auth/session establishment finished). Sent with or without SM: the
     * worker adopts the bound JID as the shared one, releases tabs parked on
     * the handshake, and starts a fresh SM session itself when this stream's
     * features advertised support.
     * @param jid - The server-assigned full JID.
     */
    _bound(jid: string): void;
    /**
     * Liveness probe from the worker. Answered from this message handler —
     * which runs even when the browser throttles this tab's timers — so a
     * merely-backgrounded tab never looks dead to the worker.
     */
    _ping(): void;
    /**
     * Called by the worker when another tab sent a message or presence
     * stanza over the shared connection. Handed to its own overridable hook
     * — never into the inbound pipeline (_dataRecv), where it would hit
     * stanza handlers, SM counting and xmlInput as if it were received
     * traffic.
     * @param data - The serialized stanza.
     */
    _onStanzaSent(data: string): void;
    /**
     * Called by the worker when it has no resumable state: continue the
     * connect flow with resource binding.
     */
    _smNoState(): void;
    /**
     * Called by the worker when a fresh SM session was established.
     * @param id - The SM-ID.
     * @param max - The server's preferred maximum resumption time.
     * @param boundJid - The JID that was bound when the session was enabled.
     */
    _smEnabled(id: string, max: number, boundJid: string): void;
    /**
     * Called by the worker when the previous session was resumed. Every tab
     * adopts the originally bound JID; the primary — which drove the connect
     * flow — additionally restores the connection state and emits CONNECTED
     * (the same actions a non-worker connection applies on <resumed/>).
     * @param jid - The worker's boundJid.
     * @param id - The SM-ID of the resumed session.
     * @param max - The server's preferred maximum resumption time.
     */
    _smResumed(jid: string, id?: string, max?: number): void;
    /**
     * Called by the worker when resumption failed: the primary falls back
     * to binding a resource on this same stream (the salvaged queue stays
     * in the worker and is re-sent after the next <enabled/>).
     */
    _smFailed(): void;
    /**
     * Wire the page lifecycle into the worker's port bookkeeping: `_bye` on
     * pagehide (graceful removal + failover), `_relinquish` on freeze (hand
     * the primary role over *before* this tab's CPU stops), and a `_pong`
     * when the page comes back (which also re-admits this port if the worker
     * dropped it while we were away). Routine liveness is worker-driven
     * ping/pong (see {@link WorkerWebsocket#_ping}) — deliberately no
     * page-side timers, because hidden tabs may only run timers once every
     * ten minutes.
     */
    private _attachLifecycleListeners;
    /**
     * Called when the worker reports that the shared socket closed or died.
     * Unlike a page-owned websocket this can arrive while this tab believes
     * it is still connecting. The worker owns the socket, and e.g. its
     * connection attempt to the server can fail. The base implementation
     * ignores closes in that state (it only knows real CloseEvents), which
     * would leave this tab stuck in CONNECTING forever, so fail the
     * connection attempt instead: the embedder's reconnect logic takes it
     * from there.
     * @param e - The close reason from the worker, or a close event.
     */
    _onClose(e?: CloseEvent | string): void;
    /**
     * @param status
     * @param jid
     */
    _attachCallback(status: number, jid?: string, _condition?: string): void;
    /**
     * @param pres - This stanza will be sent before disconnecting.
     */
    _disconnect(pres?: Element | Builder): void;
    _closeSocket(): void;
    /**
     * Called by _onInitialMessage in order to replace itself with the general message handler.
     * This method is overridden by WorkerWebsocket, which manages a
     * websocket connection via a service worker and doesn't have direct access
     * to the socket.
     */
    _replaceMessageHandler(): void;
    /**
     * function that handles messages received from the service worker
     * @private
     * @param ev
     */
    _onWorkerMessage(ev: MessageEvent): void;
}
export default WorkerWebsocket;
//# sourceMappingURL=worker-websocket.d.ts.map