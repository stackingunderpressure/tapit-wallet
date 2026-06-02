import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthGate } from './features/auth/AuthGate.tsx';
import { LoginPage } from './features/auth/LoginPage.tsx';
import { AuthCallback } from './features/auth/AuthCallback.tsx';
import { WalletGuide } from './features/auth/WalletGuide.tsx';
import { UpdateBanner } from './features/wallet-core/UpdateBanner.tsx';

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
const SignApprovalScreen = lazy(() =>
  import('./features/sign-request/SignApprovalScreen.tsx').then((m) => ({
    default: m.SignApprovalScreen,
  })),
);
const VerifyProofScreen = lazy(() =>
  import('./features/disclosure/VerifyProofScreen.tsx').then((m) => ({
    default: m.VerifyProofScreen,
  })),
);
const CaptureScreen = lazy(() =>
  import('./features/capture/CaptureScreen.tsx').then((m) => ({
    default: m.CaptureScreen,
  })),
);
const JoinScreen = lazy(() =>
  import('./features/connections/JoinScreen.tsx').then((m) => ({
    default: m.JoinScreen,
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
      <UpdateBanner />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/about" element={<WalletGuide initialTab="why" />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route
          path="/verify"
          element={
            <Suspense fallback={Pending}>
              <VerifyProofScreen />
            </Suspense>
          }
        />
        <Route
          path="/join"
          element={
            <Suspense fallback={Pending}>
              <JoinScreen />
            </Suspense>
          }
        />
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
                    <Route path="/sign" element={<SignApprovalScreen />} />
                    <Route path="/capture" element={<CaptureScreen />} />
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
