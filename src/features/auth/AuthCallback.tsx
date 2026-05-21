import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from './useSession.ts';

// The magic-link redirect lands here. Supabase's detectSessionInUrl
// parses the access token out of the URL on client init; we just
// wait for the session to settle and then route the user home.
export function AuthCallback() {
  const session = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (session.status === 'signed-in') navigate('/', { replace: true });
    else if (session.status === 'signed-out') navigate('/login', { replace: true });
  }, [session.status, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 text-muted text-sm">
      Finishing sign-in…
    </div>
  );
}
