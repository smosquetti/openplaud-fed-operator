/**
 * Node.js entry point for Strophe.js.
 *
 * It re-exports everything from the shared browser entry ({@link ./index}) and
 * additionally wires up the Node-only pieces that must never reach the browser
 * bundle: the DOM/WebSocket globals (see `./shims/node-dom`, which Node lacks
 * natively) and the XEP-0114 external component transport, which pulls in
 * `node:net`/`node:crypto` and the `saxes` stream tokenizer.
 *
 * The Rollup config points the Node builds (`strophe.node.esm.js`,
 * `strophe.cjs`) at this file, while the browser builds keep using `index.ts`.
 */
import './shims/node-dom';
import Component from './transports/component';
import ComponentParser from './transports/component-parser';
export * from './index';
export { Component, ComponentParser };
export type { StreamParserHandlers } from './transports/component-parser';
//# sourceMappingURL=index-node.d.ts.map