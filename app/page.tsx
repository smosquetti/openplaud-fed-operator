'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { ChatProvider } from '@/lib/xmpp/store';
import { Workspace } from '@/components/Workspace';

export default function Home() {
  const { status, session } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'anon') router.replace('/login');
  }, [status, router]);

  if (!session || status !== 'authed') {
    return (
      <div className="page-center">
        <div className="spinner-block">
          <div className="spinner-ring" />
          <div className="spinner-label">
            {status === 'anon' ? 'Redirecting to login…' : 'Connecting to the OpenPlaud API…'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <ChatProvider session={session}>
      <Workspace />
    </ChatProvider>
  );
}
