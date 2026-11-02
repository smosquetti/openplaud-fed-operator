'use client';

import { useEffect, useState } from 'react';
import { useChat } from '@/lib/xmpp/store';
import type { RoomState, TransferCandidate } from '@/lib/xmpp/store';
import { Icon } from './Icon';

function initialsOf(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  const s = parts.map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return s || '?';
}

export function TransferDialog({ r, onClose }: { r: RoomState; onClose: () => void }) {
  const { loadCandidates, transferCall } = useChat();
  const [cands, setCands] = useState<TransferCandidate[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    loadCandidates(r.room)
      .then((list) => {
        if (live) setCands(list);
      })
      .catch(() => {
        if (live) setError('Could not load the room subscription list.');
      });
    return () => {
      live = false;
    };
  }, [loadCandidates, r.room]);

  async function pick(c: TransferCandidate) {
    setBusyId(c.id || c.xmppUser);
    const ok = await transferCall(r.room, c.id, c.name);
    setBusyId(null);
    if (ok) onClose();
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-card">
        <div className="modal-head">
          <h2>Transfer this call</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close transfer dialog">
            <Icon name="close" size={14} />
          </button>
        </div>
        <div className="modal-body">
          {error ? (
            <p className="transfer-empty">{error}</p>
          ) : cands === null ? (
            <div className="spinner-block" style={{ padding: '18px 0' }}>
              <div className="spinner-ring" />
              <div className="spinner-label">Loading the room subscription list…</div>
            </div>
          ) : cands.length === 0 ? (
            <p className="transfer-empty">
              No other operators are subscribed to this room — there is nobody to transfer the call to yet.
            </p>
          ) : (
            cands.map((c) => (
              <div className="transfer-row" key={c.id || c.xmppUser}>
                <div className="avatar" style={{ width: 28, height: 28, fontSize: 11 }}>
                  {initialsOf(c.name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="transfer-name">{c.name}</div>
                  <div className="transfer-sub">{c.nick ? `In room as “${c.nick}”` : c.xmppUser}</div>
                </div>
                <button className="btn-transfer" disabled={!c.id || busyId !== null} onClick={() => void pick(c)}>
                  {busyId === (c.id || c.xmppUser) ? 'Transferring…' : 'Transfer'}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
