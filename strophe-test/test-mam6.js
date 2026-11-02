'use strict';
/**
 * MAM last probe: omit start/end (with-only). If the custom module treats
 * missing dates as "all time", archived items should come back.
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
const OP_BARE = 'stevanmosquetti@localhost';

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
  const runIQ = (label, tree) => new Promise((resolve) => {
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
        console.log(label + ' → items:', items.length, items.length
          ? 'bodies: ' + items.map(bodyOf).filter(Boolean).join(' | ')
          : 'raw: ' + (x.length > 300 ? x.slice(0, 300) : x));
        resolve();
      },
      (err) => { clearTimeout(t); console.log(label + ' ERROR:', xmlOf(err).slice(0, 250)); resolve(); });
  });

  const mk = (toAttr, withVal) => {
    const q = { xmlns: 'urn:xmpp:mam:2' };
    if (toAttr) q.to = toAttr;
    return $iq({ to: DOMAIN, type: 'set' }).c('query', q)
      .c('x', { xmlns: 'jabber:x:data', type: 'result' })
      .c('field', { var: 'with' }).c('value').t(withVal).up().up()
      .tree();
  };

  const doMain = async () => {
    await runIQ('G1 set to=room with=room (no dates)', mk(ROOM, ROOM));
    await runIQ('G2 set no-to with=room (no dates)', mk(undefined, ROOM));
    await runIQ('G3 set to=op with=room (no dates)', mk(OP_BARE, ROOM));
    await runIQ('G4 set to=room with=op-bare (no dates)', mk(ROOM, OP_BARE));
    (op.flush ? op.flush() : op.disconnect());
    await sleep(300);
    process.exit(0);
  };

  op.connect('stevanmosquetti@localhost/mamprobe6', '12345678', (status) => {
    if (status === 5) { op.send($pres()); doMain(); }
    else if ([4, 2, 10, 0].includes(status)) { console.log('op connect failed', status); process.exit(1); }
  });
}

main();
