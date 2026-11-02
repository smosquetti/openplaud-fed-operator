'use strict';
/**
 * Does an offline MucSub subscriber receive the push on RECONNECT?
 * 1. Register customer, create room (API).
 * 2. Customer connects, joins, sends message.  (operator NOT connected yet)
 * 3. Operator connects AFTER the message (fresh c2s session).
 * 4. See if the operator receives the wrapped push (live or from stored queue).
 */
const { execSync } = require('child_process');
const crypto = require('crypto');
const { Strophe, $msg, $pres } = require('strophe.js');
const WebSocket = require('ws');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');
globalThis.WebSocket = WebSocket;
globalThis.DOMParser = DOMParser;
globalThis.XMLSerializer = XMLSerializer;

const API_BASE = 'http://localhost:8080/api/v1';
const WS_URL = 'ws://localhost:5280/websocket';
const DOMAIN = 'localhost';
const MUC_HOST = 'conference';
const GROUP_ID = '18c4c671-9ced-454b-b7ce-a5eb333b331e';
const OP_USER = 'stevanmosquetti';
const OP_PASS = '12345678';
const CUST_PASS = '12345678';
const CUST_NAME = 'Customer B';
const CUST_UUID = process.argv[2] || crypto.randomUUID();
const CUST_BARE = CUST_UUID + '@' + DOMAIN;

const S = new XMLSerializer();
const xmlOf = (n) => S.serializeToString(n.tree ? n.tree() : n);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CONNECTED = 5, AUTHFAIL = 4, CONNFAIL = 2, CONNTIMEOUT = 10, ERROR = 0;

function connect(label, user, pass) {
  return new Promise((resolve, reject) => {
    const conn = new Strophe.Connection(WS_URL);
    const timer = setTimeout(() => reject(new Error(label + ': connect timeout')), 15000);
    conn.connect(user + '@' + DOMAIN + '/' + label, pass, (status) => {
      if (status === CONNECTED) { clearTimeout(timer); console.log(`[${label}] connected as ${conn.jid}`); resolve(conn); }
      else if ([AUTHFAIL, CONNFAIL, CONNTIMEOUT, ERROR].includes(status)) { clearTimeout(timer); reject(new Error(label + ': XMPP connect failed (status ' + status + ')')); }
    });
  });
}

async function main() {
  console.log(`[1] Registering customer ${CUST_BARE}...`);
  try {
    execSync(`docker exec -u root ejabberd su ejabberd -c "ejabberdctl register ${CUST_UUID} ${DOMAIN} ${CUST_PASS}"`, { stdio: 'pipe' });
    console.log('  registered (or exists)');
  } catch (e) { console.log('  register:', String(e.stdout || e.stderr || '').trim()); }

  console.log('[2] POST /chatroom...');
  const res = await fetch(API_BASE + '/chatroom', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: CUST_UUID, name: CUST_NAME, groupId: GROUP_ID }),
  });
  const roomInfo = await res.json();
  if (!res.ok) throw new Error(`POST /chatroom -> ${res.status}: ${JSON.stringify(roomInfo)}`);
  const ROOM_JID = roomInfo.room + '@' + MUC_HOST;
  console.log('  created room:', ROOM_JID);

  console.log('[3] Customer connects, joins, sends message (operator NOT connected yet)...');
  const cust = await connect('cust', CUST_UUID, CUST_PASS);
  cust.addHandler((st) => { console.log('[cust] <<', xmlOf(st)); return true; });
  const join = $pres({ to: ROOM_JID + '/' + CUST_NAME }).c('x', { xmlns: 'http://jabber.org/protocol/muc' });
  cust.send(join.tree());
  await sleep(1500);
  const m = $msg({ from: cust.jid, to: ROOM_JID, type: 'groupchat' }).c('body').t('Hello from ' + CUST_NAME + '!');
  cust.send(m.tree());
  await sleep(2000);

  console.log('[4] Operator connects NOW (fresh, AFTER the message)...');
  const op = await connect('op', OP_USER, OP_PASS);
  let opGotMessage = null;
  op.addHandler((st) => {
    const x = xmlOf(st);
    console.log('[op]  <<', x);
    if (x.includes('<body>') && x.includes('Hello from ' + CUST_NAME)) opGotMessage = x;
    return true;
  });
  for (let i = 0; i < 20 && !opGotMessage; i++) await sleep(500);

  if (opGotMessage) {
    console.log('[4] OK — operator received the push on RECONNECT:');
    console.log(opGotMessage);
  } else {
    console.log('[4] FATAL — operator received NOTHING on reconnect either.');
  }

  (op.flush ? op.flush() : op.disconnect());
  (cust.flush ? cust.flush() : cust.disconnect());
  await sleep(500);
  process.exit(opGotMessage ? 0 : 1);
}

main().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
