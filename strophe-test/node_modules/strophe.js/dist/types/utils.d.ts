export type XHTMLAttrs = 'a' | 'blockquote' | 'br' | 'cite' | 'em' | 'img' | 'li' | 'ol' | 'p' | 'span' | 'strong' | 'ul' | 'body';
export interface CookieValue {
    value: string;
    domain?: string;
    path?: string;
    expires?: string;
}
export type Cookies = Record<string, string | CookieValue>;
/**
 * Takes a string and turns it into an XML Element.
 * @param string
 * @param throwErrorIfInvalidNS
 * @returns
 */
export declare function toElement(string: string, throwErrorIfInvalidNS?: boolean): Element;
/**
 * Properly logs an error to the console
 * @param e
 */
export declare function handleError(e: Error): void;
/**
 * @param str
 * @returns
 */
export declare function utf16to8(str: string): string;
/**
 * @param x
 * @param y
 * @returns
 */
export declare function xorArrayBuffers(x: ArrayBuffer, y: ArrayBuffer): ArrayBuffer;
/**
 * @param buffer
 * @returns
 */
export declare function arrayBufToBase64(buffer: ArrayBuffer): string;
/**
 * @param str
 * @returns
 */
export declare function base64ToArrayBuf(str: string): ArrayBuffer;
/**
 * @param str
 * @returns
 */
export declare function stringToArrayBuf(str: string): ArrayBuffer;
/**
 * @param cookies
 */
export declare function addCookies(cookies?: Cookies): void;
/**
 * Get the DOM document to generate elements.
 * @returns The currently used DOM document.
 */
export declare function xmlGenerator(): Document;
/**
 * Creates an XML DOM text node.
 * Provides a cross implementation version of document.createTextNode.
 * @param text - The content of the text node.
 * @returns A new XML DOM text node.
 */
export declare function xmlTextNode(text: string): Text;
/**
 * @param stanza
 * @returns
 */
export declare function stripWhitespace(stanza: Element): Element;
/**
 * Creates an XML DOM node.
 * @param text - The contents of the XML element.
 * @returns
 */
export declare function xmlHtmlNode(text: string): XMLDocument;
/**
 * @param doc
 * @returns
 */
export declare function getParserError(doc: XMLDocument): string | null;
/**
 * @param el
 * @returns
 */
export declare function getFirstElementChild(el: XMLDocument): Element | null;
type XmlElementAttrs = Array<Array<string>> | Record<string, string | number> | string | number;
/**
 * Create an XML DOM element.
 *
 * This function creates an XML DOM element correctly across all
 * implementations. Note that these are not HTML DOM elements, which
 * aren't appropriate for XMPP stanzas.
 *
 * @param name - The name for the element.
 * @param attrs
 *    An optional array or object containing
 *    key/value pairs to use as element attributes.
 *    The object should be in the format `{'key': 'value'}`.
 *    The array should have the format `[['key1', 'value1'], ['key2', 'value2']]`.
 * @param text - The text child data for the element.
 *
 * @returns A new XML DOM element.
 */
export declare function xmlElement(name: string, attrs?: XmlElementAttrs, text?: string | number): Element | null;
/**
 * Utility method to determine whether a tag is allowed
 * in the XHTML_IM namespace.
 *
 * XHTML tag names are case sensitive and must be lower case.
 * @method Strophe.XHTML.validTag
 * @param tag
 */
export declare function validTag(tag: string): boolean;
/**
 * Utility method to determine whether an attribute is allowed
 * as recommended per XEP-0071
 *
 * XHTML attribute names are case sensitive and must be lower case.
 * @method Strophe.XHTML.validAttribute
 * @param tag
 * @param attribute
 */
export declare function validAttribute(tag: string, attribute: string): boolean;
/**
 * @method Strophe.XHTML.validCSS
 * @param style
 */
export declare function validCSS(style: string): boolean;
/**
 * Copy an HTML DOM Node into an XML DOM.
 * This function copies a DOM element and all its descendants and returns
 * the new copy.
 * @method Strophe.createHtml
 * @param node - A DOM element.
 * @returns A new, copied DOM element tree.
 */
export declare function createHtml(node: Node): Node | undefined;
/**
 * Copy an XML DOM element.
 *
 * This function copies a DOM element and all its descendants and returns
 * the new copy.
 * @method Strophe.copyElement
 * @param node - A DOM element.
 * @returns A new, copied DOM element tree.
 */
export declare function copyElement(node: Node): Element | Text | undefined;
/**
 * Excapes invalid xml characters.
 * @method Strophe.xmlescape
 * @param text - text to escape.
 * @returns Escaped text.
 */
export declare function xmlescape(text: string): string;
/**
 * Unexcapes invalid xml characters.
 * @method Strophe.xmlunescape
 * @param text - text to unescape.
 * @returns Unescaped text.
 */
export declare function xmlunescape(text: string): string;
/**
 * Map a function over some or all child elements of a given element.
 *
 * This is a small convenience function for mapping a function over
 * some or all of the children of an element.  If elemName is null, all
 * children will be passed to the function, otherwise only children
 * whose tag names match elemName will be passed.
 *
 * @method Strophe.forEachChild
 * @param elem - The element to operate on.
 * @param elemName - The child element tag name filter.
 * @param func - The function to apply to each child.  This
 *    function should take a single argument, a DOM element.
 */
export declare function forEachChild(elem: Element, elemName: string, func: (child: Element) => void): void;
/**
 * Compare an element's tag name with a string.
 * This function is case sensitive.
 * @method Strophe.isTagEqual
 * @param el - A DOM element.
 * @param name - The element name.
 * @returns
 *  true if the element's tag name matches _el_, and false
 *  otherwise.
 */
export declare function isTagEqual(el: Element, name: string): boolean;
/**
 * Return the XML namespace of an element.
 *
 * Prefers the serialized `xmlns` attribute and falls back to the DOM
 * `namespaceURI`, because the two diverge depending on how the element was
 * built and neither is reliable on its own:
 *
 *  - Locally-built stanzas (`$iq`, `stx`, {@link Builder}) are created with
 *    `createElement` and carry their namespace only in the `xmlns` attribute;
 *    their `namespaceURI` is null.
 *  - Stanzas received over the XEP-0114 component transport are built with
 *    `createElementNS` and carry their namespace only on `namespaceURI`; the
 *    redundant `xmlns` attribute is omitted.
 *  - WebSocket / BOSH stanzas parsed by `DOMParser` carry both, except on
 *    child elements that inherit the default namespace without redeclaring it
 *    (those have only `namespaceURI`).
 *
 * Checking both is the transport-agnostic way to read an element's namespace.
 *
 * @method Strophe.getNamespace
 * @param elem - The element whose namespace is wanted.
 * @returns The namespace URI, or null if the element has none.
 */
export declare function getNamespace(elem: Element): string | null;
/**
 * Get the concatenation of all text children of an element.
 * @method Strophe.getText
 * @param elem - A DOM element.
 * @returns A String with the concatenated text of all text element children.
 */
export declare function getText(elem: Node | null): string | null;
/**
 * Escape the node part (also called local part) of a JID.
 * @method Strophe.escapeNode
 * @param node - A node (or local part).
 * @returns An escaped node (or local part).
 */
export declare function escapeNode(node: unknown): unknown;
/**
 * Unescape a node part (also called local part) of a JID.
 * @method Strophe.unescapeNode
 * @param node - A node (or local part).
 * @returns An unescaped node (or local part).
 */
export declare function unescapeNode(node: unknown): unknown;
/**
 * Get the node portion of a JID String.
 * @method Strophe.getNodeFromJid
 * @param jid - A JID.
 * @returns A String containing the node.
 */
export declare function getNodeFromJid(jid: string): string | null;
/**
 * Get the domain portion of a JID String.
 * @method Strophe.getDomainFromJid
 * @param jid - A JID.
 * @returns A String containing the domain.
 */
export declare function getDomainFromJid(jid: string): string | null;
/**
 * Get the resource portion of a JID String.
 * @method Strophe.getResourceFromJid
 * @param jid - A JID.
 * @returns A String containing the resource.
 */
export declare function getResourceFromJid(jid: string): string | null;
/**
 * Get the bare JID from a JID String.
 * @method Strophe.getBareJidFromJid
 * @param jid - A JID.
 * @returns A String containing the bare JID.
 */
export declare function getBareJidFromJid(jid: string): string | null;
declare const utils: {
    utf16to8: typeof utf16to8;
    xorArrayBuffers: typeof xorArrayBuffers;
    arrayBufToBase64: typeof arrayBufToBase64;
    base64ToArrayBuf: typeof base64ToArrayBuf;
    stringToArrayBuf: typeof stringToArrayBuf;
    addCookies: typeof addCookies;
};
export { utils as default };
//# sourceMappingURL=utils.d.ts.map