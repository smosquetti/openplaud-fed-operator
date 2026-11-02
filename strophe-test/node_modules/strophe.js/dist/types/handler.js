import { getBareJidFromJid, getNamespace as getElementNamespace, handleError, isTagEqual } from './utils';
/**
 * _Private_ helper class for managing stanza handlers.
 *
 * A Handler encapsulates a user provided callback function to be
 * executed when matching stanzas are received by the connection.
 * Handlers can be either one-off or persistant depending on their
 * return value. Returning true will cause a Handler to remain active, and
 * returning false will remove the Handler.
 *
 * Users will not use Handler objects directly, but instead they
 * will use {@link Connection.addHandler} and
 * {@link Connection.deleteHandler}.
 */
class Handler {
    /**
     * Create and initialize a new Handler.
     *
     * @param handler - A function to be executed when the handler is run.
     * @param ns - The namespace to match.
     * @param name - The element name to match.
     * @param type - The stanza type (or types if an array) to match.
     * @param id - The element id attribute to match.
     * @param from - The element from attribute to match.
     * @param options - Handler options
     */
    constructor(handler, ns, name, type, id, from, options) {
        this.handler = handler;
        this.ns = ns;
        this.name = name;
        this.type = type;
        this.id = id;
        this.options = options || { matchBareFromJid: false, ignoreNamespaceFragment: false };
        if (this.options.matchBareFromJid) {
            this.from = from ? getBareJidFromJid(from) : null;
        }
        else {
            this.from = from;
        }
        this.user = true;
    }
    /**
     * Returns the XML namespace of an element.
     * Resolved via {@link Strophe.getNamespace}, which reads the `xmlns`
     * attribute and falls back to `namespaceURI` so matching works regardless
     * of how the stanza's DOM was built (locally, via DOMParser, or via the
     * component transport's `createElementNS`).
     * If `ignoreNamespaceFragment` was passed in for this handler, then the
     * URL fragment will be stripped.
     * @param elem - The XML element with the namespace.
     * @returns The namespace, with optionally the fragment stripped.
     */
    getNamespace(elem) {
        let elNamespace = getElementNamespace(elem);
        if (elNamespace && this.options.ignoreNamespaceFragment) {
            elNamespace = elNamespace.split('#')[0];
        }
        return elNamespace;
    }
    /**
     * Tests if a stanza element (or any of its children) matches the
     * namespace set for this Handler.
     * @param elem - The XML element to test.
     * @returns true if the stanza matches and false otherwise.
     */
    namespaceMatch(elem) {
        var _a;
        if (!this.ns || this.getNamespace(elem) === this.ns) {
            return true;
        }
        for (const child of (_a = elem.children) !== null && _a !== void 0 ? _a : []) {
            if (this.getNamespace(child) === this.ns) {
                return true;
            }
            else if (this.namespaceMatch(child)) {
                return true;
            }
        }
        return false;
    }
    /**
     * Tests if a stanza matches the Handler.
     * @param elem - The XML element to test.
     * @returns true if the stanza matches and false otherwise.
     */
    isMatch(elem) {
        let from = elem.getAttribute('from');
        if (this.options.matchBareFromJid) {
            from = getBareJidFromJid(from);
        }
        const elem_type = elem.getAttribute('type');
        if (this.namespaceMatch(elem) &&
            (!this.name || isTagEqual(elem, this.name)) &&
            (!this.type ||
                (Array.isArray(this.type) ? this.type.indexOf(elem_type !== null && elem_type !== void 0 ? elem_type : '') !== -1 : elem_type === this.type)) &&
            (!this.id || elem.getAttribute('id') === this.id) &&
            (!this.from || from === this.from)) {
            return true;
        }
        return false;
    }
    /**
     * Run the callback on a matching stanza.
     * @param elem - The DOM element that triggered the Handler.
     * @returns A boolean indicating if the handler should remain active.
     */
    run(elem) {
        let result = null;
        try {
            result = this.handler(elem);
        }
        catch (e) {
            handleError(e);
            throw e;
        }
        return result;
    }
    /**
     * Get a String representation of the Handler object.
     */
    toString() {
        return '{Handler: ' + this.handler + '(' + this.name + ',' + this.id + ',' + this.ns + ')}';
    }
}
export default Handler;
