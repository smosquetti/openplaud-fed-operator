'use client';

import { useChat } from '@/lib/xmpp/store';
import type { RoomState } from '@/lib/xmpp/store';
import { Icon } from './Icon';

export function Dock({ rooms }: { rooms: RoomState[] }) {
  const { restoreRoom, unreadOf } = useChat();
  if (rooms.length === 0) return null;
  return (
    <div className="dock">
      <span className="dock-label">Minimized</span>
      {rooms.map((r) => {
        const unread = unreadOf(r);
        return (
          <button key={r.room} className="dock-pill" onClick={() => restoreRoom(r.room)} title={r.title || r.room}>
            <Icon name={r.kind === 'dm' ? 'chat' : 'phone'} size={13} />
            <span>{r.title || r.room}</span>
            {unread > 0 ? <span className="unread-badge">{unread}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
