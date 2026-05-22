import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0f1419',
        paper: '#f7f6f1',
        accent: '#2d6a4f',
        muted: '#6b7280',
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
      },
      animation: {
        rise: 'rise 0.6s cubic-bezier(0.22, 0.7, 0.25, 1) both',
        float: 'float 16s ease-in-out infinite',
        'float-slow': 'float 24s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
