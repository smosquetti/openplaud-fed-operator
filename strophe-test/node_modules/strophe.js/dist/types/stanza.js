var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _Stanza_string, _Stanza_strings, _Stanza_values;
import Builder from './builder';
import log from './log';
import { getFirstElementChild, getParserError, stripWhitespace, xmlHtmlNode, xmlescape } from './utils';
export class UnsafeXML extends String {
}
/**
 * A Stanza represents a XML element used in XMPP (commonly referred to as stanzas).
 */
export class Stanza extends Builder {
    /**
     * @param strings
     * @param values
     */
    constructor(strings, values) {
        super('stanza');
        _Stanza_string.set(this, void 0);
        _Stanza_strings.set(this, void 0);
        _Stanza_values.set(this, void 0);
        __classPrivateFieldSet(this, _Stanza_strings, strings, "f");
        __classPrivateFieldSet(this, _Stanza_values, values, "f");
    }
    /**
     * A directive which can be used to pass a string of XML as a value to the
     * stx tagged template literal.
     *
     * It's considered "unsafe" because it can pose a security risk if used with
     * untrusted input.
     *
     * @param string
     * @returns
     * @example
     *    const status = '<status>I am busy!</status>';
     *    const pres = stx`
     *       <presence from='juliet@example.com/chamber' id='pres1'>
     *           <show>dnd</show>
     *           ${unsafeXML(status)}
     *       </presence>`;
     *    connection.send(pres);
     */
    static unsafeXML(string) {
        return new UnsafeXML(string);
    }
    /**
     * Turns the passed-in string into an XML Element.
     * @param string
     * @param throwErrorIfInvalidNS
     * @returns
     */
    static toElement(string, throwErrorIfInvalidNS) {
        const doc = xmlHtmlNode(string);
        const parserError = getParserError(doc);
        if (parserError) {
            throw new Error(`Parser Error: ${parserError}`);
        }
        const node = stripWhitespace(getFirstElementChild(doc));
        if (['message', 'iq', 'presence'].includes(node.nodeName.toLowerCase()) &&
            node.namespaceURI !== 'jabber:client' &&
            node.namespaceURI !== 'jabber:server') {
            const err_msg = `Invalid namespaceURI ${node.namespaceURI}`;
            if (throwErrorIfInvalidNS) {
                throw new Error(err_msg);
            }
            else {
                log.error(err_msg);
            }
        }
        return node;
    }
    buildTree() {
        return Stanza.toElement(this.toString(), true);
    }
    /**
     * @returns
     */
    toString() {
        __classPrivateFieldSet(this, _Stanza_string, __classPrivateFieldGet(this, _Stanza_string, "f") ||
            __classPrivateFieldGet(this, _Stanza_strings, "f")
                .reduce((acc, str, idx) => {
                const value = __classPrivateFieldGet(this, _Stanza_values, "f").length > idx ? __classPrivateFieldGet(this, _Stanza_values, "f")[idx] : '';
                return (acc +
                    str +
                    (Array.isArray(value)
                        ? value
                            .map((v) => v instanceof UnsafeXML || v instanceof Builder
                            ? v
                            : xmlescape(v.toString()))
                            .join('')
                        : value instanceof UnsafeXML || value instanceof Builder
                            ? value
                            : xmlescape((value !== null && value !== void 0 ? value : '').toString())));
            }, '')
                .trim(), "f");
        return __classPrivateFieldGet(this, _Stanza_string, "f");
    }
}
_Stanza_string = new WeakMap(), _Stanza_strings = new WeakMap(), _Stanza_values = new WeakMap();
/**
 * Tagged template literal function which generates {@link Stanza} objects
 *
 * @example
 *      const pres = stx`<presence type="${type}" xmlns="jabber:client"><show>${show}</show></presence>`
 *
 *      connection.send(msg);
 *
 * @example
 *      const msg = stx`<message
 *          from='sender@example.org'
 *          id='hgn27af1'
 *          to='recipient@example.org'
 *          type='chat'>
 *          <body>Hello world</body>
 *      </message>`;
 *
 *      connection.send(msg);
 *
 * @param strings
 * @param values
 * @returns
 */
export function stx(strings, ...values) {
    return new Stanza(strings, values);
}
