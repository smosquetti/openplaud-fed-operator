'use strict';
/**
 * MAM final probe: archive a FRESH message via MucSub, then query MAM
 * immediately. Rules out staleness. Tries with=room and with=op-bare.
 */
const { Strophe, $iq, $msg, $pres } = require('strophe.js');
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
  const now = Math.floor(Date.now() / 1000);
  const isoEnd = new Date(now + 120).toISOString();
  const isoStart = new Date(now - 120).toISOString();
  const mark = 'mamfresh-' + now;

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
      .c('field', { var: 'start' }).c('value').t(isoStart).up().up()
      .c('field', { var: 'end' }).c('value').t(isoEnd).up().up()
      .tree();
  };

  const doMain = async () => {
    // Customer (separate connection) sends a fresh message to the room.
    const cust = new Strophe.Connection(WS_URL);
    await new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error('cust connect timeout')), 15000);
      cust.connect('custuuid_fresh@localhost/custres', '12345678', (st) => {
        if (st === 5) { clearTimeout(t); res(); }
        else if ([4, 2, 10, 0].includes(st)) { clearTimeout(t); rej(new Error('cust fail ' + st)); }
      });
    });
    console.log('cust connected');
    // join room + send
    cust.send($pres({ to: ROOM + '/FreshCust' }).c('x', { xmlns: 'http://jabber.org/protocol/muc' }).tree());
    await sleep(1500);
    cust.send($msg({ to: ROOM, type: 'groupchat' }).c('body').t(mark).tree());
    console.log('cust sent', mark);
    await sleep(4000); // let operator MucSub delivery + MAM archive settle

    console.log('--- MAM queries (fresh window ±120s) ---');
    await runIQ('F1 to=room with=room', mk(ROOM, ROOM));
    await runIQ('F2 to=room with=op-bare', mk(ROOM, OP_BARE));
    await runIQ('F3 no-to with=room', mk(undefined, ROOM));
    await runIQ('F4 to=op-bare with=room', mk(OP_BARE, ROOM));
    (op.flush ? op.flush() : op.disconnect());
    (cust.flush ? cust.flush() : cust.disconnect());
    await sleep(300);
    process.exit(0);
  };

  op.connect('stevanmosquetti@localhost/freshtest', '12345678', (status) => {
    if (status === 5) { op.send($pres()); doMain().catch((e) => { console.error('FATAL', e.message); process.exit(1); }); }
    else if ([4, 2, 10, 0].includes(status)) { console.log('op connect failed', status); process.exit(1); }
  });
}

main();
