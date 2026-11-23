import { useEffect, useState } from 'react';
import { supabase } from '../../shared/lib/supabase.ts';
import { isSovereign } from '../../shared/lib/sovereign.ts';
import { resolveDeviceOwnerId } from './deviceOwner.ts';

/** The part of a session the app reads: who owns the stored records. */
export interface AppSession {
  user: { id: string; email?: string | null };
}

interface SessionState {
  status: 'loading' | 'signed-in' | 'signed-out';
  session: AppSession | null;
}

export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({
    status: 'loading',
    session: null,
  });

  useEffect(() => {
    let alive = true;
    // Sovereign build: no sign-in. This device is the account; the wallet's
    // passphrase (or Face ID) is the only way in.
    if (isSovereign()) {
      void resolveDeviceOwnerId().then((id) => {
        if (alive) setState({ status: 'signed-in', session: { user: { id, email: null } } });
      });
      return () => { alive = false; };
    }
    supabase()
      .auth.getSession()
      .then(({ data }) => {
        if (!alive) return;
        setState({
          status: data.session ? 'signed-in' : 'signed-out',
          session: data.session,
        });
      });
    const { data: sub } = supabase().auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      setState({
        status: session ? 'signed-in' : 'signed-out',
        session,
      });
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}
