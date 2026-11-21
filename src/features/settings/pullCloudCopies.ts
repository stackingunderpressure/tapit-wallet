import { idb } from '../../shared/lib/idb.ts';
import { remoteMediaStore } from '../storage/remoteMediaStore.ts';
import { restoreCirclePhraseBackup } from '../circle-phrase/circlePhrase.ts';
import { restoreRequestHistoryBackup } from '../storage/requestHistoryStore.ts';
import { restoreDismissedRequestsBackup } from '../storage/dismissedRequestsStore.ts';

// Before the complete backup is written, bring down anything that so far
// lives only in the cloud copy: attachments this device never opened, and
// the circle-phrase and request-state backups. The point is that the file
// holds everything, so Supabase can be switched off afterwards.
//
// Each step fails on its own and is reported, never hidden: a partial pull
// still produces a backup of what this device has, and the caller says what
// could not be fetched.

export interface PullReport {
  mediaFetched: number;
  mediaFailed: number;
  problems: string[];
}

export async function pullCloudCopies(ownerId: string, passphrase: string): Promise<PullReport> {
  const report: PullReport = { mediaFetched: 0, mediaFailed: 0, problems: [] };

  const merges: Array<[string, () => Promise<void>]> = [
    ['circle phrases', () => restoreCirclePhraseBackup(ownerId, passphrase)],
    ['request history', () => restoreRequestHistoryBackup(ownerId, passphrase)],
    ['dismissed requests', () => restoreDismissedRequestsBackup(ownerId, passphrase)],
  ];
  for (const [name, run] of merges) {
    try {
      await run();
    } catch {
      report.problems.push(`Could not fetch the cloud copy of ${name}.`);
    }
  }

  let hashes: string[] = [];
  try {
    hashes = await remoteMediaStore.listHashes(ownerId);
  } catch {
    report.problems.push('Could not list attachments in the cloud.');
  }
  for (const hash of hashes) {
    const key = `media:${ownerId}:${hash}`;
    if ((await idb.get(key)) !== undefined) continue;
    try {
      const remote = await remoteMediaStore.get(ownerId, hash);
      if (!remote) continue;
      // Same record shape mediaStore writes; the blob stays as encrypted.
      await idb.put(key, { blob: remote.blob, mime: remote.mime, byteLength: 0, stored_at: new Date().toISOString() });
      report.mediaFetched++;
    } catch {
      report.mediaFailed++;
    }
  }
  if (report.mediaFailed > 0) {
    report.problems.push(`${report.mediaFailed} attachment(s) could not be fetched from the cloud.`);
  }
  return report;
}
