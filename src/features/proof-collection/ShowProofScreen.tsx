import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWallet } from '../wallet-core/useWallet.ts';
import { displayNameOf, peerNamesByPubkey } from '../connections/createHandshake.ts';
import { shortKey } from '../connections/identityChipHelpers.ts';
import { QrShow } from '../qr/QrShow.tsx';
import { lettersInWallet } from './letters.ts';
import { buildCollection, collectionUrl, QR_URL_LIMIT } from './proofBundle.ts';

/**
 * Show my proof: pick the letters someone else signed for you and hand
 * over a link. The other person opens it -- with or without Tapit -- and
 * sees each letter checked on their own device. Only what you tick leaves
 * the wallet; nothing is uploaded or posted anywhere.
 */
export function ShowProofScreen() {
  const { wallet, holdings, identity } = useWallet();
  const myName = identity ? displayNameOf(identity) : undefined;
  const names = useMemo(() => peerNamesByPubkey(holdings, wallet.identity, myName), [holdings, wallet.identity, myName]);
  const letters = useMemo(() => lettersInWallet(holdings, wallet.keyHistory), [holdings, wallet.keyHistory]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const nameOf = (k: string) => names.get(k.toLowerCase()) ?? shortKey(k);
  const toggle = (id: string) => {
    setLink(null);
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  function makeLink() {
    const chosen = letters.filter((l) => picked.has(l.id)).map((l) => l.attestation);
    const c = buildCollection({ holder: wallet.identity, holderKeys: wallet.keyHistory, holderName: myName, letters: chosen, namesByPubkey: names });
    setLink(collectionUrl(c, window.location.origin));
  }

  async function share() {
    if (!link) return;
    try {
      if (navigator.share) await navigator.share({ title: 'My proof', url: link });
      else {
        await navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    } catch {
      // cancelled
    }
  }

  return (
    <div className="min-h-screen p-5 max-w-md mx-auto pb-24">
      <header className="flex items-center justify-between py-2">
        <Link to="/?tab=identity" className="text-sm text-muted hover:text-ink min-h-11 flex items-center">
          ← Back
        </Link>
        <h1 className="text-lg font-semibold">Show my proof</h1>
        <span className="w-12" aria-hidden />
      </header>
      <p className="mt-2 text-sm text-muted leading-relaxed">
        Pick the letters that fit what they need. They see only what you tick. If it helps, it helps.
      </p>

      {letters.length === 0 ? (
        <div className="mt-4 rounded-2xl bg-white border border-ink/10 p-5 text-sm leading-relaxed">
          No letters yet. A letter is anything someone else signed for you: a connection made in person, your family record, a membership,
          or a journal entry someone confirmed.
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {letters.map((l) => {
            const on = picked.has(l.id);
            return (
              <li key={l.id}>
                <label className={`flex gap-3 items-start rounded-2xl bg-white p-4 cursor-pointer border ${on ? 'border-accent' : 'border-ink/10'}`}>
                  <input type="checkbox" checked={on} onChange={() => toggle(l.id)} className="mt-1 h-5 w-5 accent-[#2d6a4f]" />
                  <span className="min-w-0 flex-1">
                    <span className="flex justify-between gap-2 text-xs uppercase tracking-wide text-muted">
                      <span>{l.kindLabel}</span>
                      <span>{new Date(l.issuedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })}</span>
                    </span>
                    <span className="block mt-1 text-sm font-medium">Signed by {l.others.map(nameOf).join(', ')}</span>
                    {l.fields[0] && (
                      <span className="block mt-0.5 text-sm text-muted truncate">
                        {l.fields[0].name}: {l.fields[0].value}
                      </span>
                    )}
                    {!l.attestation.anchor && <span className="block mt-1 text-xs text-muted">No Bitcoin date yet</span>}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      {letters.length > 0 && !link && (
        <button
          type="button"
          disabled={picked.size === 0}
          onClick={makeLink}
          className="mt-5 w-full min-h-12 rounded-xl bg-ink text-paper text-sm font-medium disabled:opacity-40"
        >
          {picked.size === 0 ? 'Tick at least one letter' : `Show ${picked.size} ${picked.size === 1 ? 'letter' : 'letters'}`}
        </button>
      )}

      {link && (
        <section className="mt-5 rounded-2xl bg-white border border-ink/10 p-5 space-y-3">
          {link.length <= QR_URL_LIMIT ? (
            <QrShow text={link} label="Let them scan this" />
          ) : (
            <p className="text-sm text-muted">Too many letters for one code to scan. Send them the link instead.</p>
          )}
          <button type="button" onClick={() => void share()} className="w-full min-h-12 rounded-xl bg-ink text-paper text-sm font-medium">
            {copied ? 'Link copied' : 'Send the link'}
          </button>
          <p className="text-xs text-muted leading-relaxed">
            Anyone with this link can read these letters, and pass them on, like a paper reference. Nothing else in your wallet goes with it.
          </p>
        </section>
      )}
    </div>
  );
}
