declare const _NS: {
    readonly AUTH: "jabber:iq:auth";
    readonly BIND: "urn:ietf:params:xml:ns:xmpp-bind";
    readonly BOSH: "urn:xmpp:xbosh";
    readonly CLIENT: "jabber:client";
    readonly COMPONENT: "jabber:component:accept"; /** XEP-0114 */
    readonly DISCO_INFO: "http://jabber.org/protocol/disco#info";
    readonly DISCO_ITEMS: "http://jabber.org/protocol/disco#items";
    readonly DELAY: "urn:xmpp:delay"; /** XEP-0203 */
    readonly FRAMING: "urn:ietf:params:xml:ns:xmpp-framing";
    readonly HTTPBIND: "http://jabber.org/protocol/httpbind";
    readonly MUC: "http://jabber.org/protocol/muc";
    readonly PROFILE: "jabber:iq:profile";
    readonly ROSTER: "jabber:iq:roster";
    readonly SASL: "urn:ietf:params:xml:ns:xmpp-sasl";
    readonly SERVER: "jabber:server";
    readonly SESSION: "urn:ietf:params:xml:ns:xmpp-session";
    readonly SM: "urn:xmpp:sm:3";
    readonly STANZAS: "urn:ietf:params:xml:ns:xmpp-stanzas";
    readonly STREAM: "http://etherx.jabber.org/streams";
    readonly VERSION: "jabber:iq:version";
    readonly XHTML: "http://www.w3.org/1999/xhtml";
    readonly XHTML_IM: "http://jabber.org/protocol/xhtml-im";
};
/**
 * Common namespace constants from the XMPP RFCs and XEPs.
 * Extensible at runtime via {@link Strophe.addNamespace}, hence the string
 * index signature.
 */
export declare const NS: typeof _NS & Record<string, string>;
export declare const PARSE_ERROR_NS = "http://www.w3.org/1999/xhtml";
/**
 * The version of the page↔worker message protocol spoken between
 * WorkerWebsocket and dist/shared-connection-worker.js. A SharedWorker can
 * outlive the pages that spawned it, so after a deploy a freshly loaded page
 * may attach to a worker from an older build (or vice versa). The version is
 * exchanged on _connect/_attach so that a mismatch fails loudly instead of
 * silently misbehaving.
 */
export declare const SHARED_WORKER_PROTOCOL_VERSION = 3;
/**
 * Contains allowed tags, tag attributes, and css properties.
 * Used in the {@link Strophe.createHtml} function to filter incoming html into the allowed XHTML-IM subset.
 * See [XEP-0071](http://xmpp.org/extensions/xep-0071.html#profile-summary) for the list of recommended
 * allowed tags and their attributes.
 */
export declare const XHTML: {
    tags: string[];
    attributes: {
        a: string[];
        blockquote: string[];
        br: never[];
        cite: string[];
        em: never[];
        img: string[];
        li: string[];
        ol: string[];
        p: string[];
        span: string[];
        strong: never[];
        ul: string[];
        body: never[];
    };
    css: string[];
};
export type ConnStatus = number;
/**
 * Connection status constants for use by the connection handler
 * callback.
 */
export declare const Status: {
    readonly ERROR: 0;
    readonly CONNECTING: 1;
    readonly CONNFAIL: 2;
    readonly AUTHENTICATING: 3;
    readonly AUTHFAIL: 4;
    readonly CONNECTED: 5;
    readonly DISCONNECTED: 6;
    readonly DISCONNECTING: 7;
    readonly ATTACHED: 8;
    readonly REDIRECT: 9;
    readonly CONNTIMEOUT: 10;
    readonly BINDREQUIRED: 11;
    readonly ATTACHFAIL: 12;
    readonly RECONNECTING: 13;
};
export declare const ErrorCondition: {
    readonly BAD_FORMAT: "bad-format";
    readonly CONFLICT: "conflict";
    readonly MISSING_JID_NODE: "x-strophe-bad-non-anon-jid";
    readonly NO_AUTH_MECH: "no-auth-mech";
    readonly UNKNOWN_REASON: "unknown";
};
/**
 * Logging level indicators.
 */
export type LogLevel = 0 | 1 | 2 | 3 | 4;
export type LogLevelName = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
export type LogLevels = Record<LogLevelName, LogLevel>;
export declare const LOG_LEVELS: LogLevels;
/**
 * DOM element types.
 *
 * - ElementType.NORMAL - Normal element.
 * - ElementType.TEXT - Text data element.
 * - ElementType.FRAGMENT - XHTML fragment element.
 */
export declare const ElementType: {
    readonly NORMAL: 1;
    readonly TEXT: 3;
    readonly CDATA: 4;
    readonly FRAGMENT: 11;
};
export {};
//# sourceMappingURL=constants.d.ts.map