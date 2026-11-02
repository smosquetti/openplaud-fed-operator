'use client';

import { useAuth } from '@/lib/auth';
import { useChat } from '@/lib/xmpp/store';
import type { RoomState } from '@/lib/xmpp/store';
import { Logo } from './Logo';
import { Icon } from './Icon';
import { RoomCard } from './RoomCard';
import { ChatWindow } from './ChatWindow';
import { Dock } from './Dock';

export function Workspace() {
  const { session, logout } = useAuth();
  const { xmpp, rooms, openRooms, minimizedRooms, unreadOf, openRoom } = useChat();

  const statusDot = xmpp === 'connected' ? 'on' : xmpp === 'error' ? 'err' : 'off';
  const statusLabel =
    xmpp === 'connected'
      ? 'Connected to ejabberd'
      : xmpp === 'connecting'
        ? 'Connecting to ejabberd…'
        : xmpp === 'error'
          ? 'XMPP connection failed'
          : 'Disconnected';

  // The topmost open window is the "focused" card.
  const topOpen = openRooms.reduce<RoomState | null>((acc, r) => (!acc || r.z > acc.z ? r : acc), null);

  const name = session?.operatorName ?? '?';
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';

  return (
    <div className="op-workspace">
      <aside className="op-panel">
        <div className="brand">
          <Logo size={30} />
          <div>
            <div className="brand-name">OpenPlaud Operator</div>
            <div className="brand-sub">Live chat console</div>
          </div>
        </div>
        <div className="xmpp-status">
          <span className={`status-dot ${statusDot}`} />
          <span>{statusLabel}</span>
        </div>
        <div className="panel-section-label">Rooms</div>
        <div className="room-list">
          {rooms.length === 0 ? (
            <div className="empty-list">
              No rooms yet. Incoming calls and group activity appear here as soon as the first message arrives.
            </div>
          ) : (
            rooms.map((r) => (
              <RoomCard
                key={r.room}
                r={r}
                active={topOpen?.room === r.room}
                unread={unreadOf(r)}
                onOpen={() => openRoom(r.room)}
              />
            ))
          )}
        </div>
        <div className="op-panel-foot">
          <div className="admin-chip">
            <div className="avatar">{initials}</div>
            <div className="admin-meta">
              <div className="admin-name">{name}</div>
              <div className="admin-sub">{session?.username}</div>
            </div>
          </div>
          <button className="signout-btn" onClick={logout}>
            <Icon name="logout" size={15} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <main className="op-canvas">
        {openRooms.map((r) => (
          <ChatWindow key={r.room} r={r} />
        ))}
        {minimizedRooms.length > 0 ? <Dock rooms={minimizedRooms} /> : null}
        {openRooms.length === 0 ? (
          <div className="canvas-hint">
            <div className="canvas-hint-inner">
              <h3>Your rooms appear here</h3>
              <p>
                Click a room card to open it as a window. Drag windows around, minimize them to the dock, and take
                calls straight from the window.
              </p>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
