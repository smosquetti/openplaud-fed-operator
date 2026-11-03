/**
 * Debug variant: log EVERY stanza arriving at benjaminmosquetti@localhost
 * so we can see whether/what the MucSub push after transfer looks like.
 *
 * Usage: node benjamin-debug.js [waitSeconds]  (from strophe-test/)
 */
const { Strophe, $pres } = require('strophe.js');
const WebSocket = require('ws');
const { DOMParser } = require('@xmldom/xmldom');
globalThis.WebSocket = WebSocket;
globalThis.DOMParser = DOMParser;

const WAIT_MS = Number(process.argv[2] || 45) * 1000;
let gotEvent = false;

const conn = new Strophe.Connection('ws://localhost:5280/websocket');
conn.connect('benjaminmosquetti@localhost/debug1', '12345678', (status) => {
  if (status === 5) {
    console.log('[ben] CONNECTED');
    conn.send($pres({}).tree());
  } else if ([4, 2, 10, 0].includes(status)) {
    console.error('[ben] connect failed status', status);
    process.exit(1);
  }
});

conn.addHandler((raw) => {
  try {
    const doc = new DOMParser().parseFromString(String(raw), 'text/xml');
    const el = doc.documentElement;
    const type = el.getAttribute('type') || '';
    const from = el.getAttribute('from') || '';
    const to = el.getAttribute('to') || '';
    console.log('[ben] << ' + el.nodeName + ' type=' + type + ' from=' + from + ' to=' + to);
    if (el.nodeName === 'message' && from.includes('@conference')) {
      console.log('[ben] RAW:', String(raw).slice(0, 1200));
    }
    if (el.nodeName === 'message' && el.querySelector('event')) {
      gotEvent = true;
    }
  } catch (_) {}
  return true;
});

setTimeout(() => {
  console.log(gotEvent ? 'RESULT benjaminGotMucSub: true' : 'RESULT benjaminGotMucSub: false');
  process.exit(gotEvent ? 0 : 2);
}, WAIT_MS);
