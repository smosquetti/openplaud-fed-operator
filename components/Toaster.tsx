'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Icon } from './Icon';

type Kind = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  kind: Kind;
  title: string;
  message?: string;
}

type PushFn = (kind: Kind, title: string, message?: string) => void;

const ToastContext = createContext<PushFn>(() => {});

const kindIcon: Record<Kind, 'check' | 'warning' | 'info'> = {
  success: 'check',
  error: 'warning',
  info: 'info',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const push = useCallback<PushFn>((kind, title, message) => {
    const id = (idRef.current += 1);
    setToasts((prev) => [...prev, { id, kind, title, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6500);
  }, []);

  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-viewport" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast-card toast-${t.kind}`}>
            <div className="toast-icon" aria-hidden="true">
              <Icon name={kindIcon[t.kind]} size={16} />
            </div>
            <div className="toast-body">
              <div className="toast-title">{t.title}</div>
              {t.message ? <div className="toast-message">{t.message}</div> : null}
            </div>
            <button
              className="icon-btn"
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              aria-label="Dismiss notification"
            >
              <Icon name="close" size={13} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToasts(): PushFn {
  return useContext(ToastContext);
}
