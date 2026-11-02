'use strict';
/**
 * Operator-side probe: verifies every XMPP behavior the web app will rely on.
 *
 * A. Group (persistent) room:
 *    1. MucSub subscribe (try type=get <subscribe/>, then type=set if needed)
 *    2. Verify via <subscriptions> query
 *    3. Send groupchat WITHOUT joining (accepted? dropped? error?)
 *    4. MUC join, then send (echo back?)
 * B. Temp room (new customer):
 *    5. API POST /chatroom, customer connects + joins + sends 2 messages
 *    6. Operator receives via MucSub
 *    7. MAM history query (correct form: <x type="result">)
 *    8. API POST /chatroom/join (accepts call, outcasts other operators)
 *    9. Operator MUC join (nick = operator name) + sends message
 *   10. Customer receives operator's message
 *   11. Verify callagent affiliation after /join (expect outcast)
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
const CUST_PASS = '12345678';
const CUST_NAME = 'Probe Customer';

const CUST_UUID = process.argv[2] || crypto.randomUUID();
const CUST_BARE = CUST_UUID + '@' + DOMAIN;

const S = new XMLSerializer();
const el = (n) => (n && n.nodeName) ? n : (n && typeof n.tree === 'function' ? n.tree() : null);
const xmlOf = (n) => {
  const e = el(n);
  return e ? S.serializeToString(e) : String(n);
};
// xmldom Elements lack querySelectorAll; walk childNodes instead.
function findAll(node, name) {
  const out = [];
  const walk = (n) => {
    if (n.nodeName === name) out.push(n);
    const kids = n.childNodes || [];
    for (let i = 0; i < kids.length; i++) walk(kids[i]);
  };
  walk(node);
  return out;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
      } else if ([AUTHFAIL, CONNFAIL, CONNTIMEOUT, ERROR].includes(status)) {
        clearTimeout(timer);
        reject(new Error(label + ': XMPP connect failed (status ' + status + ')'));
      }
    });
  });
}

async function apiGet(path) {
  const r = await fetch(API_BASE + path, {
    headers: { Authorization: 'Basic ' + Buffer.from(OP_USER + ':' + OP_PASS).toString('base64') },
  });
  const body = await r.text();
  if (!r.ok) throw new Error(path + ' -> ' + r.status + ': ' + body);
  return JSON.parse(body);
}

async function main() {
  // ---- register customer first (connect happens below)
  try {
    execSync(
      `docker exec -u root ejabberd su ejabberd -c "ejabberdctl register ${CUST_UUID} ${DOMAIN} ${CUST_PASS}"`,
      { stdio: 'pipe' }
    );
    console.log('customer registered');
  } catch (e) {
    console.log('register output:', String(e.stdout || e.stderr || '').trim());
  }

  const [cust] = await Promise.all([
    connect('cust', CUST_UUID, CUST_PASS),
  ]);

  const custLog = [];
  cust.addHandler((st) => {
    const x = xmlOf(st);
    custLog.push(x);
    console.log('[cust] <<', x.length > 400 ? x.slice(0, 400) + '…' : x);
    return true;
  });

  const runIQ = (label, tree, ms = 8000) => new Promise((resolve) => {
    const t = setTimeout(() => { console.log(label + ': TIMEOUT'); resolve(null); }, ms);
    op.sendIQ(tree,
      (result) => { clearTimeout(t); console.log(label + ' RESULT:', xmlOf(result).slice(0, 1200)); resolve(result); },
      (error) => { clearTimeout(t); console.log(label + ' ERROR:', xmlOf(error).slice(0, 800)); resolve(error); });
  });


  // ================= B. Temp room =================
  console.log('\n===== B. TEMP ROOM =====');
  const res = await fetch(API_BASE + '/chatroom', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: CUST_UUID, name: CUST_NAME, groupId: GROUP_ID }),
  });
  const roomInfo = await res.json();
  if (!res.ok) throw new Error('POST /chatroom -> ' + res.status);
  const RAW_ROOM = roomInfo.room;
  const ROOM = RAW_ROOM + '@' + MUC_HOST;
  console.log('B: room', ROOM);

  cust.send($pres({ to: ROOM + '/' + CUST_NAME }).c('x', { xmlns: 'http://jabber.org/protocol/muc' }).tree());
  await sleep(1500);
  cust.send($msg({ to: ROOM, type: 'groupchat' }).c('body').t('TEST MESSAGE').tree());
  await sleep(8000);

  console.log('\nDONE — disconnecting.');
  (cust.flush ? cust.flush() : cust.disconnect());
  await sleep(500);
  process.exit(0);
}

main().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
