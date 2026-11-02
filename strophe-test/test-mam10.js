'use strict';
/**
 * MAM 1:1 test: direct operator<->customer messages, then query MAM
 * with=customer (no dates). If items come back, MAM works for 1:1 only.
 */
const { Strophe, $iq, $msg, $pres } = require('strophe.js');
const WebSocket = require('ws');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');
globalThis.WebSocket = WebSocket;
globalThis.DOMParser = DOMParser;
globalThis.XMLSerializer = XMLSerializer;

const WS_URL = 'ws://localhost:5280/websocket';
const DOMAIN = 'localhost';
const OP_BARE = 'stevanmosquetti@localhost';
const CUST_BARE = 'custuuid_fresh@localhost';

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
  const cust = new Strophe.Connection(WS_URL);

  const connectBoth = () => new Promise((resolve) => {
    let ready = 0;
    const done = () => { if (++ready === 2) resolve(); };
    op.connect('stevanmosquetti@localhost/one2one', '12345678', (st) => {
      if (st === 5) { op.send($pres()); done(); }
      else if ([4, 2, 10, 0].includes(st)) { console.log('op failed', st); process.exit(1); }
    });
    cust.connect(CUST_BARE + '/one2one', '12345678', (st) => {
      if (st === 5) { cust.send($pres()); done(); }
      else if ([4, 2, 10, 0].includes(st)) { console.log('cust failed', st); process.exit(1); }
    });
  });

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
          : 'raw: ' + (x.length > 500 ? x.slice(0, 500) : x));
        resolve();
      },
      (err) => { clearTimeout(t); console.log(label + ' ERROR:', xmlOf(err).slice(0, 300)); resolve(); });
  });

  const mk = (toAttr, withVal) => {
    const q = { xmlns: 'urn:xmpp:mam:2' };
    if (toAttr) q.to = toAttr;
    return $iq({ to: DOMAIN, type: 'set' }).c('query', q)
      .c('x', { xmlns: 'jabber:x:data', type: 'result' })
      .c('field', { var: 'with' }).c('value').t(withVal).up()
      .tree();
  };

  const doMain = async () => {
    // 1:1 exchange
    cust.send($msg({ to: OP_BARE, type: 'chat' }).c('body').t('one2one-A').tree());
    await sleep(1500);
    op.send($msg({ to: CUST_BARE, type: 'chat' }).c('body').t('one2one-B').tree());
    await sleep(4000); // settle archives
    await runIQ('K1 to=cust with=cust', mk(CUST_BARE, CUST_BARE));
    await runIQ('K2 no-to with=cust', mk(undefined, CUST_BARE));
    await runIQ('K3 to=op with=cust', mk(OP_BARE, CUST_BARE));
    (op.flush ? op.flush() : op.disconnect());
    (cust.flush ? cust.flush() : cust.disconnect());
    await sleep(300);
    process.exit(0);
  };

  connectBoth().then(doMain).catch((e) => { console.error('FATAL', e.message); process.exit(1); });
}

main();
