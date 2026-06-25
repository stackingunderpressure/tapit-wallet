import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSession } from './useSession.ts';
import { stashPostLoginReturn } from './postLoginReturn.ts';

interface Props {
  children: React.ReactNode;
}

// Wraps any route that requires an authenticated session. Renders
// nothing while the session is still resolving so we don't flash
// the login page in front of a returning user.
export function AuthGate({ children }: Props) {
  const session = useSession();
  const location = useLocation();

  // Before bouncing a signed-out visitor to /login, remember where they were
  // headed (e.g. /sign?req=... from DynastyTrust) so login / wallet creation
  // returns them there instead of dropping the request on the floor.
  useEffect(() => {
    if (session.status === 'signed-out') {
      stashPostLoginReturn(location.pathname + location.search);
    }
  }, [session.status, location.pathname, location.search]);

  if (session.status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-muted text-sm">
        Loading your session…
      </div>
    );
  }
  if (session.status === 'signed-out') {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
