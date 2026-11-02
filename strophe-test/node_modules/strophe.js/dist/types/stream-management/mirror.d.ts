import { SMState, StanzaView, StreamManagementController } from './types';
/**
 * A page-side stand-in for the worker-resident engine: when the connection
 * runs through a SharedWorker, the worker owns all counting, queueing and
 * nonza handling, and the page only mirrors the session state so that
 * `Connection.hasResumed()` and friends keep working.
 */
export declare class StreamManagementMirror implements StreamManagementController {
    serverSupported: boolean;
    private _state;
    get state(): SMState;
    get enabled(): boolean;
    get resumed(): boolean;
    get boundJid(): string;
    get resumePending(): boolean;
    initialize(_jid: string): void;
    hasResumableState(): boolean;
    reset(): void;
    sendResume(): void;
    sendEnable(_boundJid: string): void;
    isTracking(): boolean;
    trackOutbound(_view: StanzaView): void;
    onInbound(_view: StanzaView): void;
    onInboundStanza(_name: string): void;
    onGracefulClose(): void;
    onEnabled(): void;
    onResumed(): void;
    onFailed(_view?: StanzaView, _resumeFailed?: boolean): void;
    /**
     * @param id - The SM-ID of the fresh session.
     * @param max - The server's preferred maximum resumption time.
     * @param boundJid - The JID that was bound when the session was enabled.
     */
    _onEnabled(id: string, max: number, boundJid: string): void;
    /**
     * @param boundJid - The worker's boundJid for the resumed session.
     * @param id - The SM-ID of the resumed session.
     * @param max - The server's preferred maximum resumption time.
     */
    _onResumed(boundJid: string, id?: string, max?: number): void;
    _onFailed(): void;
}
//# sourceMappingURL=mirror.d.ts.map