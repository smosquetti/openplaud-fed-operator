/**
 * This file implements XMPP over WebSockets for Strophejs.
 *
 * If a Connection is established with a Websocket url (ws://...)
 * Strophe will use WebSockets.
 *
 * For more information on XMPP-over-WebSocket see RFC 7395:
 * http://tools.ietf.org/html/rfc7395
 */
import type Connection from './connection';
import Builder from './builder';
import { WebsocketLike } from './types';
/**
 * Helper class that handles WebSocket Connections
 *
 * The WebSocket class is used internally by Connection
 * to encapsulate WebSocket sessions. It is not meant to be used from user's code.
 */
declare class Websocket {
    _conn: Connection;
    strip: string;
    socket: WebSocket | WebsocketLike | null;
    _messageHandler: (message: MessageEvent) => void;
    /**
     * Create and initialize a WebSocket object.
     * Currently only sets the connection Object.
     * @param connection - The Connection that will use WebSockets.
     */
    constructor(connection: Connection);
    /**
     * _Private_ helper function to generate the <stream> start tag for WebSockets
     * @private
     * @returns A Builder with a <stream> element.
     */
    _buildStream(): Builder;
    /**
     * _Private_ checks a message for stream:error
     * @private
     * @param bodyWrap - The received stanza.
     * @param connectstatus - The ConnectStatus that will be set on error.
     * @returns true if there was a streamerror, false otherwise.
     */
    _checkStreamError(bodyWrap: Element, connectstatus: number): boolean;
    /**
     * Reset the connection.
     *
     * This function is called by the reset function of the Strophe Connection.
     * Is not needed by WebSockets.
     */
    _reset(): void;
    /**
     * _Private_ function called by Connection.connect
     *
     * Creates a WebSocket for a connection and assigns Callbacks to it.
     * Does nothing if there already is a WebSocket.
     */
    _connect(): void;
    /**
     * _Private_ function called by Connection._connect_cb
     * checks for stream:error
     * @param bodyWrap - The received stanza.
     */
    _connect_cb(bodyWrap: Element): number | void;
    /**
     * _Private_ function that checks the opening <open /> tag for errors.
     *
     * Disconnects if there is an error and returns false, true otherwise.
     * @private
     * @param message - Stanza containing the <open /> tag.
     */
    _handleStreamStart(message: Element): boolean;
    /**
     * _Private_ function that handles the first connection messages.
     *
     * On receiving an opening stream tag this callback replaces itself with the real
     * message handler. On receiving a stream error the connection is terminated.
     * @param message
     */
    _onInitialMessage(message: MessageEvent): void;
    /**
     * Called by _onInitialMessage in order to replace itself with the general message handler.
     * This method is overridden by WorkerWebsocket, which manages a
     * websocket connection via a service worker and doesn't have direct access
     * to the socket.
     */
    _replaceMessageHandler(): void;
    /**
     * _Private_ function called by Connection.disconnect
     * Disconnects and sends a last stanza if one is given
     * @param pres - This stanza will be sent before disconnecting.
     */
    _disconnect(pres?: Element | Builder): void;
    /**
     * _Private_ function to disconnect.
     * Just closes the Socket for WebSockets
     */
    _doDisconnect(): void;
    /**
     * PrivateFunction _streamWrap
     * _Private_ helper function to wrap a stanza in a <stream> tag.
     * This is used so Strophe can process stanzas from WebSockets like BOSH
     * @param stanza
     */
    _streamWrap(stanza: string): string;
    /**
     * _Private_ function to close the WebSocket.
     *
     * Closes the socket if it is still open and deletes it
     */
    _closeSocket(): void;
    /**
     * _Private_ function to check if the message queue is empty.
     * @returns True, because WebSocket messages are send immediately after queueing.
     */
    _emptyQueue(): true;
    /**
     * _Private_ function to handle websockets closing.
     * @param e
     */
    _onClose(e?: CloseEvent): void;
    /**
     * Called on stream start/restart when no stream:features
     * has been received.
     * @param callback
     */
    _no_auth_received(callback?: (this: Connection) => void): void;
    /**
     * _Private_ timeout handler for handling non-graceful disconnection.
     *
     * This does nothing for WebSockets
     */
    _onDisconnectTimeout(): void;
    /**
     * _Private_ helper function that makes sure all pending requests are aborted.
     */
    _abortAllRequests(): void;
    /**
     * _Private_ function to handle websockets errors.
     * @param error - The websocket error.
     */
    _onError(error: Event): void;
    /**
     * _Private_ function called by Connection._onIdle
     * sends all queued stanzas
     */
    _onIdle(): void;
    /**
     * _Private_ function to handle websockets messages.
     *
     * This function parses each of the messages as if they are full documents.
     * [TODO : We may actually want to use a SAX Push parser].
     *
     * Since all XMPP traffic starts with
     * <stream:stream version='1.0'
     *                xml:lang='en'
     *                xmlns='jabber:client'
     *                xmlns:stream='http://etherx.jabber.org/streams'
     *                id='3697395463'
     *                from='SERVER'>
     *
     * The first stanza will always fail to be parsed.
     *
     * Additionally, the seconds stanza will always be <stream:features> with
     * the stream NS defined in the previous stanza, so we need to 'force'
     * the inclusion of the NS in this stanza.
     *
     * @param message - The websocket message event
     */
    _onMessage(message: MessageEvent): void;
    /**
     * _Private_ function to handle websockets connection setup.
     * The opening stream tag is sent here.
     * @private
     */
    _onOpen(): void;
    /**
     * _Private_ part of the Connection.send function for WebSocket
     * Just flushes the messages that are in the queue
     */
    _send(): void;
    /**
     * Send an xmpp:restart stanza.
     */
    _sendRestart(): void;
}
export default Websocket;
//# sourceMappingURL=websocket.d.ts.map