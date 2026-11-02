'use strict';
/**
 * MAM Data-Forms probe: the custom mod_mam answers with a form (with/start/end).
 * Test which `with` value (and query@to) yields actual items.
 */
const { Strophe, $iq } = require('strophe.js');
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
  const conn = new Strophe.Connection(WS_URL);
  const now = Math.floor(Date.now() / 1000);
  const end = String(now + 60);
  const start = String(now - 3600);

  const runIQ = (label, tree) => new Promise((resolve) => {
    const t = setTimeout(() => { console.log(label + ': TIMEOUT'); resolve(null); }, 8000);
    conn.sendIQ(tree,
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
        console.log(label + ' → items:', items.length, items.length ? 'bodies: ' + items.map(bodyOf).filter(Boolean).join(' | ') : 'raw: ' + x.slice(0, 300));
        resolve();
      },
      (err) => { clearTimeout(t); console.log(label + ' ERROR:', xmlOf(err).slice(0, 400)); resolve(); });
  });

  const mk = (toAttr, fields) => {
    const q = { xmlns: 'urn:xmpp:mam:2' };
    if (toAttr) q.to = toAttr;
    const tree = $iq({ to: DOMAIN, type: 'get' }).c('query', q)
      .c('x', { xmlns: 'jabber:x:data', type: 'result' });
    for (const [v, val] of Object.entries(fields)) tree.c('field', { var: v }).c('value').t(val).up().up();
    return tree.tree();
  };
  const F = (w) => ({ with: w, start, end });

  const doMain = async () => {
    await runIQ('W1 to=room, with=room', mk(ROOM, F(ROOM)));
    await runIQ('W2 to=room, with=op-bare', mk(ROOM, F('stevanmosquetti@localhost')));
    await runIQ('W3 to=room, with=op-full', mk(ROOM, F('stevanmosquetti@localhost/mamprobe')));
    await runIQ('W4 to=op-bare, with=room', mk('stevanmosquetti@localhost', F(ROOM)));
    await runIQ('W5 no to, with=room', mk(undefined, F(ROOM)));
    await runIQ('W6 no to, with=op-bare', mk(undefined, F('stevanmosquetti@localhost')));
    (conn.flush ? conn.flush() : conn.disconnect());
    await sleep(300);
    process.exit(0);
  };

  conn.connect('stevanmosquetti@localhost/mamprobe2', '12345678', (status) => {
    if (status === 5) doMain();
    else if ([4, 2, 10, 0].includes(status)) { console.log('connect failed', status); process.exit(1); }
  });
}

main();
