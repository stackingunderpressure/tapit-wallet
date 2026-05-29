// Lazy-loadable Bitcoin's-role tab content for WalletGuide. Lives
// in its own module so it loads on demand when the operator opens
// the Bitcoin tab rather than shipping in the cold-start login
// bundle. The bundle-budget rule names 12KB as the threshold where
// "lazy-load the non-Account tabs" becomes the doctrine-correct
// next move; this addition crossed that threshold so the Bitcoin
// tab is the first one extracted. Subsequent tab additions follow
// the same pattern.
//
// Proactive framing of why this wallet uses Bitcoin as the public
// clock (OpenTimestamps tamper-evident timestamps) and NOT as the
// money layer (no UTXOs, no Lightning, no zaps). The doctrine
// answer is grounded in SATOSHI.md.

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-serif text-xl font-semibold text-ink">{children}</h2>;
}

function Lede({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-sm leading-relaxed text-ink/75">{children}</p>;
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4 rounded-xl border border-ink/10 bg-paper/50 p-4">
      <div className="text-sm font-semibold text-ink">{title}</div>
      <div className="mt-2 text-sm leading-relaxed text-ink/75">{children}</div>
    </div>
  );
}

export function BitcoinsRole() {
  return (
    <section>
      <SectionTitle>Bitcoin is the clock here, not the money.</SectionTitle>
      <Lede>
        This wallet uses Bitcoin one specific way: as the public
        tamper-evident clock your signed records get anchored to. It does
        not hold sats, send Lightning payments, or scan invoices. That is
        a deliberate scope choice grounded in what kind of wallet this is.
      </Lede>

      <Card title="What Bitcoin does here">
        Every signed envelope you create — a journal entry, a relationship,
        a credential — gets a hash committed to a Merkle tree maintained
        on your device. The wallet batches those roots to OpenTimestamps,
        which writes a single anchor per batch into Bitcoin. Anyone can
        later verify your envelope existed on or before that Bitcoin block,
        just from your envelope plus the inclusion proof. Math, not trust,
        with Bitcoin's longest-chain history as the clock.
      </Card>

      <Card title="What Bitcoin doesn't do here">
        This is not a Bitcoin financial wallet. There are no UTXOs to
        manage, no Lightning channels, no zaps, no Lightning addresses,
        no merchant payments, no wallet of satoshi flow. The keypair this
        wallet holds is the secret that signs your identity and your
        attestations. It is not an HD seed that could ride a Trezor or
        seed a Lightning node. A different category of wallet than your
        Phoenix or your Wallet of Satoshi — not a weaker version of them.
      </Card>

      <Card title="Where Lightning fits in the larger story">
        The broader Hearth architecture this wallet is part of uses
        Lightning for paying compute, so an LLM you run a conversation
        with settles in sats per inference instead of through a corporate
        billing relationship that can debank or rate-limit you. That is a
        separate wallet, separate keys, separate substrate, riding
        alongside the identity layer. When Hearths ship, Lightning rides
        with them. The absence here is not anti-Lightning — it is the
        identity layer staying focused on identity.
      </Card>

      <Card title="The anchor-don't-bloat principle">
        We use Bitcoin's tamper-evidence as a clock, not its block space
        as a hard drive. Every signed record stays on your device; only
        the cryptographic commitment gets anchored. Batched
        OpenTimestamps means ten thousand entries cost roughly the same
        on-chain as one. That is the right discipline for a network that
        wants to be cheap, plural, and respectful of the miners doing
        the work to secure the chain.
      </Card>

      <p className="mt-5 text-xs leading-relaxed text-muted">
        If a serious Bitcoin person asks why this wallet doesn't do
        Lightning, the answer is in this tab. The bet is that identity and
        money are different layers and a sovereign architecture ships them
        separately. Both layers are coming; this is the first.
      </p>
    </section>
  );
}
