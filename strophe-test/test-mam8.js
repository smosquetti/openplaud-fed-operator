'use strict';
/**
 * MAM probe: full dumps of RSM variants + before/after pairs + max.
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
const FIRST = '1793592835752213';
const LAST = '1793592836753770';

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
        console.log(label + ' → items:', items.length,
          items.length ? 'bodies: ' + items.map(bodyOf).filter(Boolean).join(' | ') : '',
          '\nFULL: ' + (x.length > 1200 ? x.slice(0, 1200) + '…' : x));
        resolve();
      },
      (err) => { clearTimeout(t); console.log(label + ' ERROR:', xmlOf(err).slice(0, 300)); resolve(); });
  });

  // variant: 'none' | 'before-after' | 'max' | 'form-fields'
  const mk = (v) => {
    const q = { xmlns: 'urn:xmpp:mam:2', to: ROOM };
    let x = $iq({ to: DOMAIN, type: 'set' }).c('query', q)
      .c('x', { xmlns: 'jabber:x:data', type: 'result' });
    const fields = { with: ROOM };
    if (v === 'form-fields') fields['max-items'] = '50';
    if (v === 'form-fields') fields.before = FIRST;
    if (v === 'form-fields') fields.after = LAST;
    for (const [k, val] of Object.entries(fields)) x.c('field', { var: k }).c('value').t(val).up();
    let tree = x.tree();
    // append RSM as query children via raw DOM
    const qel = tree.firstChild; // <query>
    const doc = qel.ownerDocument;
    if (v === 'none' || v === 'form-fields') {
      // before+after pair
      const before = doc.createElementNS('urn:xmpp:mam:2', 'before');
      before.setAttribute('id', LAST);
      const after = doc.createElementNS('urn:xmpp:mam:2', 'after');
      after.setAttribute('id', FIRST);
      qel.appendChild(before);
      qel.appendChild(after);
    } else if (v === 'max') {
      const before = doc.createElementNS('urn:xmpp:mam:2', 'before');
      const after = doc.createElementNS('urn:xmpp:mam:2', 'after');
      after.setAttribute('id', FIRST);
      const max = doc.createElementNS('http://jabber.org/protocol/rsm', 'max');
      max.textContent = '50';
      qel.appendChild(before);
      qel.appendChild(after);
      qel.appendChild(max);
    }
    return tree;
  };

  const doMain = async () => {
    await runIQ('J1 before+after pair', mk('none'));
    await runIQ('J2 before+after+max', mk('max'));
    await runIQ('J3 form fields before/after/max-items', mk('form-fields'));
    (op.flush ? op.flush() : op.disconnect());
    await sleep(300);
    process.exit(0);
  };

  op.connect('stevanmosquetti@localhost/mamprobe8', '12345678', (status) => {
    if (status === 5) { op.send($pres()); doMain(); }
    else if ([4, 2, 10, 0].includes(status)) { console.log('op connect failed', status); process.exit(1); }
  });
}

main();
