import Builder from './builder';
export declare class UnsafeXML extends String {
}
export type StanzaValue = string | Stanza | Builder | UnsafeXML | StanzaValue[];
/**
 * A Stanza represents a XML element used in XMPP (commonly referred to as stanzas).
 */
export declare class Stanza extends Builder {
    #private;
    /**
     * @param strings
     * @param values
     */
    constructor(strings: TemplateStringsArray, values: StanzaValue[]);
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
    static unsafeXML(string: string): UnsafeXML;
    /**
     * Turns the passed-in string into an XML Element.
     * @param string
     * @param throwErrorIfInvalidNS
     * @returns
     */
    static toElement(string: string, throwErrorIfInvalidNS?: boolean): Element;
    buildTree(): Element;
    /**
     * @returns
     */
    toString(): string;
}
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
export declare function stx(strings: TemplateStringsArray, ...values: StanzaValue[]): Stanza;
//# sourceMappingURL=stanza.d.ts.map