'use strict';
/**
 * openplaud end-to-end MucSub flow test.
 *
 * 1. Register a new customer user on the XMPP server (random-UUID localpart).
 * 2. Create the temporary MUC via the OpenPlaud Admin API (POST /chatroom).
 *    The API sets affiliations (customer=member, operators=admin) and
 *    MucSub-subscribes the customer + the group's operators to the room.
 * 3. Customer connects (Strophe over WebSocket) and JOINS the MUC.
 * 4. Customer sends a groupchat message to the room.
 * 5. Operator (MucSub subscriber, does NOT join) receives the message.
 * 6. Operator runs a query battery (occupants / affiliations / mucsub / MAM)
 *    to determine the exact formats the app can use for title resolution,
 *    history and subscription discovery.
 *
 * Usage: NODE_PATH=/tmp/strophe-test/node_modules node test-flow.js [customer-uuid]
 */
const { execSync } = require('child_process');
const crypto = require('crypto');
const { Strophe, $iq, $msg, $pres } = require('strophe.js');
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
const xmlOf = (n) => {
  const el = n && n.nodeName
    ? n
    : (n && typeof n.tree === 'function' ? n.tree() : n);
  return S.serializeToString(el);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Strophe 5.x Status values (module-local const, NOT exported as Strophe.Status)
const CONNECTED = 5;
const AUTHFAIL = 4;
const CONNFAIL = 2;
const CONNTIMEOUT = 10;
const ERROR = 0;

function connect(label, user, pass) {
  return new Promise((resolve, reject) => {
    const conn = new Strophe.Connection(WS_URL);
    const timer = setTimeout(() => reject(new Error(label + ': connect timeout')), 15000);
    conn.connect(user + '@' + DOMAIN + '/' + label, pass, (status) => {
      if (status === CONNECTED) {
        clearTimeout(timer);
        console.log(`[${label}] connected as ${conn.jid}`);
        resolve(conn);
      } else if (status === AUTHFAIL || status === CONNFAIL || status === CONNTIMEOUT || status === ERROR) {
        clearTimeout(timer);
        reject(new Error(label + ': XMPP connect failed (status ' + status + ')'));
      }
    });
  });
}

async function main() {
  // ---- 1. Register customer on XMPP server
  console.log(`[1] Registering customer ${CUST_BARE} on XMPP server...`);
  try {
    execSync(
      `docker exec -u root ejabberd su ejabberd -c "ejabberdctl register ${CUST_UUID} ${DOMAIN} ${CUST_PASS}"`,
      { stdio: 'pipe' }
    );
    console.log('  registered (or already exists)');
  } catch (e) {
    console.log('  register output:', String(e.stdout || e.stderr || '').trim());
  }

  // ---- 2. Create temp MUC room via admin API (public endpoint)
  console.log('[2] POST /chatroom (OpenPlaud Admin API)...');
  const res = await fetch(API_BASE + '/chatroom', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: CUST_UUID, name: CUST_NAME, groupId: GROUP_ID }),
  });
  const roomInfo = await res.json();
  if (!res.ok) throw new Error(`POST /chatroom -> ${res.status}: ${JSON.stringify(roomInfo)}`);
  const ROOM = roomInfo.room;
  const ROOM_JID = ROOM + '@' + MUC_HOST;
  console.log('  created room:', ROOM_JID);

  // ---- 3. Connect operator (subscriber, will NOT join) + customer
  console.log('[3] Connecting operator (subscribed, will NOT join) and customer...');
  const [op, cust] = await Promise.all([
    connect('op', OP_USER, OP_PASS),
    connect('cust', CUST_UUID, CUST_PASS),
  ]);
  // Operator is NOT an occupant: the MucSub push routes to the bare JID.
  // Send an initial base presence (availability) so the server has a
  // session to route bare-JID packets to.
  op.send($pres());

  let opGotMessage = null;
  op.addHandler((st) => {
    const x = xmlOf(st);
    console.log('[op]  <<', x);
    if (x.includes('<body>') && x.includes('Hello from ' + CUST_NAME)) opGotMessage = x;
    return true;
  });
  cust.addHandler((st) => {
    console.log('[cust] <<', xmlOf(st));
    return true;
  });

  // ---- 4. Customer joins the MUC.
  // In this MucSub build the join is a PRESENCE stanza addressed to
  // room@host/Nick carrying an empty muc namespace <x> (NOT a groupchat message).
  console.log('[4] Customer joins', ROOM_JID, 'as', CUST_NAME);
  const join = $pres({ to: ROOM_JID + '/' + CUST_NAME })
    .c('x', { xmlns: 'http://jabber.org/protocol/muc' });
  cust.send(join.tree());
  await sleep(1500);

  // ---- 5. Customer sends the message
  console.log('[5] Customer sends message to the MUC');
  const m = $msg({ from: cust.jid, to: ROOM_JID, type: 'groupchat' })
    .c('body').t('Hello from ' + CUST_NAME + '!');
  cust.send(m.tree());

  for (let i = 0; i < 30 && !opGotMessage; i++) await sleep(500);
  if (!opGotMessage) console.log('[5] WARN — operator received NOTHING (no <body> match). Continuing to query battery...');
  else console.log('[5] OK — operator (subscribed, NOT joined) received the MucSub delivery.');

  // ---- 6. Operator query battery (operator is NOT an occupant of the room)
  console.log('[6] Operator query battery');

  const runIQ = (label, tree) => new Promise((resolve) => {
    const t = setTimeout(() => {
      console.log(label + ': TIMEOUT (no response)');
      resolve();
    }, 8000);
    op.sendIQ(tree,
      (result) => { clearTimeout(t); console.log(label + ' RESULT:', xmlOf(result)); resolve(); },
      (error) => { clearTimeout(t); console.log(label + ' ERROR:', xmlOf(error)); resolve(); });
  });

  // Q1: standard XEP-0045 occupants query (muc#user)
  await runIQ('Q1 muc#user occupants',
    $iq({ to: ROOM_JID, type: 'get' })
      .c('query', { xmlns: 'http://jabber.org/protocol/muc#user' })
      .c('item', { affiliation: 'none', jid: CUST_BARE, role: 'none' }).tree());

  // Q2: muc#admin — item affiliation='member' (user's spec mechanism)
  await runIQ('Q2 muc#admin item affiliation=member',
    $iq({ to: ROOM_JID, type: 'get' })
      .c('query', { xmlns: 'http://jabber.org/protocol/muc#admin' })
      .c('item', { affiliation: 'member' }).tree());

  // Q3: muc#admin — item role='participant' (general occupants, jid/nick/role/affiliation)
  await runIQ('Q3 muc#admin item role=participant',
    $iq({ to: ROOM_JID, type: 'get' })
      .c('query', { xmlns: 'http://jabber.org/protocol/muc#admin' })
      .c('item', { role: 'participant' }).tree());

  // Q4: user's literal example (xmlns http://jabber.org)
  await runIQ('Q4 spec literal (xmlns http://jabber.org)',
    $iq({ to: ROOM_JID, type: 'get' })
      .c('query', { xmlns: 'http://jabber.org' })
      .c('item', { affiliation: 'member' }).tree());

  // Q5: MucSub subscriptions list (room-level, ns urn:xmpp:mucsub:0)
  await runIQ('Q5 mucsub subscriptions',
    $iq({ to: ROOM_JID, type: 'get' })
      .c('subscriptions', { xmlns: 'urn:xmpp:mucsub:0' }).tree());

  // Q6: MAM history for the room
  const end = Math.floor(Date.now() / 1000) + 60;
  await runIQ('Q6 MAM room history',
    $iq({ to: DOMAIN, type: 'get' })
      .c('query', { xmlns: 'urn:xmpp:mam:2', to: ROOM_JID, id: 'mame2e1' })
      .c('x', { xmlns: 'jabber:x:data', type: 'get' })
      .c('field', { 'var': 'start' }).c('value').t('0').up().up()
      .c('field', { 'var': 'end' }).c('value').t(String(end)).up().up()
      .c('field', { 'var': 'max-items' }).c('value').t('50').up().tree());

  // ---- 7. Done
  console.log('[7] DONE — disconnecting.');
  (op.flush ? op.flush() : op.disconnect());
  (cust.flush ? cust.flush() : cust.disconnect());
  await sleep(500);
  process.exit(0);
}

main().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
