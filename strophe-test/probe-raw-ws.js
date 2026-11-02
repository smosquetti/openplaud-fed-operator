// Raw XEP-0138 stream probe: what does ejabberd say to a bare <open>?
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:5280/websocket');
let n = 0;
ws.on('open', () => {
  console.log(">> <open to='localhost' id='probe-raw-1'>");
  ws.send(`<open to='localhost' id='probe-raw-1' xmlns='urn:ietf:params:xml:ns:xmpp-stanzas'></open>`);
});
ws.on('message', (d) => {
  const s = d.toString();
  console.log('<<', s.slice(0, 500));
  n++;
  if (n >= 3 || s.includes('<close')) setTimeout(() => process.exit(0), 200);
});
ws.on('close', (c) => {
  console.log('closed code=', c.code, 'reason=', c.reason.toString());
  process.exit(0);
});
ws.on('error', (e) => {
  console.log('ERR', e.message);
  process.exit(1);
});
setTimeout(() => process.exit(2), 10000);
