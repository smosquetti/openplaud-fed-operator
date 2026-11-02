'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { setUnauthorizedHandler } from './api';

export function toBasicToken(user: string, pass: string): string {
  const bytes = new TextEncoder().encode(`${user}:${pass}`);
  let bin = '';
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return btoa(bin);
}

export type XmppStatus = 'checking' | 'authed' | 'anon';

export interface OperatorSession {
  username: string;
  password: string;
  operatorId: string;
  operatorName: string;
}

interface AuthContextValue {
  status: XmppStatus;
  session: OperatorSession | null;
  login: (session: OperatorSession) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const STORAGE_KEY = 'openplaud.operator.session';

function readStored(): OperatorSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as OperatorSession) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Initial state must match the server render exactly (status 'checking',
  // session null). The real session is resolved in the mount effect below,
  // which runs only on the client after hydration — so SSR and the first
  // client render always agree and no hydration mismatch is thrown.
  const [status, setStatus] = useState<XmppStatus>('checking');
  const [session, setSession] = useState<OperatorSession | null>(null);

  const logout = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setStatus('anon');
    setSession(null);
  }, []);

  const login = useCallback((s: OperatorSession) => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    setSession(s);
    setStatus('authed');
  }, []);

  useEffect(() => {
    const onUnauthorized = () => {
      sessionStorage.removeItem(STORAGE_KEY);
      setStatus('anon');
      setSession(null);
    };
    setUnauthorizedHandler(onUnauthorized);

    const stored = readStored();
    if (!stored) {
      setStatus('anon');
      setSession(null);
      return () => setUnauthorizedHandler(null);
    }

    setSession(stored);

    let cancelled = false;
    fetch('/api/proxy/operator/login', {
      method: 'GET',
      headers: { Authorization: `Basic ${toBasicToken(stored.username, stored.password)}` },
      cache: 'no-store',
    })
      .then((res) => {
        if (cancelled) return;
        if (res.ok) {
          setStatus('authed');
          return;
        }
        if (res.status === 401) {
          sessionStorage.removeItem(STORAGE_KEY);
          setSession(null);
          setStatus('anon');
          return;
        }
        // Backend unreachable (proxy returns 5xx): keep the session and retry
        // on the next navigation — show the "connecting" screen meanwhile.
        setStatus('checking');
      })
      .catch(() => {
        if (!cancelled) setStatus('checking');
      });

    return () => {
      cancelled = true;
      setUnauthorizedHandler(null);
    };
  }, []);

  const value = useMemo(
    () => ({ status, session, login, logout }),
    [status, session, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
