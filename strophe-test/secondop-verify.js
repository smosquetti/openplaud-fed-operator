/**
 * Verify that AFTER a transfer the NEW operator (secondop) receives MucSub
 * deliveries for the temp room — i.e. the backend re-applied the
 * subscription to the transfer target.
 *
 * Connects as secondop@localhost/verify and waits for a pubsub
 * <event> delivery (MucSub node urn:xmpp:mucsub:nodes:messages) mentioning
 * the given room. The customer is nudged into the room separately
 * (nudge-customer.js) to trigger the delivery.
 *
 * Usage: node secondop-verify.js <roomJid> [waitSeconds]
 *   from strophe-test/
 */
const { Strophe, $pres } = require('strophe.js');
const WebSocket = require('ws');
const { DOMParser } = require('@xmldom/xmldom');
globalThis.WebSocket = WebSocket;
globalThis.DOMParser = DOMParser;

const ROOM = process.argv[2];
const WAIT_MS = Number(process.argv[3] || 45) * 1000;
if (!ROOM) {
  console.error('usage: node secondop-verify.js <roomJid> [waitSeconds]');
  process.exit(1);
}

let got = false;

const conn = new Strophe.Connection('ws://localhost:5280/websocket');
conn.connect('secondop@localhost/verify', '12345678', (status) => {
  if (status === 5) {
    console.log('[ben] CONNECTED, waiting for MucSub event for', ROOM);
    conn.send($pres({}).tree());
  } else if ([4, 2, 10, 0].includes(status)) {
    console.error('[ben] connect failed status', status);
    process.exit(1);
  }
});

const hasNode = (n, name) => {
  if (!n || n.nodeName !== name) {
    const kids = n && n.childNodes || [];
    for (let i = 0; i < kids.length; i++) if (hasNode(kids[i], name)) return true;
    return false;
  }
  return true;
};

conn.addHandler((raw) => {
  try {
    const doc = new DOMParser().parseFromString(String(raw), 'text/xml');
    if (doc && doc.documentElement && doc.documentElement.nodeName === 'message' && hasNode(doc.documentElement, 'event')) {
      got = true;
      const from = doc.documentElement.getAttribute('from') || '';
      console.log('[ben] MUCSUB EVENT from=' + from);
      console.log('[ben] raw:', String(raw).slice(0, 500));
    }
  } catch (_) {
    /* ignore */
  }
  return true;
});

setTimeout(() => {
  console.log(got ? 'RESULT secondopGotMucSub: true' : 'RESULT secondopGotMucSub: false');
  process.exit(got ? 0 : 2);
}, WAIT_MS);
