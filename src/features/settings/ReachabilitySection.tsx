import { useEffect, useState } from 'react';
import type { Prefs } from '../storage/prefsStore.ts';
import { DEFAULT_RELAYS } from '../transport/defaultRelays.ts';

function parseRelayLines(text: string): { ok: string[]; bad: string[] } {
  const ok: string[] = [];
  const bad: string[] = [];
  for (const raw of text.split('\n')) {
    const url = raw.trim();
    if (url.length === 0) continue;
    if (/^wss?:\/\/[^\s]+$/i.test(url)) ok.push(url);
    else bad.push(url);
  }
  return { ok, bad };
}

/**
 * ReachabilitySection — the "stay reachable" transport toggle plus the relay
 * editor. Turning it on lets connections, family invites, and signing requests
 * find you when you're not in the same room; the servers only ever carry
 * scrambled data. The relay list is default-issued and replaceable.
 */
export function ReachabilitySection({
  prefs,
  updatePrefs,
}: {
  prefs: Prefs;
  updatePrefs: (next: Partial<Prefs>) => Promise<void>;
}) {
  const [relaysText, setRelaysText] = useState(() => prefs.nostrRelays.join('\n'));
  const [relayStatus, setRelayStatus] = useState<string | null>(null);
  const relayParse = parseRelayLines(relaysText);
  const relaysChanged =
    relayParse.ok.length !== prefs.nostrRelays.length ||
    relayParse.ok.some((url, i) => url !== prefs.nostrRelays[i]);

  // Re-sync the editor when prefs.nostrRelays changes outside the form
  // (e.g. first load after a fresh sign-in).
  useEffect(() => {
    setRelaysText(prefs.nostrRelays.join('\n'));
  }, [prefs.nostrRelays]);

  async function saveRelays() {
    if (relayParse.ok.length === 0) {
      setRelayStatus('Need at least one wss:// relay.');
      return;
    }
    await updatePrefs({ nostrRelays: relayParse.ok });
    setRelayStatus(
      relayParse.bad.length > 0
        ? `Saved. Skipped ${relayParse.bad.length} invalid line(s).`
        : 'Saved.',
    );
    setTimeout(() => setRelayStatus(null), 2500);
  }

  return (
    <section className="mt-4 rounded-2xl bg-white border border-ink/10 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium">Stay reachable</div>
          <p className="mt-1 text-sm text-muted">
            Let people reach you when you're not in the same room — so a
            connection, a family invite, or a signing request can find you.
            Everything stays encrypted to you; the servers that carry it only
            ever see scrambled data.
          </p>
          <p className="mt-2 text-xs text-muted">
            Privacy note: turning this on lets the network know you're online
            and reachable. Keep it off until you want to be reached.
          </p>
        </div>
        <button
          type="button"
          onClick={() => updatePrefs({ nostrTransportEnabled: !prefs.nostrTransportEnabled })}
          aria-pressed={prefs.nostrTransportEnabled}
          aria-label="Toggle staying reachable"
          className={`shrink-0 w-12 h-7 rounded-full transition-colors ${
            prefs.nostrTransportEnabled ? 'bg-accent' : 'bg-ink/15'
          }`}
        >
          <span
            className={`block h-6 w-6 bg-white rounded-full shadow transform transition-transform ${
              prefs.nostrTransportEnabled ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      <div className="mt-5 border-t border-ink/10 pt-4">
        <div className="text-sm font-medium">Relays</div>
        <p className="mt-1 text-xs text-muted">
          One wss:// URL per line. Edits take effect immediately when the network
          is on. Default-issued, replaceable — keep your own relays if you trust
          them more.
        </p>
        <textarea
          value={relaysText}
          onChange={(e) => setRelaysText(e.target.value)}
          rows={Math.max(5, relaysText.split('\n').length)}
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
          className="mt-2 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-xs font-mono"
        />
        {relayParse.bad.length > 0 && (
          <p className="mt-1 text-xs text-amber-700">
            {relayParse.bad.length} line(s) do not look like wss:// URLs and will
            be skipped.
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={saveRelays}
            disabled={!relaysChanged || relayParse.ok.length === 0}
            className="rounded-md bg-ink py-2 px-4 text-paper text-sm font-medium disabled:opacity-40"
          >
            Save relays
          </button>
          <button
            type="button"
            onClick={() => {
              setRelaysText(DEFAULT_RELAYS.join('\n'));
              setRelayStatus(null);
            }}
            className="rounded-md border border-ink/15 px-4 py-2 text-sm"
          >
            Restore defaults
          </button>
        </div>
        {relayStatus && (
          <p className="mt-2 text-xs text-muted" role="status">
            {relayStatus}
          </p>
        )}
      </div>
    </section>
  );
}
