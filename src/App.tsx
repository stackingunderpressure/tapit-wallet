import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthGate } from './features/auth/AuthGate.tsx';
import { LoginPage } from './features/auth/LoginPage.tsx';
import { AuthCallback } from './features/auth/AuthCallback.tsx';

// wallet-core + settings are the largest chunks — keep them lazy so
// the login surface ships without them. The shell painted in
// index.html is what the user sees until WalletProvider resolves.
const WalletProvider = lazy(() =>
  import('./features/wallet-core/WalletProvider.tsx').then((m) => ({
    default: m.WalletProvider,
  })),
);
const HomeScreen = lazy(() =>
  import('./features/wallet-core/HomeScreen.tsx').then((m) => ({
    default: m.HomeScreen,
  })),
);
const SettingsScreen = lazy(() =>
  import('./features/settings/SettingsScreen.tsx').then((m) => ({
    default: m.SettingsScreen,
  })),
);
const JournalDetail = lazy(() =>
  import('./features/journal/JournalDetail.tsx').then((m) => ({
    default: m.JournalDetail,
  })),
);

const Pending = (
  <div className="min-h-screen flex items-center justify-center p-6 text-muted text-sm">
    Loading…
  </div>
);

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route
          path="/*"
          element={
            <AuthGate>
              <Suspense fallback={Pending}>
                <WalletProvider>
                  <Routes>
                    <Route path="/" element={<HomeScreen />} />
                    <Route path="/settings" element={<SettingsScreen />} />
                    <Route path="/entry/:digest" element={<JournalDetail />} />
                  </Routes>
                </WalletProvider>
              </Suspense>
            </AuthGate>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
