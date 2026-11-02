const OPENING_TAG = /^\s*<([a-zA-Z][^\s/>]*)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*\/?>/;
const ATTRIBUTE = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
/**
 * Unescapes invalid xml characters (duplicated from ../utils.ts so the worker
 * bundle doesn't pull in utils and its dependencies).
 * @param text
 */
function xmlUnescape(text) {
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&apos;/g, "'")
        .replace(/&quot;/g, '"');
}
/**
 * Extract a {@link StanzaView} from a raw websocket frame by inspecting its
 * opening tag. Namespace prefixes are stripped from the tag name and
 * attribute values are XML-unescaped; the frame itself becomes the view's
 * `serialized` payload.
 * @param frame - The raw frame string.
 * @returns The view, or null if the frame doesn't start with a parseable tag.
 */
export function peekElement(frame) {
    const m = OPENING_TAG.exec(frame);
    if (!m) {
        return null;
    }
    const name = m[1].includes(':') ? m[1].slice(m[1].indexOf(':') + 1) : m[1];
    const attrs = {};
    ATTRIBUTE.lastIndex = 0;
    let attr;
    while ((attr = ATTRIBUTE.exec(m[2])) !== null) {
        attrs[attr[1]] = xmlUnescape(attr[2] !== undefined ? attr[2] : attr[3]);
    }
    return { name, attrs, serialized: frame };
}
