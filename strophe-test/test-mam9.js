'use strict';
/**
 * MAM probe: does the server PUSH archived items as live <message> stanzas
 * in response to the query? Register a message handler, fire the query, wait.
 */
const { Strophe, $iq, $pres, $msg } = require('strophe.js');
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

function main() {
  const op = new Strophe.Connection(WS_URL);
  const msgs = [];
  op.addHandler((st) => {
    const x = xmlOf(st);
    msgs.push(x);
    console.log('[op] <<', x.length > 400 ? x.slice(0, 400) + '…' : x);
    return true;
  }, 'message');

  const doMain = async () => {
    console.log('--- firing MAM query, watching for pushed items (8s) ---');
    const q = $iq({ to: DOMAIN, type: 'set' })
      .c('query', { xmlns: 'urn:xmpp:mam:2', to: ROOM })
      .c('x', { xmlns: 'jabber:x:data', type: 'result' })
      .c('field', { var: 'with' }).c('value').t(ROOM).up().tree();
    op.sendIQ(q, (r) => console.log('IQ result:', xmlOf(r).slice(0, 300)),
      (e) => console.log('IQ error:', xmlOf(e).slice(0, 300)));
    await sleep(8000);
    console.log('total messages seen after query:', msgs.length);
    (op.flush ? op.flush() : op.disconnect());
    await sleep(300);
    process.exit(0);
  };

  op.connect('stevanmosquetti@localhost/mamprobe9', '12345678', (status) => {
    if (status === 5) { op.send($pres()); doMain(); }
    else if ([4, 2, 10, 0].includes(status)) { console.log('op connect failed', status); process.exit(1); }
  });
}

main();
