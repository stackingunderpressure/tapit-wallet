import { useEffect, useState } from 'react';
import type { AnchorRow } from './anchorQueue.ts';
import { anchorQueue } from './anchorQueue.ts';
import type { WorkerHandle } from './anchorWorker.ts';

// Subscribe to the live status of one digest. Returns the latest
// AnchorRow or undefined while it loads. Re-renders only when this
// digest's row updates.
export function useAnchorStatus(
  ownerId: string,
  digestHex: string | null,
  worker: WorkerHandle | null,
): AnchorRow | undefined {
  const [row, setRow] = useState<AnchorRow | undefined>(undefined);

  useEffect(() => {
    if (!digestHex) return;
    let alive = true;
    anchorQueue.get(ownerId, digestHex).then((r) => {
      if (alive) setRow(r);
    });
    if (!worker) return () => {
      alive = false;
    };
    const off = worker.subscribe((updated) => {
      if (!alive) return;
      if (updated.digestHex === digestHex) setRow(updated);
    });
    return () => {
      alive = false;
      off();
    };
  }, [ownerId, digestHex, worker]);

  return row;
}
