'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toBasicToken, useAuth } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import type { Operator } from '@/lib/types';
import { Logo } from '@/components/Logo';
import { Icon } from '@/components/Icon';

export default function LoginPage() {
  const { status, session, login } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'authed' && session) router.replace('/');
  }, [status, session, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const u = username.trim();
    if (!u || !password) {
      setError('Please enter both the username and the password.');
      return;
    }
    setBusy(true);
    setError(null);

    let res: Response;
    try {
      res = await fetch('/api/proxy/operator/login', {
        method: 'GET',
        headers: { Authorization: `Basic ${toBasicToken(u, password)}` },
        cache: 'no-store',
      });
    } catch {
      setBusy(false);
      setError('Could not reach the OpenPlaud API. Make sure the backend is running, then try again.');
      return;
    }
    if (!res.ok) {
      setBusy(false);
      if (res.status === 401) {
        setError('Login failed — the XMPP account or password was rejected by ejabberd.');
      } else if (res.status >= 500) {
        setError('Could not reach the OpenPlaud API. Make sure the backend is running, then try again.');
      } else {
        setError('Login failed — unexpected response from the OpenPlaud API.');
      }
      return;
    }

    // XMPP is valid — now resolve the operator record from the username.
    const token = toBasicToken(u, password);
    const localpart = u.split('@')[0];
    const opsRes = await apiFetch<Operator[]>('/operators', { auth: token });
    setBusy(false);
    if (!opsRes.ok || !opsRes.data) {
      setError('The XMPP login succeeded, but the operator directory could not be reached.');
      return;
    }
    const me = opsRes.data.find((o) => o.xmppUser.split('@')[0] === localpart);
    if (!me) {
      setError('No operator is registered for that XMPP user — ask the admin to create one.');
      return;
    }

    login({ username: u, password, operatorId: me.id, operatorName: me.name });
    router.replace('/');
  }

  return (
    <div className="login-wrap">
      <form onSubmit={onSubmit} className="login-card" noValidate>
        <div className="login-head">
          <Logo size={52} />
          <h1 className="login-title">OpenPlaud Operator</h1>
          <p className="login-sub">Sign in with your operator&apos;s XMPP (ejabberd) account to take calls.</p>
        </div>
        <label className="field">
          <span className="field-label">Username</span>
          <input
            className="form-control"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="stevanmosquetti@localhost"
            autoComplete="username"
            autoFocus
          />
        </label>
        <label className="field">
          <span className="field-label">Password</span>
          <input
            className="form-control"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </label>
        {error ? (
          <div className="login-error">
            <Icon name="warning" size={15} />
            <span>{error}</span>
          </div>
        ) : null}
        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          {busy ? <span className="spinner-inline" aria-hidden="true" /> : null}
          <span>{busy ? 'Signing in…' : 'Sign in'}</span>
        </button>
        <p className="login-hint">
          Use the same credentials the admin registered for you in ejabberd — e.g.{' '}
          <code>stevanmosquetti@localhost</code>.
        </p>
      </form>
    </div>
  );
}
