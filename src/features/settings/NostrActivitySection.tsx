import { useContext, useEffect, useState } from 'react';
import { envelopeId, type Attestation } from 'tapit-attest';
import { WalletContext } from '../wallet-core/WalletContext.ts';
import { transportActivity, type TransportActivityEntry } from '../transport/transportActivity.ts';
import { channelDiagnostics, type ChannelDiagnosticEntry } from '../transport/channelDiagnostics.ts';
import { isVaultMembership, readVaultMembership } from '../sign-request/vaultTrail.ts';

// Plain-English label for the kind numbers an operator will actually see
// here -- the raw integer means nothing to a non-technical reader trying
// to answer "did anything ever arrive."
const KIND_LABELS: Record<number, string> = {
  13: 'chat (seal)',
  1059: 'chat message',
  9573: 'attestation',
  9575: 'liveness check',
  9576: 'spend request',
  9577: 'safety phrase',
  9578: 'vault invite',
  9579: 'spend request reply',
};

function kindLabel(kind: number): string {
  return KIND_LABELS[kind] ?? `kind ${kind}`;
}

const STAGE_LABELS: Record<ChannelDiagnosticEntry['stage'], string> = {
  verify_failed: 'signature did not verify',
  decrypt_failed: 'could not decrypt',
  parse_failed: 'not valid JSON after decrypt',
  schema_failed: "decrypted but didn't match the expected shape",
  delivered: 'delivered to the app',
  suppressed: 'decrypted fine, but not shown as a banner',
};

const CHANNEL_LABELS: Record<string, string> = {
  'psbt-cosign': 'spend request',
  'vault-membership': 'vault invite',
};

function channelLabel(channel: string): string {
  return CHANNEL_LABELS[channel] ?? channel;
}

// Operator, 2026-08-08: "I've never been able to receive a message...
// nothing is coming through." This surfaces transportActivity.ts's wire-
// level counter -- every event that actually reached a live subscription,
// BEFORE any app-level decrypt is attempted -- so "nothing ever arrives"
// and "something arrives but a specific channel drops it" are two
// distinguishable, checkable facts instead of one indistinguishable
// symptom. Zero here means the problem is upstream (relay delivery,
// reachability); nonzero-but-nothing-shows-up-elsewhere means the problem
// is downstream, in one specific channel's decrypt/parse/routing.
export function NostrActivitySection() {
  const ctx = useContext(WalletContext);
  const [total, setTotal] = useState<number | null>(null);
  const [recent, setRecent] = useState<TransportActivityEntry[]>([]);
  const [diagnostics, setDiagnostics] = useState<ChannelDiagnosticEntry[]>([]);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // Operator, 2026-08-11: "still not seeing in inbox or banner." A vault
  // invite that decrypts fine ("delivered to the app" above) can still
  // never become a banner if this wallet ALREADY holds an accepted
  // membership for that same vault -- useVaultMembershipRequests.ts's
  // findVaultTrail check suppresses every future request for a vault it
  // already has a trail for, by design (re-accepting would be pointless).
  // There was previously no way to see -- let alone undo -- that: Cut
  // C3's own manifest note named "no later revoke my membership
  // affordance" as an explicit gap. This surfaces exactly what's held so
  // a stale accept (e.g. from testing, before a key rotation) can be told
  // apart from "nothing is actually wrong" and cleared if it's the cause.
  const vaultMemberships = (ctx?.holdings ?? [])
    .filter(isVaultMembership)
    .map((att) => ({ att, view: readVaultMembership(att) }));

  async function revoke(att: Attestation) {
    if (!ctx) return;
    const id = envelopeId(att);
    setRevokingId(id);
    try {
      await ctx.wallet.unhold(id);
      await ctx.refresh();
    } finally {
      setRevokingId(null);
    }
  }

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void transportActivity.summary().then((s) => {
        if (cancelled) return;
        setTotal(s.totalReceived);
        setRecent(s.recent);
      });
      void channelDiagnostics.recent().then((d) => {
        if (cancelled) return;
        setDiagnostics(d);
      });
    };
    load();
    // Live-ish without a real subscription: cheap poll while this
    // section is mounted, so watching this screen right after tapping
    // "Notify via Nostr" on the other side actually shows the counter
    // move without a manual refresh.
    const iv = window.setInterval(load, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(iv);
    };
  }, []);

  return (
    <section className="mt-4 rounded-2xl bg-white border border-ink/10 p-5 shadow-sm">
      <div className="font-medium">Nostr activity</div>
      <p className="mt-1 text-sm text-muted">
        Every message that has actually reached this wallet over the network, at the wire
        level -- before any decryption is attempted. If this stays at 0 after someone sends
        you something, the message never reached this device at all.
      </p>
      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-2xl font-semibold">{total ?? '...'}</span>
        <span className="text-sm text-muted">
          {total === 1 ? 'message ever received' : 'messages ever received'}
        </span>
      </div>
      {recent.length > 0 && (
        <div className="mt-4 space-y-1.5">
          <div className="text-xs font-medium uppercase tracking-wide text-muted">
            Most recent
          </div>
          {recent.slice(0, 8).map((e, i) => (
            <div key={i} className="flex items-center justify-between text-xs text-muted">
              <span>{kindLabel(e.kind)}</span>
              <span>{new Date(e.receivedAt).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
      {diagnostics.length > 0 && (
        <div className="mt-5 pt-4 border-t border-ink/10 space-y-1.5">
          <div className="text-xs font-medium uppercase tracking-wide text-muted">
            Decode attempts
          </div>
          <p className="text-xs text-muted">
            A spend request or vault invite can reach this device and still fail to become a
            banner -- this shows exactly which step it failed at.
          </p>
          {diagnostics.slice(0, 8).map((d, i) => (
            <div key={i} className="text-xs">
              <div className="flex items-center justify-between">
                <span
                  className={
                    d.stage === 'delivered'
                      ? 'text-green-700'
                      : d.stage === 'suppressed'
                        ? 'text-amber-700'
                        : 'text-red-700'
                  }
                >
                  {channelLabel(d.channel)} -- {STAGE_LABELS[d.stage]}
                </span>
                <span className="text-muted">{new Date(d.at).toLocaleTimeString()}</span>
              </div>
              {d.detail && <div className="text-muted break-all">{d.detail}</div>}
              {d.keyMatch && !d.keyMatch.addressedToMe && (
                <div className="mt-0.5 text-amber-700">
                  This wasn't addressed to this wallet at all -- most likely someone else's
                  traffic reaching this device over a shared relay, not a decrypt problem here.
                </div>
              )}
              {d.keyMatch && d.keyMatch.addressedToMe && !d.keyMatch.matchedIsCurrentKey && (
                <div className="mt-0.5 text-amber-700">
                  Addressed to an older key this wallet has since rotated away from, not the
                  current one -- the sender needs to re-copy this wallet's CURRENT public key
                  from "Your public key" above and use that instead.
                </div>
              )}
              {d.keyMatch && d.keyMatch.addressedToMe && d.keyMatch.matchedIsCurrentKey && (
                <div className="mt-0.5 text-red-700">
                  Addressed to this wallet's CURRENT key and still failed -- this is not a
                  stale-key issue, it needs a closer look at the decrypt path itself.
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {total === 0 && (
        <p className="mt-4 text-xs text-muted">
          Nothing has ever arrived on this device. If someone just sent you a message and
          this is still 0 after a few seconds, the issue is before this wallet ever sees
          it -- check "Stay reachable" above is on, and confirm the sender's message
          actually reached at least one relay on their end.
        </p>
      )}
      {vaultMemberships.length > 0 && (
        <div className="mt-5 pt-4 border-t border-ink/10 space-y-2">
          <div className="text-xs font-medium uppercase tracking-wide text-muted">
            Vault memberships held
          </div>
          <p className="text-xs text-muted">
            A vault this wallet already holds an accepted membership for will never show a
            new invite banner again -- that's by design, but it means a stale accept (from
            testing, or from before a key rotation) can silently hide every future invite for
            that same vault. Revoke here if one of these shouldn't still be held.
          </p>
          {vaultMemberships.map(({ att, view }) => {
            const id = envelopeId(att);
            return (
              <div key={id} className="flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <div className="truncate">
                    {view.vaultName || view.vaultDescriptor.slice(0, 24) + '…'}{' '}
                    <span className="text-muted">({view.role})</span>
                  </div>
                  <div className="text-muted">
                    accepted {new Date(att.issuedAt).toLocaleDateString()}
                  </div>
                </div>
                <button
                  type="button"
                  className="shrink-0 text-red-700 underline disabled:opacity-50"
                  disabled={revokingId === id}
                  onClick={() => void revoke(att)}
                >
                  {revokingId === id ? 'Revoking…' : 'Revoke'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
