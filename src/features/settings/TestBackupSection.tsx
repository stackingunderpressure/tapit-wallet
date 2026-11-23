import { useState } from 'react';
import { checkBackupFile, BACKUP_CHECK_MESSAGE, type BackupCheck } from './checkBackupFile.ts';

// "Test my backup": reads a downloaded file in memory and reports whether it
// opens. Writes nothing (checkBackupFile.ts). Lazy-loaded from LocalBackupSection.
export function TestBackupSection() {
const [testText, setTestText] = useState<string | null>(null);
const [testName, setTestName] = useState<string | null>(null);
const [testPassphrase, setTestPassphrase] = useState('');
const [testBusy, setTestBusy] = useState(false);
const [testResult, setTestResult] = useState<BackupCheck | null>(null);

async function onTest(e: React.FormEvent) {
  e.preventDefault();
  if (!testText) return;
  setTestBusy(true);
  try {
    setTestResult(await checkBackupFile(testText, testPassphrase));
  } finally {
    setTestBusy(false);
    setTestPassphrase('');
  }
}

  return (
    <>
    <div className="text-sm font-medium">Test my backup</div>
    <p className="mt-1 text-xs text-muted">
      Choose a backup file and enter its passphrase. This opens it here to
      check it works, and changes nothing on this device or anywhere else.
    </p>
    <input
      type="file"
      accept="application/json,.json"
      aria-label="Choose a backup file to test"
      onChange={async (e) => {
        const f = e.target.files?.[0];
        setTestResult(null);
        setTestText(f ? await f.text() : null);
        setTestName(f?.name ?? null);
      }}
      className="mt-2 block w-full text-sm"
    />
    {testText && (
      <form onSubmit={onTest} className="mt-3">
        <div className="text-xs text-muted">{testName}</div>
        <label className="mt-2 block text-sm">
          Passphrase for this backup
          <input
            type="password"
            required
            value={testPassphrase}
            onChange={(e) => setTestPassphrase(e.target.value)}
            className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-base focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </label>
        <button
          type="submit"
          disabled={testBusy || testPassphrase.length === 0}
          className="mt-3 rounded-md border border-ink/15 px-4 py-2 text-sm font-medium hover:bg-ink/5 disabled:opacity-40"
        >
          {testBusy ? 'Checking…' : 'Check this backup'}
        </button>
      </form>
    )}
    {testResult && testResult.ok && (
      <p className="mt-3 text-sm text-green-700" role="status">
        This backup opens. It belongs to identity{' '}
        <span className="font-mono text-xs break-all">{testResult.identity}</span>.{' '}
        {testResult.records === null
          ? 'It holds the wallet only, from before complete backups. Download a new one to include messages, attachments and everything else.'
          : `It also holds ${testResult.records} other saved record${testResult.records === 1 ? '' : 's'} (messages, attachments, notes and settings).`}{' '}
        {testResult.recoveryKeyOpens
          ? 'Your written-down recovery key opens it too, if you ever forget the passphrase.'
          : 'Only the passphrase opens it. Download a new backup so your recovery key opens it too.'}
      </p>
    )}
    {testResult && !testResult.ok && (
      <p className="mt-3 text-sm text-red-600" role="alert">
        {BACKUP_CHECK_MESSAGE[testResult.reason]}
      </p>
    )}
    </>
  );
}
