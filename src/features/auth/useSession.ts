import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../shared/lib/supabase.ts';

interface SessionState {
  status: 'loading' | 'signed-in' | 'signed-out';
  session: Session | null;
}

export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({
    status: 'loading',
    session: null,
  });

  useEffect(() => {
    let alive = true;
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
