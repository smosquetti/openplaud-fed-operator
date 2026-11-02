'use strict';
/**
 * MAM probe round 4: user-scoped queries (with = own JID, no to) and a
 * full epoch→future window, to see if ANY archived stanza comes back.
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
  const EPOCH = '1970-01-01T00:00:00.000Z';
  const FUTURE = new Date(Math.floor(Date.now() / 1000) + 3600).toISOString();

  const runIQ = (label, tree) => new Promise((resolve) => {
    const t = setTimeout(() => { console.log(label + ': TIMEOUT'); resolve(null); }, 10000);
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
        console.log(label + ' → items:', items.length, items.length
          ? 'bodies: ' + items.map(bodyOf).filter(Boolean).join(' | ')
          : 'raw: ' + (x.length > 400 ? x.slice(0, 400) : x));
        resolve();
      },
      (err) => { clearTimeout(t); console.log(label + ' ERROR:', xmlOf(err).slice(0, 300)); resolve(); });
  });

  const mk = (toAttr, withVal, start, end) => {
    const q = { xmlns: 'urn:xmpp:mam:2' };
    if (toAttr) q.to = toAttr;
    return $iq({ to: DOMAIN, type: 'set' }).c('query', q)
      .c('x', { xmlns: 'jabber:x:data', type: 'result' })
      .c('field', { var: 'with' }).c('value').t(withVal).up().up()
      .c('field', { var: 'start' }).c('value').t(start).up().up()
      .c('field', { var: 'end' }).c('value').t(end).up().up()
      .tree();
  };

  const OP_BARE = 'stevanmosquetti@localhost';

  const doMain = async () => {
    await runIQ('T7 set no-to with=op-bare epoch→fut', mk(undefined, OP_BARE, EPOCH, FUTURE));
    await runIQ('T8 set to=op-bare with=op-bare epoch→fut', mk(OP_BARE, OP_BARE, EPOCH, FUTURE));
    await runIQ('T9 set to=room with=op-bare epoch→fut', mk(ROOM, OP_BARE, EPOCH, FUTURE));
    await runIQ('T10 set to=room with=room epoch→fut', mk(ROOM, ROOM, EPOCH, FUTURE));
    (conn.flush ? conn.flush() : conn.disconnect());
    await sleep(300);
    process.exit(0);
  };

  conn.connect('stevanmosquetti@localhost/mamprobe5', '12345678', (status) => {
    if (status === 5) doMain();
    else if ([4, 2, 10, 0].includes(status)) { console.log('connect failed', status); process.exit(1); }
  });
}

main();
