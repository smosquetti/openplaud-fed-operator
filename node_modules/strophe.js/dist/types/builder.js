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
var _Builder_nodeTree, _Builder_node, _Builder_name, _Builder_attrs;
import { ElementType, NS } from './constants';
import { copyElement, createHtml, toElement, xmlElement, xmlGenerator, xmlTextNode, xmlescape } from './utils';
/**
 * Create a {@link Strophe.Builder}
 * This is an alias for `new Strophe.Builder(name, attrs)`.
 * @param name - The root element name.
 * @param attrs - The attributes for the root element in object notation.
 * @returns A new Strophe.Builder object.
 */
export function $build(name, attrs) {
    return new Builder(name, attrs);
}
/**
 * Create a {@link Strophe.Builder} with a `<message/>` element as the root.
 * @param attrs - The <message/> element attributes in object notation.
 * @returns A new Strophe.Builder object.
 */
export function $msg(attrs) {
    return new Builder('message', attrs);
}
/**
 * Create a {@link Strophe.Builder} with an `<iq/>` element as the root.
 * @param attrs - The <iq/> element attributes in object notation.
 * @returns A new Strophe.Builder object.
 */
export function $iq(attrs) {
    return new Builder('iq', attrs);
}
/**
 * Create a {@link Strophe.Builder} with a `<presence/>` element as the root.
 * @param attrs - The <presence/> element attributes in object notation.
 * @returns A new Strophe.Builder object.
 */
export function $pres(attrs) {
    return new Builder('presence', attrs);
}
/**
 * This class provides an interface similar to JQuery but for building
 * DOM elements easily and rapidly.  All the functions except for `toString()`
 * and tree() return the object, so calls can be chained.
 *
 * The corresponding DOM manipulations to get a similar fragment would be
 * a lot more tedious and probably involve several helper variables.
 *
 * Since adding children makes new operations operate on the child, up()
 * is provided to traverse up the tree.  To add two children, do
 * > builder.c('child1', ...).up().c('child2', ...)
 *
 * The next operation on the Builder will be relative to the second child.
 *
 * @example
 *  // Here's an example using the $iq() builder helper.
 *  $iq({to: 'you', from: 'me', type: 'get', id: '1'})
 *      .c('query', {xmlns: 'strophe:example'})
 *      .c('example')
 *      .toString()
 *
 *  // The above generates this XML fragment
 *  //  <iq to='you' from='me' type='get' id='1'>
 *  //    <query xmlns='strophe:example'>
 *  //      <example/>
 *  //    </query>
 *  //  </iq>
 */
class Builder {
    /**
     * The attributes should be passed in object notation.
     * @param name - The name of the root element.
     * @param attrs - The attributes for the root element in object notation.
     * @example const b = new Builder('message', {to: 'you', from: 'me'});
     * @example const b = new Builder('messsage', {'xml:lang': 'en'});
     */
    constructor(name, attrs) {
        _Builder_nodeTree.set(this, void 0);
        _Builder_node.set(this, void 0);
        _Builder_name.set(this, void 0);
        _Builder_attrs.set(this, void 0);
        // Set correct namespace for jabber:client elements
        if (name === 'presence' || name === 'message' || name === 'iq') {
            if (attrs && !attrs.xmlns) {
                attrs.xmlns = NS.CLIENT;
            }
            else if (!attrs) {
                attrs = { xmlns: NS.CLIENT };
            }
        }
        __classPrivateFieldSet(this, _Builder_name, name, "f");
        __classPrivateFieldSet(this, _Builder_attrs, attrs, "f");
    }
    /**
     * Creates a new Builder object from an XML string.
     * @param str
     * @returns
     * @example const stanza = Builder.fromString('<presence from="juliet@example.com/chamber"></presence>');
     */
    static fromString(str) {
        const el = toElement(str, true);
        const b = new Builder('');
        __classPrivateFieldSet(b, _Builder_nodeTree, el, "f");
        return b;
    }
    buildTree() {
        return xmlElement(__classPrivateFieldGet(this, _Builder_name, "f"), __classPrivateFieldGet(this, _Builder_attrs, "f"));
    }
    get nodeTree() {
        if (!__classPrivateFieldGet(this, _Builder_nodeTree, "f")) {
            // Holds the tree being built.
            __classPrivateFieldSet(this, _Builder_nodeTree, this.buildTree(), "f");
        }
        return __classPrivateFieldGet(this, _Builder_nodeTree, "f");
    }
    get node() {
        if (!__classPrivateFieldGet(this, _Builder_node, "f")) {
            __classPrivateFieldSet(this, _Builder_node, this.tree(), "f");
        }
        return __classPrivateFieldGet(this, _Builder_node, "f");
    }
    set node(el) {
        __classPrivateFieldSet(this, _Builder_node, el, "f");
    }
    /**
     * Render a DOM element and all descendants to a String.
     * @param elem - A DOM element.
     * @returns The serialized element tree as a String.
     */
    static serialize(elem) {
        if (!elem)
            return null;
        const el = elem instanceof Builder ? elem.tree() : elem;
        const names = [...Array(el.attributes.length).keys()].map((i) => el.attributes[i].nodeName);
        names.sort();
        let result = names.reduce((a, n) => `${a} ${n}="${xmlescape(el.attributes.getNamedItem(n).value)}"`, `<${el.nodeName}`);
        if (el.childNodes.length > 0) {
            result += '>';
            for (let i = 0; i < el.childNodes.length; i++) {
                const child = el.childNodes[i];
                switch (child.nodeType) {
                    case ElementType.NORMAL:
                        result += Builder.serialize(child);
                        break;
                    case ElementType.TEXT:
                        result += xmlescape(child.nodeValue);
                        break;
                    case ElementType.CDATA:
                        result += '<![CDATA[' + child.nodeValue + ']]>';
                }
            }
            result += '</' + el.nodeName + '>';
        }
        else {
            result += '/>';
        }
        return result;
    }
    /**
     * Return the DOM tree.
     *
     * This function returns the current DOM tree as an element object.  This
     * is suitable for passing to functions like Strophe.Connection.send().
     *
     * @returns The DOM tree as a element object.
     */
    tree() {
        return this.nodeTree;
    }
    /**
     * Serialize the DOM tree to a String.
     *
     * This function returns a string serialization of the current DOM
     * tree.  It is often used internally to pass data to a
     * Strophe.Request object.
     *
     * @returns The serialized DOM tree in a String.
     */
    toString() {
        return Builder.serialize(this.tree());
    }
    /**
     * Make the current parent element the new current element.
     * This function is often used after c() to traverse back up the tree.
     *
     * @example
     *  // For example, to add two children to the same element
     *  builder.c('child1', {}).up().c('child2', {});
     *
     * @returns The Strophe.Builder object.
     */
    up() {
        this.node = this.node.parentElement ? this.node.parentElement : this.node.parentNode;
        return this;
    }
    /**
     * Make the root element the new current element.
     *
     * When at a deeply nested element in the tree, this function can be used
     * to jump back to the root of the tree, instead of having to repeatedly
     * call up().
     *
     * @returns The Strophe.Builder object.
     */
    root() {
        this.node = this.tree();
        return this;
    }
    /**
     * Add or modify attributes of the current element.
     *
     * The attributes should be passed in object notation.
     * This function does not move the current element pointer.
     * @param moreattrs - The attributes to add/modify in object notation.
     *  If an attribute is set to `null` or `undefined`, it will be removed.
     * @returns The Strophe.Builder object.
     */
    attrs(moreattrs) {
        for (const k in moreattrs) {
            if (Object.prototype.hasOwnProperty.call(moreattrs, k)) {
                if (moreattrs[k] != null) {
                    this.node.setAttribute(k, moreattrs[k].toString());
                }
                else {
                    this.node.removeAttribute(k);
                }
            }
        }
        return this;
    }
    /**
     * Add a child to the current element and make it the new current
     * element.
     *
     * This function moves the current element pointer to the child,
     * unless text is provided.  If you need to add another child, it
     * is necessary to use up() to go back to the parent in the tree.
     *
     * @param name - The name of the child.
     * @param attrs - The attributes of the child in object notation.
     * @param text - The text to add to the child.
     *
     * @returns The Strophe.Builder object.
     */
    c(name, attrs, text) {
        const child = xmlElement(name, attrs, text);
        this.node.appendChild(child);
        if (typeof text !== 'string' && typeof text !== 'number') {
            this.node = child;
        }
        return this;
    }
    /**
     * Add a child to the current element and make it the new current
     * element.
     *
     * This function is the same as c() except that instead of using a
     * name and an attributes object to create the child it uses an
     * existing DOM element object.
     *
     * @param elem - A DOM element.
     * @returns The Strophe.Builder object.
     */
    cnode(elem) {
        if (elem instanceof Builder) {
            elem = elem.tree();
        }
        let impNode;
        const xmlGen = xmlGenerator();
        try {
            impNode = xmlGen.importNode !== undefined;
        }
        catch (_e) {
            impNode = false;
        }
        const newElem = impNode ? xmlGen.importNode(elem, true) : copyElement(elem);
        this.node.appendChild(newElem);
        this.node = newElem;
        return this;
    }
    /**
     * Add a child text element.
     *
     * This *does not* make the child the new current element since there
     * are no children of text elements.
     *
     * @param text - The text data to append to the current element.
     * @returns The Strophe.Builder object.
     */
    t(text) {
        const child = xmlTextNode(text);
        this.node.appendChild(child);
        return this;
    }
    /**
     * Replace current element contents with the HTML passed in.
     *
     * This *does not* make the child the new current element
     *
     * @param html - The html to insert as contents of current element.
     * @returns The Strophe.Builder object.
     */
    h(html) {
        const fragment = xmlGenerator().createElement('body');
        fragment.innerHTML = html;
        const xhtml = createHtml(fragment);
        while (xhtml.childNodes.length > 0) {
            this.node.appendChild(xhtml.childNodes[0]);
        }
        return this;
    }
}
_Builder_nodeTree = new WeakMap(), _Builder_node = new WeakMap(), _Builder_name = new WeakMap(), _Builder_attrs = new WeakMap();
export default Builder;
