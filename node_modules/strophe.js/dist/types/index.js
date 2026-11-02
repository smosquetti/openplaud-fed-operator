import * as utils from './utils';
import Bosh from './transports/bosh';
import Builder, { $build, $msg, $pres, $iq } from './builder';
import Connection from './connection';
import Handler from './handler';
import Request from './request';
import SASLAnonymous from './sasl-anon';
import SASLExternal from './sasl-external';
import SASLMechanism from './sasl';
import SASLOAuthBearer from './sasl-oauthbearer';
import SASLPlain from './sasl-plain';
import SASLSHA1 from './sasl-sha1';
import SASLSHA256 from './sasl-sha256';
import SASLSHA384 from './sasl-sha384';
import SASLSHA512 from './sasl-sha512';
import SASLXOAuth2 from './sasl-xoauth2';
import StreamManagement, { MemoryStorageBackend, SessionStorageBackend, StreamManagementMirror } from './stream-management';
import TimedHandler from './timed-handler';
import Websocket from './transports/websocket';
import WorkerWebsocket from './transports/worker-websocket';
import log from './log';
import { ElementType, ErrorCondition, LOG_LEVELS, NS, Status, XHTML } from './constants';
import { stx, Stanza } from './stanza';
const Strophe = Object.assign(Object.assign(Object.assign({ VERSION: '4.0.0', get TIMEOUT() {
        return Bosh.getTimeoutMultplier();
    },
    set TIMEOUT(n) {
        Bosh.setTimeoutMultiplier(n);
    },
    get SECONDARY_TIMEOUT() {
        return Bosh.getSecondaryTimeoutMultplier();
    },
    set SECONDARY_TIMEOUT(n) {
        Bosh.setSecondaryTimeoutMultiplier(n);
    } }, utils), log), { Request,
    Bosh,
    Websocket,
    WorkerWebsocket,
    Connection,
    Handler,
    SASLAnonymous,
    SASLPlain,
    SASLSHA1,
    SASLSHA256,
    SASLSHA384,
    SASLSHA512,
    SASLOAuthBearer,
    SASLExternal,
    SASLXOAuth2,
    Stanza,
    StreamManagement,
    MemoryStorageBackend,
    SessionStorageBackend,
    Builder,
    ElementType,
    ErrorCondition, LogLevel: LOG_LEVELS, NS,
    SASLMechanism,
    Status,
    TimedHandler, XHTML: Object.assign(Object.assign({}, XHTML), { validTag: utils.validTag, validCSS: utils.validCSS, validAttribute: utils.validAttribute }), serialize(elem) {
        return Builder.serialize(elem);
    },
    setLogLevel(level) {
        log.setLogLevel(level);
    },
    addNamespace(name, value) {
        Strophe.NS[name] = value;
    },
    addConnectionPlugin(name, ptype) {
        Connection.addConnectionPlugin(name, ptype);
    } });
globalThis.$build = $build;
globalThis.$iq = $iq;
globalThis.$msg = $msg;
globalThis.$pres = $pres;
globalThis.Strophe = Strophe;
globalThis.stx = stx;
const toStanza = Stanza.toElement;
globalThis.toStanza = Stanza.toElement;
export { Builder, $build, $iq, $msg, $pres, Strophe, Stanza, stx, toStanza, Request, StreamManagement, StreamManagementMirror, MemoryStorageBackend, SessionStorageBackend, };
