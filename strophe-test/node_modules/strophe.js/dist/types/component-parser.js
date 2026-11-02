import { StringDecoder } from 'node:string_decoder';
import { SaxesParser } from 'saxes';
import { xmlGenerator } from './utils';
/**
 * Incrementally parses an XMPP component stream.
 *
 * Feed it raw socket chunks via {@link ComponentParser#write}; it emits
 * stream-start, per-stanza and stream-end events through the handlers passed to
 * the constructor. Robust to a stanza (or a single multi-byte character) being
 * split across arbitrary chunk boundaries.
 */
export default class ComponentParser {
    constructor(handlers) {
        this._handlers = handlers;
        this.reset();
    }
    /**
     * Discard all parser state and start afresh. Called when a (re)connection
     * begins so a new stream is parsed from a clean slate.
     */
    reset() {
        this._decoder = new StringDecoder('utf8');
        this._stack = [];
        this._streamOpened = false;
        this._errored = false;
        this._parser = new SaxesParser({ xmlns: true });
        this._parser.on('opentag', (tag) => this._onOpenTag(tag));
        this._parser.on('closetag', () => this._onCloseTag());
        this._parser.on('text', (text) => this._onText(text));
        this._parser.on('cdata', (cdata) => this._onText(cdata));
        this._parser.on('error', (err) => this._fail(err));
    }
    /**
     * Feed a chunk of raw stream data into the parser.
     *
     * Accepts a `Buffer` (as delivered by a `node:net` socket) or an already
     * decoded string. Buffers are run through a {@link StringDecoder} so that a
     * multi-byte UTF-8 character split across two chunks is reassembled instead
     * of corrupted.
     * @param chunk - The bytes (or string) received from the socket.
     */
    write(chunk) {
        if (this._errored) {
            return;
        }
        const str = typeof chunk === 'string' ? chunk : this._decoder.write(chunk);
        if (str === '') {
            return;
        }
        try {
            this._parser.write(str);
        }
        catch (e) {
            this._fail(e);
        }
    }
    _fail(error) {
        if (this._errored) {
            return;
        }
        this._errored = true;
        this._handlers.onError(error);
    }
    _onOpenTag(tag) {
        if (!this._streamOpened) {
            // The depth-0 element is the stream root. Capture its attributes and
            // treat it as the stream-start event; it won't close until the
            // stream ends.
            this._streamOpened = true;
            this._handlers.onStreamStart(this._flattenAttributes(tag));
            return;
        }
        const el = this._createElement(tag);
        if (this._stack.length) {
            this._stack[this._stack.length - 1].appendChild(el);
        }
        this._stack.push(el);
    }
    _onText(text) {
        // Text (and whitespace keepalives) directly under the stream root, i.e.
        // in between stanzas, is ignored.
        if (this._stack.length) {
            this._stack[this._stack.length - 1].appendChild(xmlGenerator().createTextNode(text));
        }
    }
    _onCloseTag() {
        if (!this._stack.length) {
            // Nothing is being built, so this closes the stream root.
            this._streamOpened = false;
            this._handlers.onStreamEnd();
            return;
        }
        const el = this._stack.pop();
        if (!this._stack.length) {
            // A complete top-level stanza has been assembled.
            this._handlers.onStanza(el);
        }
    }
    _createElement(tag) {
        const el = xmlGenerator().createElementNS(tag.uri || null, tag.name);
        for (const key of Object.keys(tag.attributes)) {
            const attr = tag.attributes[key];
            // Namespace declarations are skipped: createElementNS already
            // carries the resolved URI, so re-adding xmlns/xmlns:* would only
            // duplicate them on serialisation.
            if (attr.name === 'xmlns' || attr.prefix === 'xmlns') {
                continue;
            }
            if (attr.uri) {
                el.setAttributeNS(attr.uri, attr.name, attr.value);
            }
            else {
                el.setAttribute(attr.name, attr.value);
            }
        }
        return el;
    }
    _flattenAttributes(tag) {
        const attrs = {};
        for (const key of Object.keys(tag.attributes)) {
            attrs[key] = tag.attributes[key].value;
        }
        return attrs;
    }
}
