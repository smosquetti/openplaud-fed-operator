/**
 * This file implements the XEP-0114 "Jabber Component Protocol" transport for
 * Strophe.js, letting a Connection attach to an XMPP server as an external
 * component (`jabber:component:accept`) over a raw TCP stream.
 *
 * It is a streaming transport modelled on {@link Websocket}. Unlike a
 * client-to-server stream there is no SASL, no TLS negotiation and no resource
 * binding. After the stream is opened the component authenticates with a single
 * SHA-1 handshake (XEP-0114 §3) and is then CONNECTED. Because it relies on
 * `node:net` and `node:crypto` it is inherently Node-only and is not included
 * in the browser build.
 *
 * @example
 *   // Creating a connection with a XEP-0114 Component
 *   const conn = new Strophe.Connection('tcp://localhost:5347', { protocol: 'component' });
 *
 *   // jid = the component's own domain; pass = the shared secret
 *   conn.connect('component.example.org', 'the-shared-secret', (status) => {
 *       if (status === Strophe.Status.CONNECTED) {
 *           // send/receive stanzas (stamp `from` under component.example.org)
 *       }
 *   });
 */
import { Buffer } from 'node:buffer';
import { type Socket } from 'node:net';
import type Connection from '../connection';
import Builder from '../builder';
import type { Transport } from './types';
/**
 * Helper class that handles XEP-0114 external component connections.
 *
 * Like {@link Websocket} it is used internally by {@link Connection} to
 * encapsulate a session and is not meant to be used from user code. Select it
 * with the `protocol: 'component'` connection option and a `tcp://host:port`
 * service URL.
 */
declare class Component implements Transport {
    _conn: Connection;
    strip: string;
    socket: Socket | null;
    private _parser;
    private _streamId;
    /** Whether the XEP-0114 handshake has completed successfully. */
    private _authenticated;
    /** Whether the connection has already been torn down. Guards against a
     * second DISCONNECTED when several teardown triggers coincide (see
     * {@link Component#_teardown}). */
    private _disconnected;
    /**
     * Create and initialize a Component object.
     * @param connection - The Connection that will use this component transport.
     */
    constructor(connection: Connection);
    /**
     * Parse the component service URL into a host and port.
     *
     * Accepts `tcp://host:port` (the recommended plaintext form) and tolerates a
     * bare `host:port`. The port defaults to 5347, the conventional component
     * listener port.
     */
    _serviceUrl(): {
        host: string;
        port: number;
    };
    /**
     * Reset the transport. Called by {@link Connection#reset}.
     */
    _reset(): void;
    /**
     * _Private_ function called by Connection.connect
     *
     * Opens a TCP socket to the component listener and wires up its callbacks.
     */
    _connect(): void;
    /**
     * _Private_ function called by Connection._connect_cb
     *
     * The component protocol has no <stream:features> to inspect, so there is
     * nothing to check here. Kept for interface parity with the other
     * transports.
     */
    _connect_cb(_bodyWrap: Element): number | void;
    /**
     * _Private_ function to handle a successful TCP connection.
     * Sends the component stream header (XEP-0114 §2).
     */
    _onOpen(): void;
    /**
     * The opening `<stream:stream>` header sent to the server. `to` is the
     * component's own domain, per XEP-0114.
     */
    _streamHeader(): string;
    /**
     * A self-closed representation of the stream header, purely for the
     * `xmlOutput` debug hook (the real header sent on the wire never closes).
     */
    _streamOpenElement(): Element;
    /**
     * _Private_ function called when raw bytes arrive on the socket.
     * Feeds them into the incremental stream parser.
     * @param chunk - The bytes received from the socket.
     */
    _onData(chunk: Buffer): void;
    /**
     * Handle the server's opening stream header. Captures the stream id and
     * replies with the SHA-1 handshake (XEP-0114 §3).
     * @param attrs - The attributes of the server's <stream:stream> header.
     */
    _onStreamStart(attrs: Record<string, string>): void;
    /**
     * Compute and send the XEP-0114 handshake digest,
     * `hex( SHA1( STREAM_ID + SHARED_SECRET ) )` in lowercase.
     * @param streamId - The stream id from the server's stream header.
     */
    _sendHandshake(streamId: string): void;
    /**
     * Route a complete inbound stanza. Before the handshake completes this is
     * the handshake result; afterwards it's ordinary traffic.
     * @param stanza - A complete top-level stanza element.
     */
    _onStanza(stanza: Element): void;
    /**
     * Inspect the server's reply to our handshake. An empty `<handshake/>`
     * means success and the component is CONNECTED; a `<stream:error/>` (e.g.
     * `<not-authorized/>`) means the shared secret was wrong.
     * @param stanza - The first stanza received after sending the handshake.
     */
    _handleHandshakeResult(stanza: Element): void;
    /**
     * _Private_ function to handle incoming stanzas once authenticated.
     * Wraps the stanza and routes it through the normal handler machinery,
     * exactly as {@link Websocket#_onMessage} does.
     * @param stanza - A complete top-level stanza element.
     */
    _onMessage(stanza: Element): void;
    /**
     * Serialize an element to a string, reusing Strophe's own serializer so
     * output matches the other transports.
     */
    _serialize(elem: Element): string;
    /**
     * _Private_ checks a received stream error and tears the connection down.
     * @param streamError - The <stream:error/> element.
     */
    _checkStreamError(streamError: Element): void;
    /**
     * Handle the closing `</stream:stream>` tag from the server.
     */
    _onStreamEnd(): void;
    /**
     * Handle a fatal XML parse error on the inbound stream.
     * @param error - The parse error.
     */
    _onParseError(error: Error): void;
    /**
     * _Private_ function called by Connection.disconnect
     * Sends an optional last stanza, then the closing stream tag, then
     * tears down the socket.
     * @param pres - This stanza will be sent before disconnecting.
     */
    _disconnect(pres?: Element | Builder): void;
    /**
     * Tear the connection down exactly once.
     *
     * A single parsed chunk can surface several teardown triggers back to
     * back: a `<stream:error/>` immediately followed by the closing
     * `</stream:stream>`, or a socket error and then its close event. Each
     * would otherwise call {@link Connection#_doDisconnect} again and fire a
     * second DISCONNECTED. The first call through here wins; later ones are
     * no-ops.
     * @param status - A {@link Status} to report before disconnecting, or null
     *     to disconnect without a preceding status change (e.g. a plain stream
     *     close).
     * @param condition - The accompanying error condition, if any.
     */
    _teardown(status: number | null, condition?: string | null): void;
    /**
     * _Private_ function to disconnect. Just closes the socket.
     */
    _doDisconnect(): void;
    /**
     * _Private_ function to close the TCP socket and drop its listeners.
     */
    _closeSocket(): void;
    /**
     * _Private_ function to check if the message queue is empty.
     * @returns True, because stanzas are written to the socket immediately.
     */
    _emptyQueue(): true;
    /**
     * _Private_ function to handle the socket closing.
     */
    _onClose(): void;
    /**
     * Called on stream start/restart when no authentication mechanism is
     * offered. Not reachable on the component path (there is no SASL), but kept
     * for interface parity.
     * @param callback
     */
    _no_auth_received(callback?: (this: Connection) => void): void;
    /**
     * _Private_ timeout handler for a non-graceful disconnection.
     * Nothing to do for a plain TCP socket.
     */
    _onDisconnectTimeout(): void;
    /**
     * _Private_ helper that makes sure all pending requests are aborted.
     * A component has no in-flight requests, so this is a no-op.
     */
    _abortAllRequests(): void;
    /**
     * _Private_ function to handle socket errors.
     * @param error - The socket error.
     */
    _onError(error: Error): void;
    /**
     * _Private_ function called by Connection._onIdle
     * Serializes queued stanzas and writes them to the socket, stamping a
     * `from` attribute under the component's domain when one is absent (the
     * server validates that a component stamps `from`, per XEP-0114).
     */
    _onIdle(): void;
    /**
     * Ensure an outgoing stanza carries a `from` attribute under the
     * component's domain, which XEP-0114 requires the server to validate.
     * An explicit `from` (e.g. a sub-JID of the component) is left untouched.
     * @param stanza - The outgoing stanza element.
     */
    _stampFrom(stanza: Element): void;
    /**
     * _Private_ part of the Connection.send function for the component transport.
     * Just flushes the messages that are in the queue.
     */
    _send(): void;
    /**
     * Send an xmpp:restart stanza.
     *
     * Components never restart their stream, so this only flushes any queued
     * data. Included for interface parity with the other transports.
     */
    _sendRestart(): void;
}
export default Component;
//# sourceMappingURL=component.d.ts.map