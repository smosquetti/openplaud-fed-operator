'use strict';
/**
 * MAM probe round 2: set-type submissions, FORM_TYPE echo, date formats.
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
  const isoEnd = new Date(now + 60).toISOString();
  const isoStart = new Date(now - 3600).toISOString();

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
        const summary = x.length > 350 ? x.slice(0, 350) : x;
        console.log(label + ' → items:', items.length, items.length
          ? 'bodies: ' + items.map(bodyOf).filter(Boolean).join(' | ')
          : 'raw: ' + summary);
        resolve();
      },
      (err) => { clearTimeout(t); console.log(label + ' ERROR:', xmlOf(err).slice(0, 400)); resolve(); });
  });

  // iqType, queryToAttr, fields
  const mk = (iqType, toAttr, fields) => {
    const q = { xmlns: 'urn:xmpp:mam:2' };
    if (toAttr) q.to = toAttr;
    let tree = $iq({ to: DOMAIN, type: iqType }).c('query', q)
      .c('x', { xmlns: 'jabber:x:data', type: 'result' });
    for (const [v, val] of Object.entries(fields)) {
      const f = tree.c('field', { var: v });
      if (val === undefined) { f.up(); continue; }
      f.c('value').t(val).up().up();
    }
    return tree.tree();
  };
  const FT = { FORM_TYPE: 'urn:xmpp:mam:2' };

  const doMain = async () => {
    await runIQ('S1 set, to=room, FT+with=room+start+end', mk('set', ROOM, { ...FT, with: ROOM, start, end }));
    await runIQ('S2 set, to=room, with=room+start+end (no FT)', mk('set', ROOM, { with: ROOM, start, end }));
    await runIQ('S3 get, to=room, FT+with=room+start+end', mk('get', ROOM, { ...FT, with: ROOM, start, end }));
    await runIQ('S4 set, to=room, ISO dates', mk('set', ROOM, { with: ROOM, start: isoStart, end: isoEnd }));
    await runIQ('S5 set, no to, with=room, start+end', mk('set', undefined, { with: ROOM, start, end }));
    await runIQ('S6 set, to=room, with=room, start only', mk('set', ROOM, { with: ROOM, start }));
    (conn.flush ? conn.flush() : conn.disconnect());
    await sleep(300);
    process.exit(0);
  };

  conn.connect('stevanmosquetti@localhost/mamprobe3', '12345678', (status) => {
    if (status === 5) doMain();
    else if ([4, 2, 10, 0].includes(status)) { console.log('connect failed', status); process.exit(1); }
  });
}

main();
