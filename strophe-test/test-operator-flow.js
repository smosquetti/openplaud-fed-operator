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
const OP_USER = 'stevanmosquetti';
const OP_PASS = '12345678';
const OP_NAME = 'Stevan Mosquetti';
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
    console.log('customer registered (or already exists)');
  } catch (e) {
    console.log('register output:', String(e.stdout || e.stderr || '').trim());
  }

  // ---- operatorId + group room
  const ops = await apiGet('/operators');
  const me = ops.find((o) => o.xmppUser === OP_USER);
  if (!me) throw new Error('operator not found in API list');
  console.log('operatorId:', me.id, '->', ops.length, 'operators total');
  const groups = await apiGet('/operators/' + me.id + '/groups');
  const group = groups.find((g) => g.id === GROUP_ID);
  if (!group) throw new Error('group not found');
  const GROUP_ROOM = group.room + '@' + (group.service || MUC_HOST);
  console.log('group room:', GROUP_ROOM);

  const [op, cust] = await Promise.all([
    connect('op', OP_USER, OP_PASS),
    connect('cust', CUST_UUID, CUST_PASS),
  ]);
  op.send($pres());

  const opLog = [];
  op.addHandler((st) => {
    const x = xmlOf(st);
    opLog.push(x);
    console.log('[op]  <<', x.length > 400 ? x.slice(0, 400) + '…' : x);
    return true;
  });
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

  // ================= A. Group room =================
  console.log('\n===== A. GROUP ROOM =====');
  // A1: MucSub subscribe — <subscribe/> needs a nick attribute
  let r = await runIQ('A1 mucsub subscribe (type=get, nick)',
    $iq({ to: GROUP_ROOM, type: 'get' }).c('subscribe', { xmlns: 'urn:xmpp:mucsub:0', nick: OP_NAME }).tree());
  let subOK = !!(r && el(r) && el(r).getAttribute('type') === 'result');
  if (!subOK) {
    r = await runIQ('A1b mucsub subscribe (type=set, nick)',
      $iq({ to: GROUP_ROOM, type: 'set' }).c('subscribe', { xmlns: 'urn:xmpp:mucsub:0', nick: OP_NAME }).tree());
    subOK = !!(r && el(r) && el(r).getAttribute('type') === 'result');
  }
  console.log('A1 subscribe accepted:', subOK);

  // A2: verify subscription
  const subs = await runIQ('A2 mucsub subscriptions (group)',
    $iq({ to: GROUP_ROOM, type: 'get' }).c('subscriptions', { xmlns: 'urn:xmpp:mucsub:0' }).tree());
  const subsEl = el(subs);
  if (subsEl && subsEl.nodeName === 'iq') {
    const items = findAll(subsEl, 'subscription');
    console.log('A2 subscribers:', items.map((i) => i.getAttribute('jid')).join(', ') || '(none)');
  }

  // A3: send groupchat WITHOUT joining
  console.log('\nA3: send groupchat to group room (NOT joined) — waiting 4s for echo/error…');
  const before = opLog.length;
  op.send($msg({ to: GROUP_ROOM, type: 'groupchat' }).c('body').t('probe-a3-nojoin').tree());
  await sleep(4000);
  const a3 = opLog.slice(before).filter((x) => x.includes('probe-a3-nojoin'));
  console.log('A3 echo received (not joined):', a3.length > 0 ? 'YES' : 'NO');

  // A4: MUC join group room, then send
  console.log('\nA4: MUC join group room, then send…');
  op.send($pres({ to: GROUP_ROOM + '/' + OP_NAME }).c('x', { xmlns: 'http://jabber.org/protocol/muc' }).tree());
  await sleep(2000);
  const before4 = opLog.length;
  op.send($msg({ to: GROUP_ROOM, type: 'groupchat' }).c('body').t('probe-a4-joined').tree());
  await sleep(4000);
  const a4 = opLog.slice(before4).filter((x) => x.includes('probe-a4-joined'));
  console.log('A4 echo received (joined):', a4.length > 0 ? 'YES' : 'NO');

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
  cust.send($msg({ to: ROOM, type: 'groupchat' }).c('body').t('Hello 1').tree());
  await sleep(1000);
  cust.send($msg({ to: ROOM, type: 'groupchat' }).c('body').t('Hello 2').tree());
  await sleep(3000);
  const gotSub = opLog.filter((x) => x.includes('Hello 1') && x.includes('mucsub')).length;
  console.log('B6: operator MucSub deliveries for customer messages:', gotSub);

  // B7: MAM history (correct form: <x type="result">)
  const end = Math.floor(Date.now() / 1000) + 60;
  const mam = await runIQ('B7 MAM history (type=result)',
    $iq({ to: DOMAIN, type: 'get' })
      .c('query', { xmlns: 'urn:xmpp:mam:2', to: ROOM, id: 'probe-mam' })
      .c('x', { xmlns: 'jabber:x:data', type: 'result' })
      .c('field', { 'var': 'start' }).c('value').t('0').up().up()
      .c('field', { 'var': 'end' }).c('value').t(String(end)).up().up()
      .c('field', { 'var': 'max-items' }).c('value').t('50').up().up()
      .tree());
  const mamEl = el(mam);
  if (mamEl && mamEl.nodeName === 'iq') {
    const items = findAll(mamEl, 'item');
    console.log('B7 MAM items:', items.length, '— bodies:',
      items.map((i) => {
        const b = findAll(i, 'body')[0];
        return b ? (b.childNodes[0] ? b.childNodes[0].nodeValue : b.textContent) : '';
      }).filter(Boolean).join(' | '));
  }

  // B8: API join (accepts call)
  const joinRes = await fetch(API_BASE + '/chatroom/join', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operatorId: me.id, groupId: GROUP_ID, room: RAW_ROOM }),
  });
  console.log('B8 POST /chatroom/join ->', joinRes.status);

  // B9: operator MUC join + send
  op.send($pres({ to: ROOM + '/' + OP_NAME }).c('x', { xmlns: 'http://jabber.org/protocol/muc' }).tree());
  await sleep(1500);
  op.send($msg({ to: ROOM, type: 'groupchat' }).c('body').t('Hello from operator').tree());
  await sleep(3000);
  console.log('B10 customer got operator msg:', custLog.some((x) => x.includes('Hello from operator')) ? 'YES' : 'NO');

  // B11: callagent affiliation
  await runIQ('B11 callagent affiliation',
    $iq({ to: ROOM, type: 'get' }).c('query', { xmlns: 'http://jabber.org/protocol/muc#admin' })
      .c('item', { jid: 'callagent@localhost' }).tree());

  console.log('\nDONE — disconnecting.');
  (op.flush ? op.flush() : op.disconnect());
  (cust.flush ? cust.flush() : cust.disconnect());
  await sleep(500);
  process.exit(0);
}

main().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
