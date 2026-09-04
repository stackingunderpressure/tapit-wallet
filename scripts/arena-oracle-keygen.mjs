#!/usr/bin/env node
// Generate the Beat the HODL price-oracle key pair, then print the exact
// env vars to set. Run: `node scripts/arena-oracle-keygen.mjs`
//
// The PRIVATE key is a secret — it goes ONLY in Netlify env
// (ARENA_ORACLE_PRIVATE_KEY), never committed, never prefixed VITE_. The
// PUBLIC key is safe to publish; clients verify every signed price against
// it (VITE_ARENA_ORACLE_PUBKEY). The URL is your deployed function path.
import { schnorr } from '@noble/curves/secp256k1';
import { bytesToHex } from '@noble/hashes/utils';

const priv = schnorr.utils.randomSecretKey();
const privHex = bytesToHex(priv);
const pubHex = bytesToHex(schnorr.getPublicKey(priv));

console.log(`
Beat the HODL — price oracle key generated.

1) Netlify env (server secret — NEVER commit, NEVER prefix VITE_):
   ARENA_ORACLE_PRIVATE_KEY=${privHex}

2) Netlify env (public, safe) + your site's build env:
   VITE_ARENA_ORACLE_PUBKEY=${pubHex}
   VITE_ARENA_ORACLE_URL=https://<your-site>.netlify.app/api/price-oracle

3) Deploy. Then open the arena — it will fetch, verify, and execute at
   the signed live price. Confirm by hitting the URL in a browser: you
   should get JSON with price/time/source/round/pubkey/sig, and the pubkey
   must equal the VITE_ARENA_ORACLE_PUBKEY above.

Keep the private key somewhere safe. If it leaks, rotate: generate a new
pair, update both env vars, redeploy — old signed rounds simply stop
verifying against the new pubkey.
`);
