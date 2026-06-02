import { useEffect, useState } from 'react';
import { fetchVersion, isUpdateAvailable } from './checkForUpdate.ts';

// Poll /version.json and report whether a newer build is deployed.
// Returns true once a mismatch is seen; never flips back to false on
// its own (an update doesn't un-happen — the operator reloads to clear
// it). PROD-only: in dev there's no version.json and the dev bundle's
// __APP_VERSION__ is the dev-server load time, so we skip entirely to
// avoid a phantom banner.
//
// Checks on mount, every CHECK_INTERVAL_MS, and whenever the tab
// becomes visible again (a backgrounded PWA that the operator returns
// to after a deploy should notice promptly without waiting a full
// interval). All fetch failures are swallowed by fetchVersion -> null,
// so being offline or hitting a half-deployed version.json never nags.

const CHECK_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

export function useUpdateAvailable(): boolean {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (!import.meta.env.PROD) return;
    let cancelled = false;
    const controller = new AbortController();

    async function check() {
      const fetched = await fetchVersion(controller.signal);
      if (cancelled) return;
      if (isUpdateAvailable(__APP_VERSION__, fetched)) {
        setAvailable(true);
      }
    }

    void check();
    const interval = window.setInterval(() => void check(), CHECK_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return available;
}
