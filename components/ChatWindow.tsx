'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useChat } from '@/lib/xmpp/store';
import type { RoomState } from '@/lib/xmpp/store';
import { Icon } from './Icon';
import { TransferDialog } from './TransferDialog';

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function ChatWindow({ r }: { r: RoomState }) {
  const { moveRoom, minimizeRoom, closeRoom, focusRoom, send, acceptCall } = useChat();
  const [text, setText] = useState('');
  const [transferOpen, setTransferOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const winRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [r.msgs.length]);

  function onTitleMouseDown(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest('.win-actions')) return;
    const el = winRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dx = e.clientX - rect.left;
    const dy = e.clientY - rect.top;
    focusRoom(r.room);
    const onMove = (ev: MouseEvent) => moveRoom(r.room, ev.clientX - dx, ev.clientY - dy);
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    send(r.room, text);
    setText('');
  }

  const isTemp = r.kind === 'temp';
  const transferred = r.call === 'transferred';
  const composerDisabled = (isTemp && r.call === 'new') || transferred;
  const title = r.title || r.room;
  const sub =
    r.kind === 'group' ? 'Group room' : r.kind === 'dm' ? 'Direct message' : r.call === 'accepted' ? 'In call' : 'Temporary room';

  return (
    <section
      ref={winRef}
      className="chat-window"
      style={{ left: r.x ?? 24, top: r.y ?? 16, zIndex: r.z || 1 }}
      onMouseDown={() => focusRoom(r.room)}
    >
      <header className="win-titlebar" onMouseDown={onTitleMouseDown}>
        <span className="win-titlebar-icon">
          <Icon name={r.kind === 'dm' ? 'chat' : 'phone'} size={15} />
        </span>
        <div style={{ minWidth: 0 }}>
          <div className="win-title">{title}</div>
          <div className="win-sub">{sub}</div>
        </div>
        <div className="win-actions">
          <button className="icon-btn" onClick={() => minimizeRoom(r.room)} aria-label="Minimize window">
            <Icon name="minus" size={14} />
          </button>
          <button className="icon-btn" onClick={() => closeRoom(r.room)} aria-label="Close window">
            <Icon name="close" size={14} />
          </button>
        </div>
      </header>

      <div className="msg-list" ref={listRef}>
        {r.mamCount != null && r.msgs.length === 0 ? (
          <div className="mam-banner">
            <Icon name="info" size={14} />
            <span>
              {r.mamCount} message{r.mamCount === 1 ? '' : 's'} archived for this conversation. This ejabberd build
              returns MAM archive stats only, so the contents cannot be shown here.
            </span>
          </div>
        ) : null}
        {r.msgs.map((m) =>
          m.sys ? (
            <div key={m.key} className="msg-system">
              {m.body}
            </div>
          ) : (
            <div key={m.key} className={`msg-row ${m.mine ? 'mine' : 'theirs'}`}>
              {!m.mine ? <div className="msg-meta">{m.from}</div> : null}
              <div className="msg-bubble">{m.body}</div>
              <div className="msg-meta">{fmtTime(m.ts)}</div>
            </div>
          ),
        )}
      </div>

      <div className="win-actions-bar">
        {isTemp && r.call === 'new' ? (
          <button className="accept-btn" onClick={() => acceptCall(r.room)} disabled={r.accepting}>
            <Icon name="phone" size={16} />
            <span>{r.accepting ? 'Accepting…' : 'Accept call'}</span>
          </button>
        ) : null}

        {isTemp && r.call === 'accepted' ? (
          <div className="status-chip">
            <Icon name="check" size={14} />
            <span>In call — you are 1:1 with the customer.</span>
            <button type="button" className="btn-transfer" style={{ marginLeft: 'auto' }} onClick={() => setTransferOpen(true)}>
              <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                <Icon name="transfer" size={13} /> Transfer
              </span>
            </button>
          </div>
        ) : null}

        {transferred ? (
          <div className="status-chip transfer">
            <Icon name="transfer" size={14} />
            <span>Transferred to {r.transferredTo}. The composer is locked.</span>
          </div>
        ) : null}

        {r.joining && !composerDisabled ? <div className="composer-hint">Joining the room…</div> : null}

        <form className="composer" onSubmit={onSubmit}>
          <input
            className="form-control"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              composerDisabled
                ? transferred
                  ? 'This call has been transferred.'
                  : 'Accept the call to start chatting.'
                : 'Type a message…'
            }
            disabled={composerDisabled}
          />
          <button
            className="btn btn-primary send-btn"
            type="submit"
            disabled={composerDisabled || !text.trim()}
            aria-label="Send message"
          >
            <Icon name="send" size={15} />
          </button>
        </form>
      </div>

      {transferOpen ? <TransferDialog r={r} onClose={() => setTransferOpen(false)} /> : null}
    </section>
  );
}
