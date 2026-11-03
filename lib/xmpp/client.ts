/**
 * Strophe-based XMPP client for the operator interface (browser-only).
 *
 * Transport: native WebSocket to ejabberd's `ejabberd_http_ws` handler
 * (no BOSH). All stanza shapes below were verified live against the
 * running ejabberd 26.9 server (see strophe-test/).
 *
 * IMPORTANT: this module must only be imported from client components —
 * it touches window/DOM globals through the Strophe browser bundle.
 */
import { $iq, $msg, $pres, Strophe } from 'strophe.js';

const DOMAIN = process.env.NEXT_PUBLIC_XMPP_DOMAIN ?? 'localhost';
export const MUC_SERVICE = process.env.NEXT_PUBLIC_XMPP_SERVICE ?? 'conference';
const WS_URL = process.env.NEXT_PUBLIC_XMPP_WS_URL ?? 'ws://localhost:5280/websocket';

const { CONNECTED, CONNFAIL, AUTHFAIL, CONNTIMEOUT, ERROR, DISCONNECTED, CONNECTING, RECONNECTING } =
  Strophe.Status;

export const XmppStatus = {
  CONNECTED,
  CONNFAIL,
  AUTHFAIL,
  CONNTIMEOUT,
  ERROR,
  DISCONNECTED,
  CONNECTING,
  RECONNECTING,
} as const;

/* ---------- namespace-agnostic element helpers (work on DOM + xmldom) ---------- */

export function childByName(el: Element | null | undefined, name: string): Element | null {
  if (!el) return null;
  const kids = el.childNodes || [];
  for (let i = 0; i < kids.length; i++) {
    if (kids[i].nodeName === name) return kids[i] as Element;
  }
  return null;
}

export function childrenByName(el: Element | null | undefined, name: string): Element[] {
  const out: Element[] = [];
  if (!el) return out;
  const walk = (n: Element) => {
    if (n.nodeName === name) out.push(n);
    const kids = n.childNodes || [];
    for (let i = 0; i < kids.length; i++) walk(kids[i] as Element);
  };
  walk(el);
  return out;
}

export function textOf(el: Element | null | undefined): string {
  if (!el) return '';
  return el.textContent ?? '';
}

/** Stanza-id of an element (this server carries it in the `id` attribute). */
function stanzaIdOf(el: Element | null | undefined): string | null {
  if (!el) return null;
  return el.getAttribute('id') || textOf(el) || null;
}

/* ---------- JID helpers ---------- */

export function localpart(jid: string): string {
  return jid.split('@')[0] ?? jid;
}

export function bareOf(jid: string): string {
  return jid.split('/').slice(0, 2).join('/');
}

export function roomJid(room: string, service: string): string {
  return `${room}@${service}`;
}

/** Occupant nick of a room JID (`room@service/Nick` — nick is the 2nd part). */
export function nickOf(jid: string): string {
  const parts = jid.split('/');
  return parts.length > 1 ? parts.slice(1).join('/') : '';
}

/* ---------- Inbound stanza normalization ---------- */

export type Inbound =
  | { kind: 'room'; room: string; service: string; nick: string; body: string; stanzaId: string | null; ts: number }
  | { kind: 'dm'; from: string; body: string; ts: number };

/**
 * Normalizes a received <message> stanza:
 *  - MucSub wrapper: <message from='room@conference'><event ...><items node='...messages'>
 *      <item><message from='room@conference/Nick' type='groupchat'><body>..</body></message></item>
 *  - Direct MUC groupchat: <message from='room@conference/Nick' type='groupchat'>
 *  - Direct 1:1 chat: <message from='user@domain' type='chat'>
 * Returns null for stanzas the UI does not care about.
 */
export function parseInbound(st: Element): Inbound | null {
  const ev = childByName(st, 'event');
  if (ev) {
    // MucSub delivery (XEP-0412): find the inner room message.
    let inner: Element | null = null;
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

  const from = st.getAttribute('from') ?? '';
  const type = st.getAttribute('type');
  const at = from.indexOf('@');

  if (at > 0 && from.slice(at + 1).split('/')[0] === MUC_SERVICE) {
    // MUC stanza: occupant echo (from='room@conference/Nick') or room system
    // message (from='room@conference' — join/subject/creation, no <body>).
    // The service part is everything up to the first '/', because occupant
    // JIDs carry the nick after it.
    const nick = nickOf(from);
    if (!nick || type !== 'groupchat') return null;
    const body = textOf(childByName(st, 'body'));
    const stanzaId = stanzaIdOf(childByName(st, 'stanza-id'));
    return {
      kind: 'room',
      room: from.slice(0, at),
      service: MUC_SERVICE,
      nick,
      body,
      stanzaId: stanzaId || null,
      ts: Date.parse(st.getAttribute('timestamp') ?? '') || Date.now(),
    };
  }

  if (type === 'chat' && at > 0) {
    // Direct 1:1 chat message to the operator.
    const body = textOf(childByName(st, 'body'));
    return { kind: 'dm', from: from.slice(0, at + 1), body, ts: Date.parse(st.getAttribute('timestamp') ?? '') || Date.now() };
  }

  return null;
}

/* ---------- Client ---------- */

export interface ClientEvents {
  onStatus: (status: number) => void;
  onMessage: (st: Element) => void;
  onPresence: (st: Element) => void;
}

const IQ_TIMEOUT_MS = 12000;

/** Instance type of Strophe.Connection — not exported directly from the package root. */
type ConnectionInstance = InstanceType<NonNullable<typeof Strophe['Connection']>>;

export class XmppClient {
  readonly conn: ConnectionInstance;
  private events: ClientEvents;

  constructor(events: ClientEvents) {
    this.events = events;
    this.conn = new Strophe.Connection(WS_URL);
    // One catch-all handler; filter by element name below. It MUST return
    // true to stay active — strophe.js 5 removes a handler after its first
    // invocation when it returns false, and a removed handler silently
    // drops every later stanza (the Node flow tests use this same
    // catch-all with a true return).
    this.conn.addHandler(
      (st: Element) => {
        if (st.nodeName === 'message') this.events.onMessage(st);
        else if (st.nodeName === 'presence') this.events.onPresence(st);
        return true;
      },
      null,
      null,
      null,
    );
  }

  connect(jid: string, pass: string, resource: string): void {
    this.conn.connect(
      `${jid}/${resource}`,
      pass,
      (status: number) => {
        this.events.onStatus(status);
      },
    );
  }

  /** Initial availability — required for MucSub routing to reach the operator. */
  sendPresence(): void {
    this.conn.send($pres().tree());
  }

  /**
   * MucSub (XEP-0412) subscribe to a room's message node:
   * <iq type='set' to='room@conference'><subscribe xmlns='urn:xmpp:mucsub:0' nick='...'/></iq>
   * (type='get' is rejected by this server build.)
   */
  mucSubscribe(roomJid: string, nick: string): Promise<boolean> {
    const tree = $iq({ to: roomJid, type: 'set' }).c('subscribe', { xmlns: 'urn:xmpp:mucsub:0', nick }).tree();
    return this.sendIq(tree).then((r) => {
      const el = r ? childByName(r, 'subscribe') : null;
      return !!el;
    });
  }

  /**
   * List of MucSub subscribers for a room:
   * <iq type='get' to='room@conference'><subscriptions xmlns='urn:xmpp:mucsub:0'/></iq>
   * Result contains <subscription jid='...' nick='...'/> entries.
   */
  mucSubscriptions(roomJid: string): Promise<Element | null> {
    const tree = $iq({ to: roomJid, type: 'get' }).c('subscriptions', { xmlns: 'urn:xmpp:mucsub:0' }).tree();
    return this.sendIq(tree);
  }

  /** Room info (title etc.): <iq type='get' to='room@conference'><query muc#1/></iq>. */
  mucInfo(roomJid: string): Promise<Element | null> {
    const tree = $iq({ to: roomJid, type: 'get' }).c('query', { xmlns: 'http://jabber.org/protocol/muc#1' }).tree();
    return this.sendIq(tree);
  }

  /**
   * MAM archive stats for a partner (this server build returns ONLY
   * <set count first last> — never stanza content):
   * <iq type='set' to='domain'><query mam:2 to='PARTNER'>
   *   <x type='result'><field var='with'><value>PARTNER</value></field></x></query></iq>
   */
  mamStats(partnerJid: string): Promise<number | null> {
    const q: Record<string, string> = { xmlns: 'urn:xmpp:mam:2', to: partnerJid };
    const tree = $iq({ to: DOMAIN, type: 'set' })
      .c('query', q)
      .c('x', { xmlns: 'jabber:x:data', type: 'result' })
      .c('field', { var: 'with' })
      .c('value')
      .t(partnerJid)
      .up()
      .tree();
    return this.sendIq(tree).then((r) => {
      if (!r) return null;
      const fin = childByName(r, 'fin');
      const set = fin ? childByName(fin, 'set') : null;
      const count = set?.getAttribute('count');
      return count != null && count !== '' ? parseInt(count, 10) : null;
    });
  }

  /** MUC join: presence to room@conference/Nick with an empty muc#1 <x/>. */
  mucJoin(roomJid: string, nick: string): void {
    this.conn.send($pres({ to: `${roomJid}/${nick}` }).c('x', { xmlns: 'http://jabber.org/protocol/muc' }).tree());
  }

  /** MUC leave: unavailable presence to the occupant JID. */
  mucLeave(roomJid: string, nick: string): void {
    this.conn.send($pres({ to: `${roomJid}/${nick}`, type: 'unavailable' }).tree());
  }

  /** Groupchat message to a room (sender must be an occupant). */
  sendGroupMessage(roomJid: string, body: string): void {
    this.conn.send($msg({ to: roomJid, type: 'groupchat' }).c('body').t(body).tree());
  }

  /** Direct 1:1 chat message. */
  sendDirect(toJid: string, body: string): void {
    this.conn.send($msg({ to: toJid, type: 'chat' }).c('body').t(body).tree());
  }

  flush(): void {
    this.conn.flush();
  }

  disconnect(): void {
    this.conn.disconnect();
  }

  private sendIq(tree: Element): Promise<Element | null> {
    return new Promise((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        resolve(null);
      }, IQ_TIMEOUT_MS);
      this.conn.sendIQ(
        tree,
        (result: Element) => {
          clearTimeout(timer);
          if (!settled) {
            settled = true;
            resolve(result);
          }
        },
        (error: Element | null) => {
          clearTimeout(timer);
          if (!settled) {
            settled = true;
            resolve(error);
          }
        },
      );
    });
  }
}
