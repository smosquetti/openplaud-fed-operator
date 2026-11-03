'use strict';
/**
 * Probe: connect as the operator and query the MucSub subscriptions of a room:
 *   <iq type='get' to='room@conference'><subscriptions xmlns='urn:xmpp:mucsub:0'/></iq>
 * Dumps the raw response so we can see exactly who is subscribed.
 *
 * Run FROM strophe-test/: node probe-subs.js <roomJid>
 */
const { Strophe, $iq, $pres } = require('strophe.js');
const WebSocket = require('ws');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');

globalThis.WebSocket = WebSocket;
globalThis.DOMParser = DOMParser;
globalThis.XMLSerializer = XMLSerializer;

const ROOM = process.argv[2];
if (!ROOM) {
  console.error('usage: node probe-subs.js <roomJid>');
  process.exit(1);
}

const CONNECTED = 5, AUTHFAIL = 4, CONNFAIL = 2, CONNTIMEOUT = 10, ERROR = 0;
const conn = new Strophe.Connection('ws://localhost:5280/websocket');
const timer = setTimeout(() => { console.error('connect timeout'); process.exit(1); }, 15000);

conn.connect('stevanmosquetti@localhost/probe-subs', '12345678', (status) => {
  if (status === CONNECTED) {
    clearTimeout(timer);
    conn.send($pres().tree());
    // sendIQ auto-assigns the id; the raw server rejects IQs without one.
    const id = 'probe-subs-1';
    const iq = $iq({ to: ROOM, type: 'get', id }).c('subscriptions', { xmlns: 'urn:xmpp:mucsub:0' }).tree();
    const t = setTimeout(() => { console.log('IQ TIMEOUT — no response for ' + id); process.exit(2); }, 10000);
    conn.addHandler((st) => {
      if (st.nodeName === 'iq' && st.getAttribute('id') === id) {
        console.log('RAW IQ RESPONSE:\n' + new XMLSerializer().serializeToString(st));
        clearTimeout(t);
        process.exit(0);
      }
      return true; // keep the handler alive (Strophe 5 removes it on false)
    });
    conn.send(iq);
  } else if ([AUTHFAIL, CONNFAIL, CONNTIMEOUT, ERROR].includes(status)) {
    clearTimeout(timer);
    console.error('connect failed status ' + status);
    process.exit(1);
  }
});
