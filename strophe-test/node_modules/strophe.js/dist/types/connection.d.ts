import type SASLMechanism from './sasl';
import type Request from './request';
import Handler from './handler';
import TimedHandler from './timed-handler';
import Builder from './builder';
import { type Cookies } from './utils';
import type { Transport } from './transports/types';
import { type StreamManagementController, type StreamManagementOptions } from './stream-management';
export interface ConnectionOptions {
    /**
     * Allows you to pass in cookies that will be included in HTTP requests.
     * Relevant to both the BOSH and Websocket transports.
     *
     * The passed in value must be a map of cookie names and string values.
     *
     * > { "myCookie": {
     * >     "value": "1234",
     * >     "domain": ".example.org",
     * >     "path": "/",
     * >     "expires": expirationDate
     * >     }
     * > }
     *
     * Note that cookies can't be set in this way for domains other than the one
     * that's hosting Strophe (i.e. cross-domain).
     * Those cookies need to be set under those domains, for example they can be
     * set server-side by making a XHR call to that domain to ask it to set any
     * necessary cookies.
     */
    cookies?: Cookies;
    /**
     * Allows you to specify the SASL authentication mechanisms that this
     * instance of Connection (and therefore your XMPP client) will support.
     *
     * The value must be an array of objects with {@link SASLMechanism}
     * prototypes.
     *
     * If nothing is specified, then the following mechanisms (and their
     * priorities) are registered:
     *
     *     Mechanism       Priority
     *     ------------------------
     *     SCRAM-SHA-512   72
     *     SCRAM-SHA-384   71
     *     SCRAM-SHA-256   70
     *     SCRAM-SHA-1     60
     *     PLAIN           50
     *     OAUTHBEARER     40
     *     X-OAUTH2        30
     *     ANONYMOUS       20
     *     EXTERNAL        10
     */
    mechanisms?: (new (...args: any[]) => SASLMechanism)[];
    /**
     * If `explicitResourceBinding` is set to `true`, then the XMPP client
     * needs to explicitly call {@link Connection.bind} once the XMPP
     * server has advertised the `urn:ietf:propertys:xml:ns:xmpp-bind` feature.
     *
     * Making this step explicit allows client authors to first finish other
     * stream related tasks, such as setting up an XEP-0198 Stream Management
     * session, before binding the JID resource for this session.
     */
    explicitResourceBinding?: boolean;
    /**
     * If `enableStreamManagement` is set to `true`, Strophe negotiates
     * XEP-0198 Stream Management on websocket connections.
     *
     * Defaults to `false`. Not available over BOSH. In combination with the
     * `worker` option, the SM session lives inside the shared worker (which
     * sees every tab's traffic) and the connection only mirrors its state.
     */
    enableStreamManagement?: boolean;
    /**
     * Fine-tuning options for XEP-0198 Stream Management — see
     * {@link StreamManagementOptions}. Only relevant together with
     * {@link ConnectionOptions.enableStreamManagement}.
     */
    streamManagement?: StreamManagementOptions;
    /**
     * _Note: This option is only relevant to Websocket connections, and not BOSH_
     *
     * If you want to connect to the current host with a WebSocket connection you
     * can tell Strophe to use WebSockets through the "protocol" option.
     * Valid values are `ws` for WebSocket and `wss` for Secure WebSocket.
     * So to connect to "wss://CURRENT_HOSTNAME/xmpp-websocket" you would call
     *
     *     const conn = new Strophe.Connection(
     *         "/xmpp-websocket/",
     *         {protocol: "wss"}
     *     );
     *
     * Note that relative URLs _NOT_ starting with a "/" will also include the path
     * of the current site.
     *
     * Also because downgrading security is not permitted by browsers, when using
     * relative URLs both BOSH and WebSocket connections will use their secure
     * variants if the current connection to the site is also secure (https).
     *
     * The `'component'` value selects the Node-only XEP-0114 external component
     * transport (see the `Component` class). It requires a `tcp://host:port`
     * service URL and is not available in the browser build.
     */
    protocol?: 'ws' | 'wss' | 'component';
    /**
     * _Note: This option is only relevant to Websocket connections, and not BOSH_
     *
     * Set this option to URL from where the shared worker script should be loaded.
     *
     * To run the websocket connection inside a shared worker.
     * This allows you to share a single websocket-based connection between
     * multiple Connection instances, for example one per browser tab.
     *
     * The script to use is `dist/shared-connection-worker.js`.
     */
    worker?: string;
    /**
     * Used to control whether BOSH HTTP requests will be made synchronously or not.
     * The default behaviour is asynchronous. If you want to make requests
     * synchronous, make "sync" evaluate to true.
     *
     * > const conn = new Strophe.Connection("/http-bind/", {sync: true});
     *
     * You can also toggle this on an already established connection.
     *
     * > conn.options.sync = true;
     */
    sync?: boolean;
    /**
     * Used to provide custom HTTP headers to be included in the BOSH HTTP requests.
     */
    customHeaders?: string[];
    /**
     * Used to instruct Strophe to maintain the current BOSH session across
     * interruptions such as webpage reloads.
     *
     * It will do this by caching the sessions tokens in sessionStorage, and when
     * "restore" is called it will check whether there are cached tokens with
     * which it can resume an existing session.
     */
    keepalive?: boolean;
    /**
     * Used to indicate wether cookies should be included in HTTP requests (by default
     * they're not).
     * Set this value to `true` if you are connecting to a BOSH service
     * and for some reason need to send cookies to it.
     * In order for this to work cross-domain, the server must also enable
     * credentials by setting the `Access-Control-Allow-Credentials` response header
     * to "true". For most usecases however this setting should be false (which
     * is the default).
     * Additionally, when using `Access-Control-Allow-Credentials`, the
     * `Access-Control-Allow-Origin` header can't be set to the wildcard "*", but
     * instead must be restricted to actual domains.
     */
    withCredentials?: boolean;
    /**
     * Used to change the default Content-Type, which is "text/xml; charset=utf-8".
     * Can be useful to reduce the amount of CORS preflight requests that are sent
     * to the server.
     */
    contentType?: string;
}
interface Password {
    name: string;
    ck: string;
    sk: string;
    iter: number;
    salt: string;
}
interface HandlerOptions {
    matchBareFromJid?: boolean;
    ignoreNamespaceFragment?: boolean;
}
interface SASLData {
    keys?: Record<string, unknown>;
    [key: string]: unknown;
}
type ProtocolErrorHandlers = {
    HTTP: Record<number, Function>;
    websocket: Record<number, Function>;
};
export type ConnectCallback = (status: number, condition: string | null, elem?: Element) => void;
/**
 * **XMPP Connection manager**
 *
 * This class is the main part of Strophe.  It manages a BOSH or websocket
 * connection to an XMPP server and dispatches events to the user callbacks
 * as data arrives.
 *
 * It supports various authentication mechanisms (e.g. SASL PLAIN, SASL SCRAM),
 * and more can be added via
 * {@link Connection#registerSASLMechanisms|registerSASLMechanisms()}.
 *
 * After creating a Connection object, the user will typically
 * call {@link Connection#connect|connect()} with a user supplied callback
 * to handle connection level events like authentication failure,
 * disconnection, or connection complete.
 *
 * The user will also have several event handlers defined by using
 * {@link Connection#addHandler|addHandler()} and
 * {@link Connection#addTimedHandler|addTimedHandler()}.
 * These will allow the user code to respond to interesting stanzas or do
 * something periodically with the connection. These handlers will be active
 * once authentication is finished.
 *
 * To send data to the connection, use {@link Connection#send|send()}.
 *
 * @memberof Strophe
 */
declare class Connection {
    service: string;
    options: ConnectionOptions;
    jid: string;
    domain: string | null;
    features: Element | null;
    _sasl_data: SASLData;
    do_bind: boolean;
    do_session: boolean;
    mechanisms: Record<string, SASLMechanism>;
    timedHandlers: TimedHandler[];
    handlers: Handler[];
    removeTimeds: TimedHandler[];
    removeHandlers: Handler[];
    addTimeds: TimedHandler[];
    addHandlers: Handler[];
    protocolErrorHandlers: ProtocolErrorHandlers;
    _idleTimeout: ReturnType<typeof setTimeout> | null;
    _disconnectTimeout: TimedHandler | null;
    authenticated: boolean;
    connected: boolean;
    disconnecting: boolean;
    do_authentication: boolean;
    paused: boolean;
    restored: boolean;
    /**
     * This connection's role in a shared-worker setup: the 'primary' tab
     * drives the stream, 'secondary' tabs share it. undefined outside worker
     * mode. Assigned by the worker (see {@link Connection#onRoleChanged}).
     */
    role?: 'primary' | 'secondary';
    _data: (Element | 'restart')[];
    _uniqueId: number;
    _sasl_success_handler: Handler | null;
    _sasl_failure_handler: Handler | null;
    _sasl_challenge_handler: Handler | null;
    maxRetries: number;
    iqFallbackHandler: Handler;
    authzid: string | null;
    authcid: string | null;
    pass: string | Password | null;
    scram_keys: Record<string, unknown> | null;
    connect_callback: ConnectCallback | null;
    disconnection_timeout: number;
    _proto: Transport;
    _sasl_mechanism: SASLMechanism | null;
    _requests: Request[];
    /**
     * The XEP-0198 Stream Management engine. Only present when the
     * `enableStreamManagement` option is set on a websocket connection.
     * Under the `worker` option this is a {@link StreamManagementMirror}:
     * the engine itself lives inside the shared worker and the mirror only
     * reflects the session state. Typed against the shared
     * {@link StreamManagementController} interface so the two are
     * interchangeable here.
     */
    sm?: StreamManagementController;
    _smHandlers: Handler[];
    /**
     * Create and initialize a {@link Connection} object.
     *
     * The transport-protocol for this connection will be chosen automatically
     * based on the given service parameter. URLs starting with "ws://" or
     * "wss://" will use WebSockets, URLs starting with "http://", "https://"
     * or without a protocol will use [BOSH](https://xmpp.org/extensions/xep-0124.html).
     *
     * To make Strophe connect to the current host you can leave out the protocol
     * and host part and just pass the path:
     *
     *  const conn = new Strophe.Connection("/http-bind/");
     *
     * @param service - The BOSH or WebSocket service URL.
     * @param options - A object containing configuration options
     */
    constructor(service: string, options?: ConnectionOptions);
    /**
     * Extends the Connection object with the given plugin.
     * @param name - The name of the extension.
     * @param ptype - The plugin's prototype.
     */
    static addConnectionPlugin(name: string, ptype: object): void;
    /**
     * Register an optional transport, selectable via the `protocol` connection
     * option. Used to plug in environment-specific transports (such as the
     * Node-only XEP-0114 component transport) without the core browser build
     * depending on them.
     * @param name - The `protocol` option value that selects this transport.
     * @param manager - The transport (protocol-manager) constructor.
     */
    static addProtocol(name: string, manager: new (connection: Connection) => Transport): void;
    /**
     * Select protocal based on this.options or this.service
     */
    setProtocol(): void;
    /**
     * Reset the connection.
     *
     * This function should be called after a connection is disconnected
     * before that connection is reused.
     */
    reset(): void;
    /**
     * @returns true if the current session was established by resuming a
     *     previous one via XEP-0198 Stream Management (in which case the
     *     previously bound resource is still valid and roster/presence
     *     state was retained by the server).
     */
    hasResumed(): boolean;
    /**
     * @returns true if a XEP-0198 Stream Management session is currently
     *     active (i.e. <enabled/> was received or a session was resumed).
     */
    isStreamManagementEnabled(): boolean;
    /**
     * Pause the request manager.
     *
     * This will prevent Strophe from sending any more requests to the
     * server.  This is very useful for temporarily pausing
     * BOSH-Connections while a lot of send() calls are happening quickly.
     * This causes Strophe to send the data in a single request, saving
     * many request trips.
     */
    pause(): void;
    /**
     * Resume the request manager.
     *
     * This resumes after pause() has been called.
     */
    resume(): void;
    /**
     * Generate a unique ID for use in <iq/> elements.
     *
     * All <iq/> stanzas are required to have unique id attributes.  This
     * function makes creating these easy.  Each connection instance has
     * a counter which starts from zero, and the value of this counter
     * plus a colon followed by the suffix becomes the unique id. If no
     * suffix is supplied, the counter is used as the unique id.
     *
     * Suffixes are used to make debugging easier when reading the stream
     * data, and their use is recommended.  The counter resets to 0 for
     * every new connection for the same reason.  For connections to the
     * same server that authenticate the same way, all the ids should be
     * the same, which makes it easy to see changes.  This is useful for
     * automated testing as well.
     *
     * @param suffix - A optional suffix to append to the id.
     * @returns A unique string to be used for the id attribute.
     */
    getUniqueId(suffix?: string | number): string;
    /**
     * Register a handler function for when a protocol (websocker or HTTP)
     * error occurs.
     *
     * NOTE: Currently only HTTP errors for BOSH requests are handled.
     * Patches that handle websocket errors would be very welcome.
     *
     * @example
     *  function onError(err_code){
     *    //do stuff
     *  }
     *
     *  const conn = Strophe.connect('http://example.com/http-bind');
     *  conn.addProtocolErrorHandler('HTTP', 500, onError);
     *  // Triggers HTTP 500 error and onError handler will be called
     *  conn.connect('user_jid@incorrect_jabber_host', 'secret', onConnect);
     *
     * @param protocol - 'HTTP' or 'websocket'
     * @param status_code - Error status code (e.g 500, 400 or 404)
     * @param callback - Function that will fire on Http error
     */
    addProtocolErrorHandler(protocol: 'HTTP' | 'websocket', status_code: number, callback: Function): void;
    /**
     * Starts the connection process.
     *
     * As the connection process proceeds, the user supplied callback will
     * be triggered multiple times with status updates.  The callback
     * should take two arguments - the status code and the error condition.
     *
     * The status code will be one of the values in the Strophe.Status
     * constants.  The error condition will be one of the conditions
     * defined in RFC 3920 or the condition 'strophe-parsererror'.
     *
     * The Parameters _wait_, _hold_ and _route_ are optional and only relevant
     * for BOSH connections. Please see XEP 124 for a more detailed explanation
     * of the optional parameters.
     *
     * @param jid - The user's JID.  This may be a bare JID,
     *     or a full JID.  If a node is not supplied, SASL OAUTHBEARER or
     *     SASL ANONYMOUS authentication will be attempted (OAUTHBEARER will
     *     process the provided password value as an access token).
     *   (String or Object) pass - The user's password, or an object containing
     *     the users SCRAM client and server keys, in a fashion described as follows:
     *
     *     { name: String, representing the hash used (eg. SHA-1),
     *       salt: String, base64 encoded salt used to derive the client key,
     *       iter: Int,    the iteration count used to derive the client key,
     *       ck:   String, the base64 encoding of the SCRAM client key
     *       sk:   String, the base64 encoding of the SCRAM server key
     *     }
     * @param pass - The user password
     * @param callback - The connect callback function.
     * @param wait - The optional HTTPBIND wait value.  This is the
     *     time the server will wait before returning an empty result for
     *     a request.  The default setting of 60 seconds is recommended.
     * @param hold - The optional HTTPBIND hold value.  This is the
     *     number of connections the server will hold at one time.  This
     *     should almost always be set to 1 (the default).
     * @param route - The optional route value.
     * @param authcid - The optional alternative authentication identity
     *     (username) if intending to impersonate another user.
     *     When using the SASL-EXTERNAL authentication mechanism, for example
     *     with client certificates, then the authcid value is used to
     *     determine whether an authorization JID (authzid) should be sent to
     *     the server. The authzid should NOT be sent to the server if the
     *     authzid and authcid are the same. So to prevent it from being sent
     *     (for example when the JID is already contained in the client
     *     certificate), set authcid to that same JID. See XEP-178 for more
     *     details.
     *  @param disconnection_timeout - The optional disconnection timeout
     *     in milliseconds before _doDisconnect will be called.
     */
    connect(jid: string, pass: string | Password, callback?: ConnectCallback, wait?: number, hold?: number, route?: string, authcid?: string, disconnection_timeout?: number): void;
    /**
     * Attach to an already created and authenticated BOSH session.
     *
     * This function is provided to allow Strophe to attach to BOSH
     * sessions which have been created externally, perhaps by a Web
     * application.  This is often used to support auto-login type features
     * without putting user credentials into the page.
     *
     * @param jid - The full JID that is bound by the session.
     * @param sid - The SID of the BOSH session.
     * @param rid - The current RID of the BOSH session.  This RID
     *     will be used by the next request.
     * @param callback - The connect callback function.
     * @param wait - The optional HTTPBIND wait value.  This is the
     *     time the server will wait before returning an empty result for
     *     a request.  The default setting of 60 seconds is recommended.
     *     Other settings will require tweaks to the Strophe.TIMEOUT value.
     * @param hold - The optional HTTPBIND hold value.  This is the
     *     number of connections the server will hold at one time.  This
     *     should almost always be set to 1 (the default).
     * @param wind - The optional HTTBIND window value.  This is the
     *     allowed range of request ids that are valid.  The default is 5.
     */
    attach(jid: string | ConnectCallback, sid?: string, rid?: number, callback?: ConnectCallback, wait?: number, hold?: number, wind?: number): void;
    /**
     * Attempt to restore a cached BOSH session.
     *
     * This function is only useful in conjunction with providing the
     * "keepalive":true option when instantiating a new {@link Connection}.
     *
     * When "keepalive" is set to true, Strophe will cache the BOSH tokens
     * RID (Request ID) and SID (Session ID) and then when this function is
     * called, it will attempt to restore the session from those cached
     * tokens.
     *
     * This function must therefore be called instead of connect or attach.
     *
     * For an example on how to use it, please see examples/restore.js
     *
     * @param jid - The user's JID.  This may be a bare JID or a full JID.
     * @param callback - The connect callback function.
     * @param wait - The optional HTTPBIND wait value.  This is the
     *     time the server will wait before returning an empty result for
     *     a request.  The default setting of 60 seconds is recommended.
     * @param hold - The optional HTTPBIND hold value.  This is the
     *     number of connections the server will hold at one time.  This
     *     should almost always be set to 1 (the default).
     * @param wind - The optional HTTBIND window value.  This is the
     *     allowed range of request ids that are valid.  The default is 5.
     */
    restore(jid?: string, callback?: ConnectCallback, wait?: number, hold?: number, wind?: number): void;
    /**
     * Checks whether sessionStorage and JSON are supported and whether we're
     * using BOSH.
     */
    _sessionCachingSupported(): boolean;
    /**
     * User overrideable function that receives XML data coming into the
     * connection.
     *
     * Due to limitations of current Browsers' XML-Parsers the opening and closing
     * <stream> tag for WebSocket-Connoctions will be passed as selfclosing here.
     *
     * BOSH-Connections will have all stanzas wrapped in a <body> tag. See
     * <Bosh.strip> if you want to strip this tag.
     *
     * @param _elem - The XML data received by the connection.
     */
    xmlInput(_elem: Node | MessageEvent): void;
    /**
     * User overrideable function that receives XML data sent to the
     * connection.
     *
     * Due to limitations of current Browsers' XML-Parsers the opening and closing
     * <stream> tag for WebSocket-Connoctions will be passed as selfclosing here.
     *
     * BOSH-Connections will have all stanzas wrapped in a <body> tag. See
     * <Bosh.strip> if you want to strip this tag.
     *
     * @param _elem - The XMLdata sent by the connection.
     */
    xmlOutput(_elem: Element): void;
    /**
     * User overrideable function that receives raw data coming into the
     * connection.
     *
     * @param _data - The data received by the connection.
     */
    rawInput(_data: string): void;
    /**
     * User overrideable function that receives raw data sent to the
     * connection.
     *
     * @param _data - The data sent by the connection.
     */
    rawOutput(_data: string): void;
    /**
     * User overrideable function that receives the new valid rid.
     *
     * @param _rid - The next valid rid
     */
    nextValidRid(_rid: number): void;
    /**
     * User overrideable function that receives the new role of this
     * connection in a shared-worker setup.
     *
     * Called when the shared worker assigns or changes this tab's role,
     * for example when this tab is promoted to 'primary' after the previous
     * primary tab went away.
     *
     * @param _role - The new role ('primary' or 'secondary')
     */
    onRoleChanged(_role: 'primary' | 'secondary'): void;
    /**
     * User overrideable function that receives message and presence stanzas
     * sent by *another* tab sharing this connection (via the `worker`
     * option), so every tab can render what any tab sent.
     *
     * Deliberately separate from the inbound handler pipeline: these stanzas
     * were sent, not received, so they must not trigger stanza handlers.
     * IQs are not reflected — they are request/response traffic private to
     * the sending tab.
     *
     * @param _elem - The sent stanza.
     */
    onForeignStanzaSent(_elem: Element): void;
    /**
     * Send a stanza.
     *
     * This function is called to push data onto the send queue to
     * go out over the wire.  Whenever a request is sent to the BOSH
     * server, all pending data is sent and the queue is flushed.
     *
     * @param stanza - The stanza to send
     */
    send(stanza: Element | Builder | (Element | Builder)[]): void;
    /**
     * Immediately send any pending outgoing data.
     *
     * Normally send() queues outgoing data until the next idle period
     * (100ms), which optimizes network use in the common cases when
     * several send()s are called in succession. flush() can be used to
     * immediately send all pending data.
     */
    flush(): void;
    /**
     * Helper function to send presence stanzas. The main benefit is for
     * sending presence stanzas for which you expect a responding presence
     * stanza with the same id (for example when leaving a chat room).
     *
     * @param stanza - The stanza to send.
     * @param callback - The callback function for a successful request.
     * @param errback - The callback function for a failed or timed
     *    out request.  On timeout, the stanza will be null.
     * @param timeout - The time specified in milliseconds for a
     *    timeout to occur.
     * @return The id used to send the presence.
     */
    sendPresence(stanza: Element | Builder, callback?: (stanza: Element) => void, errback?: (stanza: Element | null) => void, timeout?: number): string;
    /**
     * Helper function to send IQ stanzas.
     *
     * @param stanza - The stanza to send.
     * @param callback - The callback function for a successful request.
     * @param errback - The callback function for a failed or timed
     *     out request.  On timeout, the stanza will be null.
     * @param timeout - The time specified in milliseconds for a
     *     timeout to occur.
     * @return The id used to send the IQ.
     */
    sendIQ(stanza: Element | Builder, callback?: (stanza: Element) => void, errback?: (stanza: Element | null) => void, timeout?: number): string;
    /**
     * Queue outgoing data for later sending.  Also ensures that the data
     * is a DOMElement.
     * @private
     * @param element
     */
    _queueData(element: Element): void;
    /**
     * Send an xmpp:restart stanza.
     * @private
     */
    _sendRestart(): void;
    /**
     * Add a timed handler to the connection.
     *
     * This function adds a timed handler.  The provided handler will
     * be called every period milliseconds until it returns false,
     * the connection is terminated, or the handler is removed.  Handlers
     * that wish to continue being invoked should return true.
     *
     * Because of method binding it is necessary to save the result of
     * this function if you wish to remove a handler with
     * deleteTimedHandler().
     *
     * Note that user handlers are not active until authentication is
     * successful.
     *
     * @param period - The period of the handler.
     * @param handler - The callback function.
     * @return A reference to the handler that can be used to remove it.
     */
    addTimedHandler(period: number, handler: () => boolean): TimedHandler;
    /**
     * Delete a timed handler for a connection.
     *
     * This function removes a timed handler from the connection.  The
     * handRef parameter is *not* the function passed to addTimedHandler(),
     * but is the reference returned from addTimedHandler().
     * @param handRef - The handler reference.
     */
    deleteTimedHandler(handRef: TimedHandler): void;
    /**
     * Add a stanza handler for the connection.
     *
     * This function adds a stanza handler to the connection.  The
     * handler callback will be called for any stanza that matches
     * the parameters.  Note that if multiple parameters are supplied,
     * they must all match for the handler to be invoked.
     *
     * The handler will receive the stanza that triggered it as its argument.
     * *The handler should return true if it is to be invoked again;
     * returning false will remove the handler after it returns.*
     *
     * As a convenience, the ns parameters applies to the top level element
     * and also any of its immediate children.  This is primarily to make
     * matching /iq/query elements easy.
     *
     * ### Options
     *
     * With the options argument, you can specify boolean flags that affect how
     * matches are being done.
     *
     * Currently two flags exist:
     *
     * * *matchBareFromJid*:
     *     When set to true, the from parameter and the
     *     from attribute on the stanza will be matched as bare JIDs instead
     *     of full JIDs. To use this, pass {matchBareFromJid: true} as the
     *     value of options. The default value for matchBareFromJid is false.
     *
     * * *ignoreNamespaceFragment*:
     *     When set to true, a fragment specified on the stanza's namespace
     *     URL will be ignored when it's matched with the one configured for
     *     the handler.
     *
     *     This means that if you register like this:
     *
     *     >   connection.addHandler(
     *     >       handler,
     *     >       'http://jabber.org/protocol/muc',
     *     >       null, null, null, null,
     *     >       {'ignoreNamespaceFragment': true}
     *     >   );
     *
     *     Then a stanza with XML namespace of
     *     'http://jabber.org/protocol/muc#user' will also be matched. If
     *     'ignoreNamespaceFragment' is false, then only stanzas with
     *     'http://jabber.org/protocol/muc' will be matched.
     *
     * ### Deleting the handler
     *
     * The return value should be saved if you wish to remove the handler
     * with `deleteHandler()`.
     *
     * @param handler - The user callback.
     * @param ns - The namespace to match.
     * @param name - The stanza name to match.
     * @param type - The stanza type (or types if an array) to match.
     * @param id - The stanza id attribute to match.
     * @param from - The stanza from attribute to match.
     * @param options - The handler options
     * @return A reference to the handler that can be used to remove it.
     */
    addHandler(handler: (stanza: Element) => boolean, ns: string | null, name: string | null, type: string | string[] | null, id?: string | null, from?: string | null, options?: HandlerOptions): Handler;
    /**
     * Delete a stanza handler for a connection.
     *
     * This function removes a stanza handler from the connection.  The
     * handRef parameter is *not* the function passed to addHandler(),
     * but is the reference returned from addHandler().
     *
     * @param handRef - The handler reference.
     */
    deleteHandler(handRef: Handler): void;
    /**
     * Register the SASL mechanisms which will be supported by this instance of
     * Connection (i.e. which this XMPP client will support).
     * @param mechanisms - Array of objects with SASLMechanism prototypes
     */
    registerSASLMechanisms(mechanisms?: (new (...args: any[]) => SASLMechanism)[]): void;
    /**
     * Register a single SASL mechanism, to be supported by this client.
     * @param Mechanism - Object with a Strophe.SASLMechanism prototype
     */
    registerSASLMechanism(Mechanism: any): void;
    /**
     * Start the graceful disconnection process.
     *
     * This function starts the disconnection process.  This process starts
     * by sending unavailable presence and sending BOSH body of type
     * terminate.  A timeout handler makes sure that disconnection happens
     * even if the BOSH server does not respond.
     * If the Connection object isn't connected, at least tries to abort all pending requests
     * so the connection object won't generate successful requests (which were already opened).
     *
     * The user supplied connection callback will be notified of the
     * progress as this process happens.
     *
     * @param reason - The reason the disconnect is occuring.
     */
    disconnect(reason?: string): void;
    /**
     * _Private_ helper function that makes sure plugins and the user's
     * callback are notified of connection status changes.
     * @param status - the new connection status, one of the values
     *     in Strophe.Status
     * @param condition - the error condition
     * @param elem - The triggering stanza.
     */
    _changeConnectStatus(status: number, condition?: string | null, elem?: Element): void;
    /**
     * _Private_ function to disconnect.
     *
     * This is the last piece of the disconnection logic.  This resets the
     * connection and alerts the user's connection callback.
     * @param condition - the error condition
     */
    _doDisconnect(condition?: string | null): void;
    /**
     * _Private_ handler to processes incoming data from the the connection.
     *
     * Except for _connect_cb handling the initial connection request,
     * this function handles the incoming data for all requests.  This
     * function also fires stanza handlers that match each incoming
     * stanza.
     * @param req - The request that has data ready.
     * @param raw - The stanza as raw string.
     */
    _dataRecv(req: Element | Request, raw?: string): void;
    /**
     * _Private_ handler for initial connection request.
     *
     * This handler is used to process the initial connection request
     * response from the BOSH server. It is used to set up authentication
     * handlers and start the authentication process.
     *
     * SASL authentication will be attempted if available, otherwise
     * the code will fall back to legacy authentication.
     *
     * @param req - The current request.
     * @param _callback - low level (xmpp) connect callback function.
     *     Useful for plugins with their own xmpp connect callback (when they
     *     want to do something special).
     * @param raw - The stanza as raw string.
     */
    _connect_cb(req: Element | Request, _callback?: ConnectCallback, raw?: string): void;
    /**
     * Sorts an array of objects with prototype SASLMechanism according to
     * their priorities.
     * @param mechanisms - Array of SASL mechanisms.
     */
    sortMechanismsByPriority(mechanisms: SASLMechanism[]): SASLMechanism[];
    /**
     * Set up authentication
     *
     * Continues the initial connection request by setting up authentication
     * handlers and starting the authentication process.
     *
     * SASL authentication will be attempted if available, otherwise
     * the code will fall back to legacy authentication.
     *
     * @param matched - Array of SASL mechanisms supported.
     */
    authenticate(matched: SASLMechanism[]): void;
    /**
     * Iterate through an array of SASL mechanisms and attempt authentication
     * with the highest priority (enabled) mechanism.
     *
     * @private
     * @param mechanisms - Array of SASL mechanisms.
     * @return mechanism_found - true or false, depending on whether a
     *  valid SASL mechanism was found with which authentication could be started.
     */
    _attemptSASLAuth(mechanisms?: SASLMechanism[]): boolean;
    /**
     * _Private_ handler for the SASL challenge
     * @private
     * @param elem
     */
    _sasl_challenge_cb(elem: Element): Promise<boolean>;
    /**
     * Attempt legacy (i.e. non-SASL) authentication.
     * @private
     */
    _attemptLegacyAuth(): void;
    /**
     * _Private_ handler for legacy authentication.
     *
     * This handler is called in response to the initial <iq type='get'/>
     * for legacy authentication.  It builds an authentication <iq/> and
     * sends it, creating a handler (calling back to _auth2_cb()) to
     * handle the result
     * @private
     * @return `false` to remove the handler.
     */
    _onLegacyAuthIQResult(): boolean;
    /**
     * _Private_ handler for succesful SASL authentication.
     * @private
     * @param elem - The matching stanza.
     * @return `false` to remove the handler.
     */
    _sasl_success_cb(elem: Element): boolean;
    /**
     * @private
     * @param elem - The matching stanza.
     * @return `false` to remove the handler.
     */
    _onStreamFeaturesAfterSASL(elem: Element): boolean;
    /**
     * Continue the connect flow with resource binding, once it is clear no
     * XEP-0198 resumption will happen (no SM support, no resumable state, a
     * failed <resume/>, or the shared worker reporting _smNoState).
     */
    _proceedToBind(): void;
    /**
     * Register the XEP-0198 nonza handlers (idempotently)
     * They are system handlers, so they run before authentication completes,
     * which the resume flow requires.
     */
    _registerSMHandlers(): void;
    /**
     * _Private_ handler for a successful XEP-0198 stream resumption.
     *
     * The engine reconciles the server's 'h' and re-sends whatever the
     * server didn't acknowledge.
     *
     * The connection state is restored, `this.jid` is set back to the JID that
     * was bound when the SM session was established, *before* CONNECTED is emitted,
     * so no stanza can ever be stamped with a resource the server doesn't know.
     * @param elem - The <resumed/> nonza.
     * @return `true` to keep the handler.
     */
    _onStreamResumed(elem: Element): boolean;
    /**
     * _Private_ handler for a failed <enable/> or <resume/>.
     *
     * The engine resets its state; after a failed *resumption* it also
     * salvages the unacked queue (re-sent once a fresh session reaches
     * <enabled/>), and the connection falls back to binding a resource on
     * this same stream, per XEP-0198 ("the server SHOULD allow the client
     * to bind a resource at this point"). A refused <enable/> needs neither:
     * the stream is alive and bound, it just runs without SM.
     * @param elem - The <failed/> nonza.
     * @return `true` to keep the handler.
     */
    _onStreamResumptionFailed(elem: Element): boolean;
    /**
     * Called at the CONNECTED-emission points of the connect flow, just
     * before CONNECTED is emitted i.e. once the full JID is final (resource
     * bound, legacy session established, or legacy auth completed).
     *
     * Under the `worker` option the bound JID is always reported to the
     * shared worker — with or without Stream Management — so it can hand the
     * right JID to attaching tabs, release joins parked on the handshake,
     * and (when this stream's features advertised SM) start a fresh SM
     * session itself (it answers with _smEnabled, which updates the mirror).
     *
     * Otherwise, if the server supports XEP-0198 and nothing was resumed,
     * a fresh SM session is started from here. The XEP allows <enable/> any
     * time after binding.
     */
    _onSessionReady(): void;
    /**
     * Sends an IQ to the XMPP server to bind a JID resource for this session.
     *
     * https://tools.ietf.org/html/rfc6120#section-7.5
     *
     * If `explicitResourceBinding` was set to a truthy value in the options
     * passed to the Connection constructor, then this function needs
     * to be called explicitly by the client author.
     *
     * Otherwise it'll be called automatically as soon as the XMPP server
     * advertises the "urn:ietf:params:xml:ns:xmpp-bind" stream feature.
     */
    bind(): void;
    /**
     * _Private_ handler for binding result and session start.
     * @private
     * @param elem - The matching stanza.
     * @return `false` to remove the handler.
     */
    _onResourceBindResultIQ(elem: Element): boolean;
    /**
     * Send IQ request to establish a session with the XMPP server.
     *
     * See https://xmpp.org/rfcs/rfc3921.html#session
     *
     * Note: The protocol for session establishment has been determined as
     * unnecessary and removed in RFC-6121.
     * @private
     */
    _establishSession(): void;
    /**
     * _Private_ handler for the server's IQ response to a client's session
     * request.
     *
     * This sets Connection.authenticated to true on success, which
     * starts the processing of user handlers.
     *
     * See https://xmpp.org/rfcs/rfc3921.html#session
     *
     * Note: The protocol for session establishment has been determined as
     * unnecessary and removed in RFC-6121.
     * @private
     * @param elem - The matching stanza.
     * @return `false` to remove the handler.
     */
    _onSessionResultIQ(elem: Element): boolean;
    /**
     * _Private_ handler for SASL authentication failure.
     * @param elem - The matching stanza.
     * @return `false` to remove the handler.
     */
    _sasl_failure_cb(elem: Element | null): boolean;
    /**
     * _Private_ handler to finish legacy authentication.
     *
     * This handler is called when the result from the jabber:iq:auth
     * <iq/> stanza is returned.
     * @private
     * @param elem - The stanza that triggered the callback.
     * @return `false` to remove the handler.
     */
    _auth2_cb(elem: Element): boolean;
    /**
     * _Private_ function to add a system level timed handler.
     *
     * This function is used to add a TimedHandler for the
     * library code.  System timed handlers are allowed to run before
     * authentication is complete.
     * @param period - The period of the handler.
     * @param handler - The callback function.
     */
    _addSysTimedHandler(period: number, handler: () => boolean): TimedHandler;
    /**
     * _Private_ function to add a system level stanza handler.
     *
     * This function is used to add a Handler for the
     * library code.  System stanza handlers are allowed to run before
     * authentication is complete.
     * @param handler - The callback function.
     * @param ns - The namespace to match.
     * @param name - The stanza name to match.
     * @param type - The stanza type attribute to match.
     * @param id - The stanza id attribute to match.
     */
    _addSysHandler(handler: (stanza: Element) => boolean, ns: string | null, name: string | null, type: string | null, id: string | null): Handler;
    /**
     * _Private_ timeout handler for handling non-graceful disconnection.
     *
     * If the graceful disconnect process does not complete within the
     * time allotted, this handler finishes the disconnect anyway.
     * @return `false` to remove the handler.
     */
    _onDisconnectTimeout(): boolean;
    /**
     * (Re)arm the idle loop.
     *
     * Cancels any pending idle tick and schedules the next call to
     * {@link Connection#_onIdle}. `_onIdle` re-arms itself while connected, so
     * this only needs to be called to (re)start the loop: at construction, on a
     * stream restart, or when a transport becomes connected without having gone
     * through the send path (e.g. a receive-only component after its handshake).
     * @private
     */
    _scheduleIdle(): void;
    /**
     * _Private_ handler to process events during idle cycle.
     *
     * This handler is called every 100ms to fire timed handlers that
     * are ready and keep poll requests going.
     */
    _onIdle(): void;
}
export default Connection;
//# sourceMappingURL=connection.d.ts.map