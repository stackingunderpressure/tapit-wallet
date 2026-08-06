import { useEffect, useState } from 'react';
import type { Attestation } from 'tapit-attest';
import { startAnnouncementOutboxWorker } from '../transport/announcementOutboxWorker.ts';
import type { AnnouncementWorkerHandle } from '../transport/announcementOutboxWorker.ts';
import { useLatestRef } from '../../shared/lib/useLatestRef.ts';

type SendEnvelope = (recipientPubkey: string, envelope: Attestation) => Promise<unknown>;

// Lifecycle wrapper for the key-succession-announcement retry worker
// (peer-rotation fix CUT 3), extracted so WalletProvider's own effect
// stays a one-line call and the provider stays under the 800-line
// file-size hard limit. Mirrors how startAnchorWorker is wired: begins
// on unlock/needs-identity, stops on lock or sign-out. sendEnvelope is
// read through the returned ref (not an effect dependency) so the
// worker does not restart every time the Mycelium connection cycles.
// The same ref is handed back to the caller so inboxEnvelopeHandler's
// ack-send (built inside an earlier, differently-scoped effect) can
// also always reach the current sendEnvelope without its own ref.
export function useAnnouncementOutboxWorker(
  ownerId: string | undefined,
  active: boolean,
  sendEnvelope: SendEnvelope,
): { worker: AnnouncementWorkerHandle | null; sendEnvelopeRef: { current: SendEnvelope } } {
  const sendRef = useLatestRef(sendEnvelope);
  const [worker, setWorker] = useState<AnnouncementWorkerHandle | null>(null);

  useEffect(() => {
    if (!ownerId || !active) {
      setWorker(null);
      return;
    }
    const w = startAnnouncementOutboxWorker(ownerId, (peer, envelope) =>
      sendRef.current(peer, envelope),
    );
    setWorker(w);
    return () => {
      w.stop();
      setWorker(null);
    };
  }, [ownerId, active, sendRef]);

  return { worker, sendEnvelopeRef: sendRef };
}
