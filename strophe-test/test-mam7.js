'use strict';
/**
 * MAM probe: RSM pagination. No dates, with=room. Use <before>/<after> to
 * page through the 2 archived items.
 */
const { Strophe, $iq, $pres } = require('strophe.js');
const WebSocket = require('ws');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');
globalThis.WebSocket = WebSocket;
globalThis.DOMParser = DOMParser;
globalThis.XMLSerializer = XMLSerializer;

const WS_URL = 'ws://localhost:5280/websocket';
const DOMAIN = 'localhost';
const ROOM = '74a57aa0-a97d-41ec-be35-56f4a3b61f99_18c4c671-9ced-454b-b7ce-a5eb333b331e@conference';

const S = new XMLSerializer();
const xmlOf = (n) => {
  const e = (n && n.nodeName) ? n : (n && typeof n.tree === 'function' ? n.tree() : null);
  return e ? S.serializeToString(e) : String(n);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function bodyOf(node) {
  if (!node) return '';
  let b = null;
  const walk = (n) => {
    if (n.nodeName === 'body') { b = n; return; }
    const kids = n.childNodes || [];
    for (let i = 0; i < kids.length; i++) walk(kids[i]);
  };
  walk(node);
  return b ? (b.childNodes[0] ? b.childNodes[0].nodeValue : '') : '';
}

function main() {
  const op = new Strophe.Connection(WS_URL);

  const runIQ = (label, tree, full) => new Promise((resolve) => {
    const t = setTimeout(() => { console.log(label + ': TIMEOUT'); resolve(null); }, 8000);
    op.sendIQ(tree,
      (r) => {
        clearTimeout(t);
        const e = (r && r.nodeName) ? r : (r && typeof r.tree === 'function' ? r.tree() : null);
        const x = xmlOf(e);
        const items = [];
        if (e) {
          const walk = (n) => {
            if (n.nodeName === 'item') items.push(n);
            const kids = n.childNodes || [];
            for (let i = 0; i < kids.length; i++) walk(kids[i]);
          };
          walk(e);
        }
        console.log(label + ' → items:', items.length,
          items.length ? 'bodies: ' + items.map(bodyOf).filter(Boolean).join(' | ') : '',
          full ? '\nFULL: ' + x : '');
        resolve();
      },
      (err) => { clearTimeout(t); console.log(label + ' ERROR:', xmlOf(err).slice(0, 250)); resolve(); });
  });

  // no dates; with=room; optional RSM before/after
  const mk = (rsm) => {
    const q = { xmlns: 'urn:xmpp:mam:2', to: ROOM };
    let tree = $iq({ to: DOMAIN, type: 'set' }).c('query', q)
      .c('x', { xmlns: 'jabber:x:data', type: 'result' })
      .c('field', { var: 'with' }).c('value').t(ROOM).up();
    if (rsm === 'before') tree.c('before');
    else if (rsm === 'after-first') tree.c('after', { id: '1793592835752213' });
    else if (rsm === 'before-after') tree.c('before', { id: '1793592835752213' });
    return tree.tree();
  };

  const doMain = async () => {
    await runIQ('H0 no RSM (full dump)', mk(null), true);
    await runIQ('H1 <before/>', mk('before'));
    await runIQ('H2 <after id=first>', mk('after-first'));
    await runIQ('H3 <before id=first>', mk('before-after'));
    (op.flush ? op.flush() : op.disconnect());
    await sleep(300);
    process.exit(0);
  };

  op.connect('stevanmosquetti@localhost/mamprobe7', '12345678', (status) => {
    if (status === 5) { op.send($pres()); doMain(); }
    else if ([4, 2, 10, 0].includes(status)) { console.log('op connect failed', status); process.exit(1); }
  });
}

main();
