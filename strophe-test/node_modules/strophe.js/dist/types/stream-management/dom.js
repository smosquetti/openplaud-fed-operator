/**
 * Build the environment-free {@link StanzaView} consumed by the XEP-0198
 * engine from a DOM Element.
 * @param el
 */
export function toStanzaView(el) {
    const attrs = {};
    for (let i = 0; i < el.attributes.length; i++) {
        const attr = el.attributes[i];
        attrs[attr.name] = attr.value;
    }
    return { name: el.tagName, attrs, serialized: new XMLSerializer().serializeToString(el) };
}
