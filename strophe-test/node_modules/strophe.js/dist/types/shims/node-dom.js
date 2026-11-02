/**
 * Node.js DOM shim.
 *
 * Browsers provide `DOMParser`, `XMLSerializer` and a `document` natively;
 * Node.js does not. The Node build therefore wires up `@xmldom/xmldom`, a
 * small, pure-JS, XML-only W3C DOM, together with the `ws` WebSocket.
 *
 * It is imported for its side effects by the Node entry point (see
 * `index-node.ts`) before any Connection is created, and is never part of the
 * browser build.
 *
 * Two thin compatibility shims bridge the gaps between `@xmldom/xmldom` and the
 * browser DOM that Strophe's shared code assumes:
 *
 *  - `firstElementChild`: `@xmldom/xmldom` does not implement this `ParentNode`
 *    getter, so it is polyfilled from the child nodes.
 *  - parse errors: browsers return a document whose root is a `<parsererror>`
 *    element for malformed input, whereas `@xmldom/xmldom` throws. `DOMParser`
 *    is wrapped to restore the browser behaviour, which is what
 *    {@link getParserError} and the BOSH/WebSocket parse paths expect.
 */
import ws from 'ws';
import { DOMParser as XmlDOMParser, XMLSerializer, DOMImplementation } from '@xmldom/xmldom';
import { PARSE_ERROR_NS } from '../constants';
const domImplementation = new DOMImplementation();
globalThis.WebSocket = ws;
globalThis.XMLSerializer = XMLSerializer;
// `xmlGenerator()` only ever calls `document.implementation.createDocument(...)`,
// so an empty document is the entire global `document` surface Strophe needs.
globalThis.document = domImplementation.createDocument(null, null, null);
// --- DOM API polyfills -----------------------------------------------------
// `@xmldom/xmldom` omits a couple of browser DOM APIs that Strophe's shared code
// assumes. Add them to xmldom's Element/Document prototypes, grabbed off a
// sample tree, so the rest of the library stays browser-idiomatic.
const sample = domImplementation.createDocument(null, 'sample', null);
const elementProto = Object.getPrototypeOf(sample.documentElement);
const documentProto = Object.getPrototypeOf(sample);
// `ParentNode.firstElementChild`: the first child whose nodeType is ELEMENT_NODE.
for (const proto of [elementProto, documentProto]) {
    if (proto && !('firstElementChild' in proto)) {
        Object.defineProperty(proto, 'firstElementChild', {
            configurable: true,
            get() {
                var _a;
                let node = this.firstChild;
                while (node && node.nodeType !== 1) {
                    node = node.nextSibling;
                }
                return (_a = node) !== null && _a !== void 0 ? _a : null;
            },
        });
    }
}
// `Element.innerHTML`: used by Builder.h() for XHTML-IM. jsdom parsed this as
// HTML; a lightweight XML DOM cannot, but XHTML-IM payloads are well-formed XML
// by definition, so parse the assigned markup as XML. Malformed input leaves the
// element empty rather than throwing (Builder.h() then produces no XHTML body).
// The getter serialises the children back, escaping text as XML.
if (elementProto && !('innerHTML' in elementProto)) {
    Object.defineProperty(elementProto, 'innerHTML', {
        configurable: true,
        get() {
            const serializer = new XMLSerializer();
            let out = '';
            for (let i = 0; i < this.childNodes.length; i++) {
                out += serializer.serializeToString(this.childNodes[i]);
            }
            return out;
        },
        set(html) {
            while (this.firstChild) {
                this.removeChild(this.firstChild);
            }
            let root;
            try {
                const doc = new XmlDOMParser({
                    onError: (level, message) => {
                        if (level === 'fatalError') {
                            throw new Error(typeof message === 'string' ? message : String(message));
                        }
                    },
                }).parseFromString(`<xhtml>${html}</xhtml>`, 'text/xml');
                root = doc.documentElement;
            }
            catch (_a) {
                return;
            }
            if (root) {
                while (root.firstChild) {
                    this.appendChild(root.firstChild);
                }
            }
        },
    });
}
// --- DOMParser parse-error compatibility -----------------------------------
// Browsers return a document rooted at a `<parsererror>` element on malformed
// XML; `@xmldom/xmldom` throws instead. Wrap it so downstream code keeps seeing
// the browser shape.
class DOMParser {
    parseFromString(source, mimeType) {
        var _a;
        try {
            const parser = new XmlDOMParser({
                onError: (level, message) => {
                    if (level === 'fatalError') {
                        throw new Error(typeof message === 'string' ? message : String(message));
                    }
                },
            });
            return parser.parseFromString(source, mimeType);
        }
        catch (e) {
            const doc = domImplementation.createDocument(PARSE_ERROR_NS, 'parsererror', null);
            (_a = doc.documentElement) === null || _a === void 0 ? void 0 : _a.appendChild(doc.createTextNode(e.message));
            return doc;
        }
    }
}
globalThis.DOMParser = DOMParser;
