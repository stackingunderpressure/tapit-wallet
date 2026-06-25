import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from './useSession.ts';
import { takePostLoginReturn } from './postLoginReturn.ts';

// The magic-link / OAuth redirect lands here. Supabase's detectSessionInUrl
// parses the access token out of the URL on client init; we wait for the
// session to settle and then route the user back to wherever they were
// headed before login (e.g. a /sign?req=... request from DynastyTrust), or
// home if they came straight to login.
export function AuthCallback() {
  const session = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (session.status === 'signed-in') {
      navigate(takePostLoginReturn() ?? '/', { replace: true });
    } else if (session.status === 'signed-out') {
      navigate('/login', { replace: true });
    }
  }, [session.status, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 text-muted text-sm">
      Finishing sign-in…
    </div>
  );
}
