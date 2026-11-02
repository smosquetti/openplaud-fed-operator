'use strict';
/**
 * One-off customer nudge: connect as an existing customer, (re)join the temp
 * room under the same nick and send one groupchat message, so the operator
 * gets a fresh MucSub delivery (and a card) on a reloaded page.
 *
 * Run FROM strophe-test/: node nudge-customer.js <custUuid> <roomJid> <nick> [message]
 */
const { Strophe, $msg, $pres } = require('strophe.js');
const WebSocket = require('ws');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');

globalThis.WebSocket = WebSocket;
globalThis.DOMParser = DOMParser;
globalThis.XMLSerializer = XMLSerializer;

const CUST = process.argv[2];
const ROOM = process.argv[3];
const NICK = process.argv[4];
const MSG = process.argv[5] || 'E2E nudge from the customer';
if (!CUST || !ROOM || !NICK) {
  console.error('usage: node nudge-customer.js <custUuid> <roomJid> <nick> [message]');
  process.exit(1);
}

const CONNECTED = 5, AUTHFAIL = 4, CONNFAIL = 2, CONNTIMEOUT = 10, ERROR = 0;
const conn = new Strophe.Connection('ws://localhost:5280/websocket');
const die = (m) => { console.error(m); process.exit(1); };
const timer = setTimeout(() => die('connect timeout'), 15000);

conn.connect(CUST + '@localhost/nudge', '12345678', (status) => {
  if (status === CONNECTED) {
    clearTimeout(timer);
    console.log('connected; joining room');
    conn.send($pres({ to: ROOM + '/' + NICK }).c('x', { xmlns: 'http://jabber.org/protocol/muc' }).tree());
    setTimeout(() => {
      conn.send($msg({ to: ROOM, type: 'groupchat' }).c('body').t(MSG).tree());
      console.log('sent: ' + MSG);
      setTimeout(() => {
        conn.flush ? conn.flush() : conn.disconnect();
        process.exit(0);
      }, 2500);
    }, 2000);
  } else if ([AUTHFAIL, CONNFAIL, CONNTIMEOUT, ERROR].includes(status)) {
    clearTimeout(timer);
    die('connect failed status ' + status);
  }
});
