'use strict';
/**
 * Unit-verifies the app's inbound parse (mirrored from lib/xmpp/client.ts)
 * against the REAL MucSub delivery stanza captured from the operator's
 * DevTools Network console. Run FROM strophe-test/.
 */
const { DOMParser } = require('@xmldom/xmldom');

globalThis.DOMParser = DOMParser;

const STANZA = `<message xmlns='jabber:client' to='janedoe@localhost' from='26202808-78af-4b17-8a36-0e8543e16649_18c4c671-9ced-454b-b7ce-a5eb333b331e@conference' id='1793642993287394'><archived by='janedoe@localhost' id='1793642993290172' xmlns='urn:xmpp:mam:tmp'/><stanza-id by='janedoe@localhost' id='1793642993290172' xmlns='urn:xmpp:sid:0'/><event xmlns='http://jabber.org/protocol/pubsub#event'><items node='urn:xmpp:mucsub:nodes:messages'><item id='1793642993287394'><message xml:lang='en' to='janedoe@localhost' from='26202808-78af-4b17-8a36-0e8543e16649_18c4c671-9ced-454b-b7ce-a5eb333b331e@conference/Probe Customer' type='groupchat' xmlns='jabber:client'><archived by='26202808-78af-4b17-8a36-0e8543e16649_18c4c671-9ced-454b-b7ce-a5eb333b331e@conference' id='1793642993287394' xmlns='urn:xmpp:mam:tmp'/><stanza-id by='26202808-78af-4b17-8a36-0e8543e16649_18c4c671-9ced-454b-b7ce-a5eb333b331e@conference' id='1793642993287394' xmlns='urn:xmpp:sid:0'/><occupant-id id='g20AAAAg5iGyiS6e7L8zBZEWGOBQxNjLONRRIQU4bpOXNBNE4c8=' xmlns='urn:xmpp:occupant-id:0'/><body>TEST 2</body></message></item></items></event></message>`;

/* ---- mirror of the element helpers from lib/xmpp/client.ts ---- */
function childByName(el, name) {
  if (!el) return null;
  const kids = el.childNodes || [];
  for (let i = 0; i < kids.length; i++) if (kids[i].nodeName === name) return kids[i];
  return null;
}
function childrenByName(el, name) {
  const out = [];
  if (!el) return out;
  const walk = (n) => {
    if (n.nodeName === name) out.push(n);
    const kids = n.childNodes || [];
    for (let i = 0; i < kids.length; i++) walk(kids[i]);
  };
  walk(el);
  return out;
}
function textOf(el) {
  if (!el) return '';
  return el.textContent ?? '';
}
function stanzaIdOf(el) {
  if (!el) return null;
  return el.getAttribute('id') || textOf(el) || null;
}
function nickOf(jid) {
  const parts = jid.split('/');
  return parts.length > 2 ? parts.slice(2).join('/') : '';
}
const MUC_SERVICE = 'conference';

/* ---- mirror of parseInbound (MucSub branch) ---- */
function parseInbound(st) {
  const ev = childByName(st, 'event');
  if (ev) {
    let inner = null;
    for (const item of childrenByName(ev, 'item')) {
      inner = childByName(item, 'message');
      if (inner) break;
    }
    if (!inner) return null;
    const from = inner.getAttribute('from') ?? '';
    const at = from.indexOf('@');
    if (at <= 0) return null;
    const room = from.slice(0, at);
    const service = from.slice(at + 1).split('/')[0] || MUC_SERVICE;
    const nick = nickOf(from);
    const body = textOf(childByName(inner, 'body'));
    const stanzaId = stanzaIdOf(childByName(inner, 'stanza-id'));
    return {
      kind: 'room',
      room,
      service,
      nick,
      body,
      stanzaId: stanzaId || null,
      ts: Date.parse(st.getAttribute('timestamp') ?? '') || Date.now(),
    };
  }
  return null;
}

const doc = new DOMParser().parseFromString(STANZA, 'text/xml');
const ib = parseInbound(doc.documentElement);
console.log('parsed:', JSON.stringify(ib, null, 2));

const expected = {
  kind: 'room',
  room: '26202808-78af-4b17-8a36-0e8543e16649_18c4c671-9ced-454b-b7ce-a5eb333b331e',
  service: 'conference',
  nick: 'Probe Customer',
  body: 'TEST 2',
  stanzaId: '1793642993287394',
};
const bad = Object.entries(expected).filter(([k, v]) => ib[k] !== v);
console.log(bad.length === 0 ? 'PARSE OK — matches the real delivery' : 'MISMATCH: ' + bad.map(([k, v]) => k).join(', '));
process.exit(bad.length === 0 ? 0 : 1);
