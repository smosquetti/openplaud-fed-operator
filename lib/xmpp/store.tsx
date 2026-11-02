'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { XmppClient, Inbound } from './client';
import { apiFetch } from '@/lib/api';
import type { OperatorSession } from '@/lib/auth';
import type { Group, Operator } from '@/lib/types';
import { useToasts } from '@/components/Toaster';

const SERVICE = process.env.NEXT_PUBLIC_XMPP_SERVICE ?? 'conference';
const HISTORY_KEY = 'openplaud.operator.history';
const MAX_MSGS_PER_ROOM = 500;

export interface ChatMsg {
  key: string;
  from: string;
  mine: boolean;
  sys: boolean;
  body: string;
  ts: number;
}

export type RoomKind = 'group' | 'temp' | 'dm';
export type CallState = 'new' | 'accepted' | 'transferred';

export interface RoomState {
  room: string;
  service: string;
  kind: RoomKind;
  groupId: string | null;
  group: string | null;
  title: string;
  titleFixed: boolean;
  lastBody: string;
  lastTs: number;
  msgs: ChatMsg[];
  call: CallState;
  transferredTo: string | null;
  joined: boolean;
  joining: boolean;
  accepting: boolean;
  mamCount: number | null;
  mamLoading: boolean;
  open: boolean;
  minimized: boolean;
  x: number | null;
  y: number | null;
  z: number;
  lastSeenTs: number;
  pendingBody: string | null;
}

export interface TransferCandidate {
  id: string;
  name: string;
  xmppUser: string;
  nick: string | null;
}

interface ChatStoreValue {
  xmpp: 'connecting' | 'connected' | 'offline' | 'error';
  groups: Group[];
  rooms: RoomState[];
  openRooms: RoomState[];
  minimizedRooms: RoomState[];
  myNick: string;
  openRoom: (room: string) => void;
  closeRoom: (room: string) => void;
  minimizeRoom: (room: string) => void;
  restoreRoom: (room: string) => void;
  focusRoom: (room: string) => void;
  moveRoom: (room: string, x: number, y: number) => void;
  unreadOf: (r: RoomState) => number;
  send: (room: string, text: string) => void;
  acceptCall: (room: string) => void;
  transferCall: (room: string, toId: string, toName: string) => Promise<boolean>;
  loadCandidates: (room: string) => Promise<TransferCandidate[]>;
}

const ChatContext = createContext<ChatStoreValue | null>(null);

function readHistory(): Record<string, ChatMsg[]> {
  try {
    const raw = sessionStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as Record<string, ChatMsg[]>) : {};
  } catch {
    return {};
  }
}

function writeHistory(rooms: Record<string, RoomState>): void {
  const out: Record<string, ChatMsg[]> = {};
  for (const r of Object.values(rooms)) {
    if (r.msgs.length) out[r.room] = r.msgs.slice(-MAX_MSGS_PER_ROOM);
  }
  try {
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(out));
  } catch {
    // storage full or unavailable — history is best-effort only.
  }
}

/** Text of the first `<name>` descendant (namespace-agnostic). */
function findTextDescendant(root: Element | null, name: string): string | null {
  if (!root) return null;
  const walk = (n: Element): string | null => {
    if (n.nodeName === name) return n.textContent ?? null;
    const kids = n.childNodes || [];
    for (let i = 0; i < kids.length; i++) {
      const v = walk(kids[i] as Element);
      if (v !== null) return v;
    }
    return null;
  };
  return walk(root);
}

function nickOfLocal(jid: string): string {
  const parts = jid.split('/');
  return parts.length > 2 ? parts.slice(2).join('/') : '';
}

function localpartOf(jid: string): string {
  return jid.split('@')[0];
}

/**
 * Chat store: owns the Strophe connection (created lazily on the client
 * only — the strophe.js module must never be evaluated during SSR) and the
 * message-driven room state. Cards appear from incoming MucSub / direct
 * messages; history is accumulated per room and kept in sessionStorage.
 */
export function ChatProvider({ session, children }: { session: OperatorSession; children: React.ReactNode }) {
  const toast = useToasts();
  const [xmpp, setXmpp] = useState<'connecting' | 'connected' | 'offline' | 'error'>('connecting');
  const [groups, setGroups] = useState<Group[]>([]);
  const [rooms, setRooms] = useState<Record<string, RoomState>>({});

  const roomsRef = useRef<Record<string, RoomState>>({});
  const clientRef = useRef<XmppClient | null>(null);
  const groupsRef = useRef<Group[]>([]);
  const keysRef = useRef<Set<string>>(new Set());
  const zRef = useRef(0);
  const timersRef = useRef<Record<string, number>>({});
  const notifiedRef = useRef<Set<string>>(new Set());
  const operatorsRef = useRef<Operator[] | null>(null);

  const myLocal = localpartOf(session.username);
  const myDomain = session.username.includes('@')
    ? session.username.split('@')[1]
    : (process.env.NEXT_PUBLIC_XMXX_DOMAIN ?? process.env.NEXT_PUBLIC_XMPP_DOMAIN ?? 'localhost');
  const myBare = `${myLocal}@${myDomain}`;
  const myNick = session.operatorName || myLocal;

  /* ---------------- room state helpers (ref + state mirror) ---------------- */

  const sync = useCallback(() => {
    setRooms({ ...roomsRef.current });
  }, []);

  const upsertRoom = useCallback((room: string, service: string, kind: RoomKind): RoomState => {
    const map = roomsRef.current;
    let r = map[room];
    if (!r) {
      const history = readHistory()[room] ?? [];
      r = {
        room,
        service: service || SERVICE,
        kind,
        groupId: null,
        group: null,
        title: '',
        titleFixed: false,
        lastBody: '',
        lastTs: 0,
        msgs: history.slice(-MAX_MSGS_PER_ROOM),
        call: 'new',
        transferredTo: null,
        joined: false,
        joining: false,
        accepting: false,
        mamCount: null,
        mamLoading: false,
        open: false,
        minimized: false,
        x: null,
        y: null,
        z: 0,
        lastSeenTs: 0,
        pendingBody: null,
      };
      map[room] = r;
    }
    return r;
  }, []);

  const persist = useCallback(() => {
    writeHistory(roomsRef.current);
  }, []);

  const appendMsg = useCallback((room: string, msg: ChatMsg): boolean => {
    const seen = keysRef.current;
    if (seen.has(msg.key)) return false;
    if (seen.size > 8000) seen.clear();
    seen.add(msg.key);

    const r = roomsRef.current[room];
    if (!r) return false;
    r.msgs.push({ ...msg });
    if (r.msgs.length > MAX_MSGS_PER_ROOM) r.msgs.splice(0, r.msgs.length - MAX_MSGS_PER_ROOM);
    if (msg.body && !msg.sys) r.lastBody = msg.body;
    r.lastTs = Math.max(r.lastTs, msg.ts);
    sync();
    persist();
    return true;
  }, [sync, persist]);

  const getOperators = useCallback(async (): Promise<Operator[]> => {
    if (!operatorsRef.current) {
      const res = await apiFetch<Operator[]>('/operators');
      operatorsRef.current = res.ok ? (res.data ?? []) : [];
    }
    return operatorsRef.current;
  }, []);

  const flushPending = useCallback((r: RoomState) => {
    if (!r.pendingBody) return;
    const body = r.pendingBody;
    r.pendingBody = null;
    const t = timersRef.current[r.room];
    if (t) {
      window.clearTimeout(t);
      delete timersRef.current[r.room];
    }
    clientRef.current?.sendGroupMessage(`${r.room}@${r.service}`, body);
  }, []);

  /* ---------------- inbound messages (MucSub / direct / dm) ---------------- */

  const handleRoomMessage = useCallback(
    (ib: Inbound) => {
      if (ib.kind !== 'room') return;
      const { room, service, nick, body, stanzaId, ts } = ib;
      const kind: RoomKind = groupsRef.current.some((g) => g.room === room) ? 'group' : 'temp';
      const r = upsertRoom(room, service, kind);
      if (kind === 'group') {
        const g = groupsRef.current.find((x) => x.room === room);
        if (g) {
          r.group = g.name;
          r.groupId = g.id;
          if (!r.title || !r.titleFixed) {
            r.title = g.name;
            r.titleFixed = true;
          }
        }
      } else if (!r.title) {
        r.title = nick; // creator's nick until a MUC title (or nothing) settles it
      }

      const key = stanzaId ? `sid:${stanzaId}` : `syn:${room}|${nick}|${body}|${ts}`;
      appendMsg(room, { key, from: nick, mine: nick === myNick, sys: false, body, ts });

      if (kind === 'temp' && !notifiedRef.current.has(room)) {
        notifiedRef.current.add(room);
        toast('info', 'New call', `${nick} started a temporary room.`);
      }

      // Best-effort: try to pick up the room's MUC title for temp rooms.
      if (kind === 'temp' && !r.titleFixed && clientRef.current) {
        const p = clientRef.current.mucInfo(`${room}@${service}`);
        void p
          .then((res) => {
            const title = findTextDescendant(res, 'title');
            const cur = roomsRef.current[room];
            if (title && cur && cur.kind === 'temp' && !cur.titleFixed && cur.title !== title) {
              cur.title = title;
              cur.titleFixed = true;
              sync();
            }
          })
          .catch(() => {});
      }
    },
    [appendMsg, myNick, sync, toast, upsertRoom],
  );

  const handleDmMessage = useCallback(
    (from: string, body: string, ts: number) => {
      const lp = localpartOf(from);
      const r = upsertRoom(lp, SERVICE, 'dm');
      if (!r.title) r.title = lp;
      appendMsg(lp, { key: `syn:dm:${from}|${body}|${ts}`, from: lp, mine: false, sys: false, body, ts });
      void (async () => {
        const ops = await getOperators();
        const cur = roomsRef.current[lp];
        const op = ops.find((o) => o.xmppUser === lp);
        if (op && cur && !cur.titleFixed) {
          cur.title = op.name;
          cur.titleFixed = true;
          sync();
        }
      })();
    },
    [appendMsg, getOperators, sync, upsertRoom],
  );

  /* ---------------- presence (MUC occupant events) ---------------- */

  const handlePresence = useCallback(
    (st: Element) => {
      const from = st.getAttribute('from') ?? '';
      const at = from.indexOf('@');
      if (at <= 0 || from.slice(at + 1) !== SERVICE) return;
      const room = from.slice(0, at);
      const nick = nickOfLocal(from);
      const type = st.getAttribute('type') ?? '';
      const r = roomsRef.current[room];
      if (!r) return;

      if (nick === myNick) {
        if (type === 'unavailable') {
          r.joined = false;
          r.joining = false;
        } else {
          r.joined = true;
          r.joining = false;
          if (r.pendingBody) flushPending(r);
        }
        sync();
        return;
      }
      // Other occupant join/leave — system rows only for rooms already
      // tracked (presence never creates cards).
      appendMsg(room, {
        key: `sys:${room}|${nick}|${type === 'unavailable' ? 'left' : 'joined'}|${Date.now()}`,
        from: 'system',
        mine: false,
        sys: true,
        body: type === 'unavailable' ? `${nick} left the room` : `${nick} joined the room`,
        ts: Date.now(),
      });
    },
    [appendMsg, flushPending, myNick, sync],
  );

  /* ---------------- XMPP connection (client-only, lazy import) ---------------- */

  useEffect(() => {
    let disposed = false;
    let client: XmppClient | null = null;
    // Capture the (never-reassigned) timer map once so the cleanup can read a
    // stable value without touching the ref.
    const timers = timersRef.current;

    (async () => {
      // strophe.js must only be evaluated in the browser — load it lazily.
      const mod = await import('./client');
      if (disposed) return;
      const { XmppClient, XmppStatus, parseInbound } = mod;
      const S = XmppStatus;

      const subscribeGroups = () => {
        for (const g of groupsRef.current) {
          const p = clientRef.current?.mucSubscribe(`${g.room}@${g.service || SERVICE}`, myNick);
          if (p) void p.catch(() => {});
        }
      };

      client = new XmppClient({
        onStatus: (status: number) => {
          if (status === S.CONNECTED) {
            setXmpp('connected');
            clientRef.current?.sendPresence();
            subscribeGroups();
          } else if (status === S.AUTHFAIL || status === S.ERROR) {
            setXmpp('error');
            toast('error', 'XMPP authentication failed', 'Check the operator credentials.');
          } else if (status === S.CONNFAIL || status === S.CONNTIMEOUT) {
            setXmpp('error');
            toast('error', 'Could not reach the XMPP server', `Is ${process.env.NEXT_PUBLIC_XMXX_WS_URL ?? 'ws://localhost:5280/websocket'} running?`);
          } else if (status === S.DISCONNECTED) {
            setXmpp('offline');
          } else if (status === S.CONNECTING || status === S.RECONNECTING) {
            setXmpp('connecting');
          }
        },
        onMessage: (st: Element) => {
          const ib = parseInbound(st);
          if (!ib) return;
          if (ib.kind === 'room') handleRoomMessage(ib);
          else handleDmMessage(ib.from, ib.body, ib.ts);
        },
        onPresence: (st: Element) => handlePresence(st),
      });
      clientRef.current = client;

      // Groups first: they drive card classification. The MucSub subscribe must
      // only happen on CONNECTED (see onStatus below) — never before SASL auth,
      // because this ejabberd build rejects the stream with `not-authorized`
      // when an application stanza (IQ) is sent pre-auth.
      const groupsRes = await apiFetch<Group[]>(`/operators/${session.operatorId}/groups`);
      if (disposed) return;
      if (groupsRes.ok && groupsRes.data) {
        const list = groupsRes.data;
        groupsRef.current = list;
        setGroups(list);
        for (const g of list) {
          const r = roomsRef.current[g.room];
          if (r && r.kind === 'temp' && !r.titleFixed) {
            r.kind = 'group';
            r.group = g.name;
            r.groupId = g.id;
            r.title = g.name;
            r.titleFixed = true;
          }
        }
        sync();
      }

      client.connect(session.username, session.password, `web${Math.random().toString(36).slice(2, 10)}`);
    })();

    return () => {
      disposed = true;
      for (const t of Object.values(timers)) window.clearTimeout(t);
      if (clientRef.current) clientRef.current.flush();
      clientRef.current = null;
      client?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- window management ---------------- */

  const openRoom = useCallback(
    (room: string) => {
      const r = roomsRef.current[room];
      if (!r) return;
      if (r.x === null || r.y === null) {
        const idx = Object.values(roomsRef.current).filter((o) => o.open).length;
        r.x = 24 + (idx % 5) * 28;
        r.y = 16 + (idx % 5) * 28;
      }
      r.open = true;
      r.minimized = false;
      r.lastSeenTs = Date.now();
      r.z = ++zRef.current;
      if (r.msgs.length === 0 && r.mamCount === null && !r.mamLoading) {
        // Best-effort MAM archive stats for 1:1 partners.
        const partner =
          r.kind === 'dm'
            ? `${r.room}@${myDomain}`
            : r.kind === 'temp'
              ? `${localpartOf(r.room.split('_')[0] || r.room)}@${myDomain}`
              : null;
        if (partner) {
          r.mamLoading = true;
          sync();
          const p = clientRef.current?.mamStats(partner);
          if (p) {
            void p.then((count) => {
              const cur = roomsRef.current[room];
              if (cur) {
                cur.mamLoading = false;
                cur.mamCount = count;
                sync();
              }
            });
          }
        }
      }
      sync();
    },
    [myDomain, sync],
  );

  const closeRoom = useCallback(
    (room: string) => {
      const r = roomsRef.current[room];
      if (!r) return;
      r.open = false;
      r.minimized = false;
      sync();
    },
    [sync],
  );

  const minimizeRoom = useCallback(
    (room: string) => {
      const r = roomsRef.current[room];
      if (!r) return;
      r.minimized = true;
      r.lastSeenTs = Date.now();
      sync();
    },
    [sync],
  );

  const restoreRoom = useCallback(
    (room: string) => {
      const r = roomsRef.current[room];
      if (!r) return;
      r.minimized = false;
      r.lastSeenTs = Date.now();
      r.z = ++zRef.current;
      sync();
    },
    [sync],
  );

  const focusRoom = useCallback(
    (room: string) => {
      const r = roomsRef.current[room];
      if (!r) return;
      r.z = ++zRef.current;
      r.lastSeenTs = Date.now();
      sync();
    },
    [sync],
  );

  const moveRoom = useCallback(
    (room: string, x: number, y: number) => {
      const r = roomsRef.current[room];
      if (!r) return;
      r.x = Math.max(-80, x);
      r.y = Math.max(-40, y);
      sync();
    },
    [sync],
  );

  const unreadOf = useCallback(
    (r: RoomState): number => r.msgs.filter((m) => m.ts > r.lastSeenTs && !m.mine && !m.sys).length,
    [],
  );

  /* ---------------- sending / accepting / transfer ---------------- */

  const send = useCallback(
    (room: string, text: string) => {
      const r = roomsRef.current[room];
      const body = text.trim();
      if (!r || !body) return;

      if (r.kind === 'dm') {
        // 1:1 chat messages are not echoed back to the sender — append locally.
        appendMsg(room, { key: `syn:dmme:${Date.now()}`, from: myNick, mine: true, sys: false, body, ts: Date.now() });
        clientRef.current?.sendDirect(`${r.room}@${myDomain}`, body);
        return;
      }

      if (r.kind === 'temp' && r.call !== 'accepted') return; // guarded in the UI

      if (r.joined) {
        clientRef.current?.sendGroupMessage(`${r.room}@${r.service}`, body);
        return;
      }

      // Group rooms / accepted calls: join first, then the message lands.
      r.joining = true;
      r.pendingBody = body;
      clientRef.current?.mucJoin(`${r.room}@${r.service}`, myNick);
      timersRef.current[room] = window.setTimeout(() => {
        const cur = roomsRef.current[room];
        if (!cur || !cur.pendingBody) return;
        cur.joined = true;
        cur.joining = false;
        const b = cur.pendingBody;
        cur.pendingBody = null;
        clientRef.current?.sendGroupMessage(`${cur.room}@${cur.service}`, b);
      }, 3000);
      sync();
    },
    [appendMsg, myDomain, myNick, sync],
  );

  const acceptCall = useCallback(
    (room: string) => {
      const r = roomsRef.current[room];
      if (!r || r.kind !== 'temp' || r.call !== 'new' || r.accepting) return;
      r.accepting = true;
      sync();
      void (async () => {
        const res = await apiFetch('/chatroom/join', {
          method: 'POST',
          body: { operatorId: session.operatorId, groupId: r.groupId, room: r.room },
        });
        const cur = roomsRef.current[room];
        if (!cur) {
          r.accepting = false;
          return;
        }
        cur.accepting = false;
        if (!res.ok) {
          toast('error', 'Could not accept the call', res.error?.message ?? 'The backend rejected the join request.');
          return;
        }
        cur.call = 'accepted';
        clientRef.current?.mucJoin(`${cur.room}@${cur.service}`, myNick);
        toast('success', 'Call accepted', 'You are now the sole operator on this call.');
        sync();
      })();
    },
    [myNick, session.operatorId, sync, toast],
  );

  const transferCall = useCallback(
    async (room: string, toId: string, toName: string): Promise<boolean> => {
      const r = roomsRef.current[room];
      if (!r || r.call !== 'accepted') return false;
      const res = await apiFetch('/chatroom/transfer', {
        method: 'POST',
        body: { room: r.room, operatorId: toId, previousOperatorId: session.operatorId, service: r.service },
      });
      if (!res.ok) {
        toast('error', 'Transfer failed', res.error?.message ?? 'The backend rejected the transfer.');
        return false;
      }
      clientRef.current?.mucLeave(`${r.room}@${r.service}`, myNick);
      r.joined = false;
      r.joining = false;
      r.call = 'transferred';
      r.transferredTo = toName;
      toast('success', 'Call transferred', `The call is now handled by ${toName}.`);
      sync();
      return true;
    },
    [myNick, session.operatorId, sync, toast],
  );

  const loadCandidates = useCallback(
    async (room: string): Promise<TransferCandidate[]> => {
      const r = roomsRef.current[room];
      if (!r) return [];
      const p = clientRef.current?.mucSubscriptions(`${r.room}@${r.service}`);
      const subs = p ? await p : null;
      if (!subs) return [];

      const items: { jid: string; nick: string }[] = [];
      const walk = (n: Element) => {
        if (n.nodeName === 'subscription') {
          items.push({ jid: n.getAttribute('jid') ?? '', nick: n.getAttribute('nick') ?? '' });
        }
        const kids = n.childNodes || [];
        for (let i = 0; i < kids.length; i++) walk(kids[i] as Element);
      };
      walk(subs);

      const customerPart = r.room.split('_')[0];
      const seen = new Set<string>();
      const cands: { jid: string; nick: string }[] = [];
      for (const i of items) {
        const bare = i.jid.split('/').slice(0, 2).join('/');
        if (!bare || bare === myBare || localpartOf(bare) === customerPart) continue;
        if (seen.has(bare)) continue;
        seen.add(bare);
        cands.push({ jid: bare, nick: i.nick });
      }

      const ops = await getOperators();
      return cands.map((c) => {
        const lp = localpartOf(c.jid);
        const op = ops.find((o) => o.xmppUser === lp);
        return { id: op?.id ?? '', name: op?.name ?? (c.nick || lp), xmppUser: lp, nick: c.nick || null };
      });
    },
    [getOperators, myBare],
  );

  /* ---------------- derived values ---------------- */

  const sorted = useMemo(() => Object.values(rooms).sort((a, b) => b.lastTs - a.lastTs), [rooms]);
  const openRooms = useMemo(() => sorted.filter((r) => r.open && !r.minimized), [sorted]);
  const minimizedRooms = useMemo(() => sorted.filter((r) => r.open && r.minimized), [sorted]);

  const value = useMemo<ChatStoreValue>(
    () => ({
      xmpp,
      groups,
      rooms: sorted,
      openRooms,
      minimizedRooms,
      myNick,
      openRoom,
      closeRoom,
      minimizeRoom,
      restoreRoom,
      focusRoom,
      moveRoom,
      unreadOf,
      send,
      acceptCall,
      transferCall,
      loadCandidates,
    }),
    [
      xmpp,
      groups,
      sorted,
      openRooms,
      minimizedRooms,
      myNick,
      openRoom,
      closeRoom,
      minimizeRoom,
      restoreRoom,
      focusRoom,
      moveRoom,
      unreadOf,
      send,
      acceptCall,
      transferCall,
      loadCandidates,
    ],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat(): ChatStoreValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used inside <ChatProvider>');
  return ctx;
}
