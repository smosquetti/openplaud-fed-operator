/**
 * XEP-0198 Stream Management
 *
 * The worker-side {@link StanzaView} adapter:
 * DOM-free peeking at the opening tag of a websocket frame.
 *
 * `DOMParser` is a Window interface that doesn't exist in a SharedWorker
 * global, so the worker-resident XEP-0198 engine can't parse frames the way
 * the page does (see dom.ts). It doesn't need to: RFC 7395 delivers exactly
 * one top-level stanza or nonza per websocket frame, so the engine's
 * {@link StanzaView} (tag name plus a few attributes) can be extracted from
 * the opening tag with a regex. Divergence between the page and worker
 * environments is prevented by sharing the engine, not the parser.
 */
import type { StanzaView } from './types';
/**
 * Extract a {@link StanzaView} from a raw websocket frame by inspecting its
 * opening tag. Namespace prefixes are stripped from the tag name and
 * attribute values are XML-unescaped; the frame itself becomes the view's
 * `serialized` payload.
 * @param frame - The raw frame string.
 * @returns The view, or null if the frame doesn't start with a parseable tag.
 */
export declare function peekElement(frame: string): StanzaView | null;
//# sourceMappingURL=parse.d.ts.map