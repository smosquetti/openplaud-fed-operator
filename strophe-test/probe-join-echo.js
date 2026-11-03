'use strict';
/**
 * Probe: what does the server deliver to an occupant when they (1) join a MUC
 * and (2) send their first groupchat message — the two shapes the web app
 * must handle (operator sees no own messages; empty bubble on join).
 *
 * Runs as a throwaway customer (no MucSub subscription, pure occupant view).
 * Room: backendsupportteam@conference (the spec's flow-test group room).
 *
 * Usage: node probe-join-echo.js   (from strophe-test/)
 */
const { execSync } = require('child_process');
const crypto = require('crypto');
const { Strophe, $pres, $msg } = require('strophe.js');
const WebSocket = require('ws');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');

globalThis.WebSocket = WebSocket;
globalThis.DOMParser = DOMParser;
globalThis.XMLSerializer = XMLSerializer;

const WS_URL = 'ws://localhost:5280/websocket';
const DOMAIN = 'localhost';
const ROOM = 'backendsupportteam@conference';
const NICK = 'ProbeJoin';
const CUST_UUID = 'probejoin' + crypto.randomUUID().slice(0, 8);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function xmlOf(n) {
  const e = n && n.nodeName ? n : n && typeof n.tree === 'function' ? n.tree() : null;
  return e ? new XMLSerializer().serializeToString(e) : String(n);
}

console.log('customer user: ' + CUST_UUID);
try {
  execSync(
    `docker exec -u root ejabberd su ejabberd -c "ejabberdctl register ${CUST_UUID} ${DOMAIN} 12345678"`,
    { stdio: 'pipe' },
  );
} catch (e) {
  console.log('register output:', String(e.stdout || e.stderr || '').trim());
}

const conn = new Strophe.Connection(WS_URL);
let phase = 'pre-join';
const log = (tag) => (raw) => {
  const el = new DOMParser().parseFromString(String(raw), 'text/xml').documentElement;
  const from = el.getAttribute('from') || '';
  const type = el.getAttribute('type') || '';
  const id = el.getAttribute('id') || '';
  console.log(`<< [${phase}] ${el.nodeName} from='${from}' type='${type}' id='${id}'`);
  if (el.nodeName === 'message' || el.nodeName === 'presence') console.log('   RAW:', String(raw).slice(0, 900));
  return true;
};
conn.addHandler(log('join'));

conn.connect(CUST_UUID + '@' + DOMAIN + '/probejoin', '12345678', (status) => {
  if (status === 5) {
    console.log('CONNECTED');
    conn.send($pres({}).tree()); // initial availability (MucSub routing requirement)
    (async () => {
      await sleep(500);

      console.log('\n===== PHASE 1: JOIN =====');
      phase = 'JOIN';
      conn.send($pres({ to: ROOM + '/' + NICK }).c('x', { xmlns: 'http://jabber.org/protocol/muc' }).tree());
      await sleep(5000);

      console.log('\n===== PHASE 2: FIRST GROUPCHAT (own-echo check) =====');
      phase = 'ECHO';
      const body = 'probe-join-echo-' + Date.now();
      conn.send($msg({ to: ROOM, type: 'groupchat' }).c('body').t(body).tree());
      await sleep(5000);

      console.log('\n===== PHASE 3: LEAVE =====');
      phase = 'LEAVE';
      conn.send($pres({ to: ROOM + '/' + NICK, type: 'unavailable' }).tree());
      await sleep(2000);

      console.log('\nDONE');
      conn.flush();
      process.exit(0);
    })().catch((e) => {
      console.error('FATAL', e.message);
      process.exit(1);
    });
  } else if ([4, 2, 10, 0].includes(status)) {
    console.error('connect failed status', status);
    process.exit(1);
  }
});

setTimeout(() => {
  console.error('TIMED OUT — no connect');
  process.exit(2);
}, 30000);
