import { Navigate } from 'react-router-dom';
import { useSession } from './useSession.ts';

interface Props {
  children: React.ReactNode;
}

// Wraps any route that requires an authenticated session. Renders
// nothing while the session is still resolving so we don't flash
// the login page in front of a returning user.
export function AuthGate({ children }: Props) {
  const session = useSession();
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
