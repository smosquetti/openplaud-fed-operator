'use strict';
/**
 * E2E customer side (operator is the BROWSER, this script is the customer).
 *
 * 1. Register a fresh customer on ejabberd.
 * 2. POST /chatroom {user,name,groupId} -> creates the temp room and
 *    auto-subscribes the group's operators (so the browser operator gets a
 *    MucSub delivery and a card appears).
 * 3. Customer MUC-joins the room and sends messages (drives the operator card).
 * 4. Stays in the room for KEEP_S seconds, logging every incoming message, so
 *    that after the operator ACCEPTS the call (POST /join + MUC join) and sends
 *    a reply, we can confirm the customer received it (1:1 works).
 *
 * Run FROM strophe-test/ (own node_modules):  node e2e-customer.js
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
const CUST_PASS = '12345678';

const CUST_UUID = process.argv[2] || crypto.randomUUID();
const CUST_NAME = process.argv[3] || 'E2E Customer';
const KEEP_S = parseInt(process.argv[4] || '60', 10);

const S = new XMLSerializer();
const el = (n) => (n && n.nodeName) ? n : (n && typeof n.tree === 'function' ? n.tree() : null);
const xmlOf = (n) => { const e = el(n); return e ? S.serializeToString(e) : String(n); };
function bodyOf(root) {
  const walk = (n) => {
    if (n.nodeName === 'body') { const c = n.childNodes[0]; return c ? c.nodeValue : ''; }
    const k = n.childNodes || [];
    for (let i = 0; i < k.length; i++) { const r = walk(k[i]); if (r !== undefined) return r; }
    return undefined;
  };
  return walk(root) || '';
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CONNECTED = 5, AUTHFAIL = 4, CONNFAIL = 2, CONNTIMEOUT = 10, ERROR = 0;

function connect(user, pass, res) {
  return new Promise((resolve, reject) => {
    const conn = new Strophe.Connection(WS_URL);
    const timer = setTimeout(() => reject(new Error('connect timeout')), 15000);
    conn.connect(user + '@' + DOMAIN + '/' + res, pass, (status) => {
      if (status === CONNECTED) { clearTimeout(timer); resolve(conn); }
      else if ([AUTHFAIL, CONNFAIL, CONNTIMEOUT, ERROR].includes(status)) {
        clearTimeout(timer); reject(new Error('connect failed status ' + status));
      }
    });
  });
}

async function main() {
  try {
    execSync(`docker exec -u root ejabberd su ejabberd -c "ejabberdctl register ${CUST_UUID} ${DOMAIN} ${CUST_PASS}"`, { stdio: 'pipe' });
    console.log('customer registered');
  } catch (e) {
    console.log('register output:', String(e.stdout || e.stderr || '').trim());
  }

  const res = await fetch(API_BASE + '/chatroom', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: CUST_UUID, name: CUST_NAME, groupId: GROUP_ID }),
  });
  const roomInfo = await res.json();
  if (!res.ok) throw new Error('POST /chatroom -> ' + res.status + ' ' + JSON.stringify(roomInfo));
  const ROOM = roomInfo.room + '@' + MUC_HOST;
  console.log('room:', ROOM);

  const cust = await connect(CUST_UUID, CUST_PASS, 'e2ecust');
  let gotOperatorReply = false;
  cust.addHandler((st) => {
    if (st.nodeName === 'message') {
      const e = el(st);
      const from = (e && e.getAttribute) ? e.getAttribute('from') : '';
      const nick = (from.split('@')[1] || '').split('/')[1] || '';
      const b = bodyOf(e);
      if (nick === CUST_NAME) {
        console.log('[cust] << (own echo, ignored)', b || '');
      } else {
        console.log('[cust] <<', nick ? nick + ': ' : '', b || xmlOf(st).slice(0, 200));
      }
      if (nick !== CUST_NAME && b && /operator|E2E op/i.test(b)) gotOperatorReply = true;
    }
    return true;
  });

  cust.send($pres({ to: ROOM + '/' + CUST_NAME }).c('x', { xmlns: 'http://jabber.org/protocol/muc' }).tree());
  await sleep(1500);
  cust.send($msg({ to: ROOM, type: 'groupchat' }).c('body').t('E2E hello from the customer').tree());
  await sleep(1000);
  cust.send($msg({ to: ROOM, type: 'groupchat' }).c('body').t('E2E this should make the operator card appear').tree());
  console.log('customer sent 2 messages. Staying in room', KEEP_S, 's (waiting for operator accept + reply)...');

  const deadline = Date.now() + KEEP_S * 1000;
  while (Date.now() < deadline && !gotOperatorReply) await sleep(1500);
  console.log('RESULT gotOperatorReply:', gotOperatorReply);
  (cust.flush ? cust.flush() : cust.disconnect());
  await sleep(500);
  process.exit(gotOperatorReply ? 0 : 2);
}

main().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
