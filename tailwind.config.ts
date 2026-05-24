import type { Config } from 'tailwindcss';

// Theme tokens live in two registers.
//
// CLASSIC tokens (ink, paper, accent, muted) are plain hex literals —
// the surface the wallet has shipped under since Phase 1. They do
// not move when the theme flips because the Classic surface itself
// is the fallback the operator returns to.
//
// FRESH tokens (the `fresh-*` family) reference CSS custom properties
// defined under the `[data-theme="fresh"]` selector in `src/index.css`.
// The variables also exist on `:root` so the utility classes resolve
// to sensible neutral defaults even when the operator has not flipped
// to Fresh — components written against `bg-fresh-surface-base` etc.
// always render; the theme attribute only changes the values the
// variables hold. One `<html data-theme="fresh">` switch flips every
// fresh-* utility class at once with no React re-render of consumers.
//
// Documented in the 2026-05-24 Fresh young-adult-friendly theme +
// IA roadmap brief, Cut 1.

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0f1419',
        paper: '#f7f6f1',
        accent: '#2d6a4f',
        muted: '#6b7280',

        'fresh-surface-base': 'var(--fresh-surface-base)',
        'fresh-surface-raised': 'var(--fresh-surface-raised)',
        'fresh-surface-glass': 'var(--fresh-surface-glass)',
        'fresh-surface-edge': 'var(--fresh-surface-edge)',
        'fresh-text-primary': 'var(--fresh-text-primary)',
        'fresh-text-secondary': 'var(--fresh-text-secondary)',
        'fresh-text-tertiary': 'var(--fresh-text-tertiary)',
        'fresh-text-inverse': 'var(--fresh-text-inverse)',
        'fresh-accent-primary': 'var(--fresh-accent-primary)',
        'fresh-accent-secondary': 'var(--fresh-accent-secondary)',
        'fresh-accent-warning': 'var(--fresh-accent-warning)',
        'fresh-accent-danger': 'var(--fresh-accent-danger)',
        'fresh-anchor-glow': 'var(--fresh-anchor-glow)',
        'fresh-mycelium-glow': 'var(--fresh-mycelium-glow)',
      },
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'sans-serif',
        ],
        serif: ['ui-serif', 'Georgia', 'Cambria', 'Times New Roman', 'serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        // Fresh families ship without commercial licenses out of the
        // gate (Editorial New / Recoleta / Berkeley Mono are open
        // questions for the operator) — the fallbacks render
        // acceptably on every platform and licensing can land later
        // without code changes.
        'fresh-display': [
          'Recoleta',
          'ui-serif',
          'Georgia',
          'Cambria',
          'Times New Roman',
          'serif',
        ],
        'fresh-body': [
          'Geist',
          'Inter',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'sans-serif',
        ],
        'fresh-mono': [
          'JetBrains Mono',
          'IBM Plex Mono',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'monospace',
        ],
      },
      fontSize: {
        // Editorial-weight headline scale for Fresh — larger than
        // Classic's quietly-considered serif sizes, tighter tracking
        // for that late-2025 / 2026 editorial-display register.
        'fresh-hero': ['48px', { lineHeight: '1.05', letterSpacing: '-0.04em' }],
        'fresh-display': ['32px', { lineHeight: '1.1', letterSpacing: '-0.03em' }],
        'fresh-title': ['22px', { lineHeight: '1.2', letterSpacing: '-0.02em' }],
      },
      keyframes: {
        rise: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-22px)' },
        },
        // Spring-tuned rise for Fresh — slightly more travel, looser
        // ease so cards feel like they ride a spring instead of a
        // linear curve.
        'fresh-rise': {
          '0%': { opacity: '0', transform: 'translateY(18px) scale(0.98)' },
          '60%': { opacity: '1', transform: 'translateY(-2px) scale(1.005)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        // Tap-feedback shrink + glow. Cards / buttons translate-y by
        // a hair on press and the glass edge glows briefly with the
        // primary accent at low opacity.
        'fresh-press': {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(0.92)' },
          '100%': { transform: 'scale(1)' },
        },
        // Anchored-confirmation reveal — a slow shimmer wipe across
        // the share card when the Bitcoin block confirmation lands.
        'fresh-shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        // OTS block-N "stamp" reveal — a small scale-down + opacity
        // pop on the block-height chip when the proof finalizes.
        'fresh-stamp': {
          '0%': { opacity: '0', transform: 'scale(1.4) rotate(-2deg)' },
          '60%': { opacity: '1', transform: 'scale(0.95) rotate(0.5deg)' },
          '100%': { opacity: '1', transform: 'scale(1) rotate(0deg)' },
        },
        // Aurora-drift gradient backdrop for the Fresh landing
        // surface — a very slow hue + position shift that replaces
        // the Classic float-glows.
        'fresh-aurora': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
      },
      animation: {
        rise: 'rise 0.6s cubic-bezier(0.22, 0.7, 0.25, 1) both',
        float: 'float 16s ease-in-out infinite',
        'float-slow': 'float 24s ease-in-out infinite',
        // Spring physics expressed via a 4-point cubic-bezier that
        // overshoots before settling — closer to "spring-tuned" than
        // any linear easing keyword.
        'fresh-rise': 'fresh-rise 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'fresh-press': 'fresh-press 0.18s cubic-bezier(0.4, 0, 0.6, 1)',
        'fresh-shimmer': 'fresh-shimmer 2.4s ease-in-out infinite',
        'fresh-stamp': 'fresh-stamp 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'fresh-aurora': 'fresh-aurora 18s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
