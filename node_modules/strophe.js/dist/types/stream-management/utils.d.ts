import { SMState } from './types';
/** The 'h' counter is an unsignedInt that wraps back to zero (XEP-0198 §4). */
export declare const H_WRAP: number;
/**
 * Escapes invalid xml characters (duplicated from ../utils.ts so the worker
 * bundle doesn't pull in utils and its dependencies).
 * @param text
 */
export declare function xmlEscape(text: string): string;
/**
 * @returns A fresh, inactive SM state object.
 */
export declare function freshState(): SMState;
/**
 * Parse an 'h' attribute value into a wrapped unsigned 32-bit counter value.
 * @param value - The attribute value (may be undefined).
 * @returns The parsed value, or null if missing or invalid.
 */
export declare function parseH(value: string): number;
/**
 * @param name - A top-level element's local tag name.
 * @returns true if the element counts towards the SM 'h' counters.
 */
export declare function isCountableStanza(name: string): boolean;
/**
 * Remove the `from` attribute from a serialized stanza's root element, so a
 * re-sent stanza cannot carry a stale resource after a failed resumption. Only
 * the root opening tag is touched; nested `from` attributes (forwarded stanzas,
 * MUC addresses) are preserved. The server stamps the authoritative c2s `from`.
 * DOM-free string surgery, mirroring stampDelay.
 * @param serialized - The serialized stanza.
 * @returns The stanza with the root `from` removed (unchanged if none).
 */
export declare function stripFrom(serialized: string): string;
/**
 * Insert a XEP-0203 <delay/> child into a serialized stanza (DOM-free string
 * surgery). Used when re-sending salvaged stanzas after a failed resumption,
 * so the receiving client can show the original send time.
 * @param serialized - The serialized stanza.
 * @param name - The stanza's local tag name.
 * @param queuedAt - The original queueing time (ms since epoch).
 * @returns The stanza with a <delay/> child, or the unmodified input if it
 *     already carries one (or is malformed).
 */
export declare function stampDelay(serialized: string, name: string, queuedAt: number): string;
//# sourceMappingURL=utils.d.ts.map