import { identiconSeed } from '../connections/identicon.ts';
import type { KinNode } from './kinGraph.ts';

// A stable colored avatar for a person — identicon hues from their key (or
// node id, for keyless ancestors) + initials from their name. Shared by the
// family-tree list and the connected-tree canvas.
export function KinAvatar({ node, size = 36 }: { node: KinNode; size?: number }) {
  const seed = identiconSeed(node.keyedPubkey ?? node.id, node.displayName);
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: `linear-gradient(135deg, hsl(${seed.hueA} 55% 52%), hsl(${seed.hueB} 55% 42%))`,
      }}
    >
      {seed.initials}
    </span>
  );
}
