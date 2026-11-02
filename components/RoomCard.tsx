'use client';

import type { RoomState } from '@/lib/xmpp/store';

function fmtTime(ts: number): string {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function RoomCard({
  r,
  active,
  unread,
  onOpen,
}: {
  r: RoomState;
  active: boolean;
  unread: number;
  onOpen: () => void;
}) {
  const kindLabel = r.kind === 'group' ? 'Group' : r.kind === 'dm' ? 'Direct' : 'Call';
  const callLabel =
    r.kind === 'temp' ? (r.call === 'new' ? 'Unanswered' : r.call === 'accepted' ? 'In call' : 'Transferred') : '';

  return (
    <button className={`room-card ${active ? 'active' : ''}`} onClick={onOpen}>
      <div className="room-card-top">
        <span className="room-card-title">{r.title || r.room}</span>
        <span className={`room-card-kind ${r.kind === 'temp' ? 'call' : ''}`}>{kindLabel}</span>
        {unread > 0 ? <span className="unread-badge">{unread}</span> : null}
      </div>
      <div className="room-card-sub">{r.lastBody || 'No messages yet'}</div>
      <div className="room-card-meta">
        <span>{fmtTime(r.lastTs)}</span>
        {callLabel ? <span>{callLabel}</span> : null}
      </div>
    </button>
  );
}
