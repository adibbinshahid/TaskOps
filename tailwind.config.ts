import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg:          'rgb(var(--bg)       / <alpha-value>)',
        surface:     'rgb(var(--surface)  / <alpha-value>)',
        s2:          'rgb(var(--s2)       / <alpha-value>)',
        t1:          'rgb(var(--t1)       / <alpha-value>)',
        t2:          'rgb(var(--t2)       / <alpha-value>)',
        t3:          'rgb(var(--t3)       / <alpha-value>)',
        accent:      'rgb(var(--accent)   / <alpha-value>)',
        'accent-h':  'rgb(var(--accent-h) / <alpha-value>)',
        sidebar:     'rgb(var(--sidebar)  / <alpha-value>)',
        // backward-compat aliases
        'accent-hover': 'rgb(var(--accent-h) / <alpha-value>)',
        card:        'rgb(var(--surface)  / <alpha-value>)',
        'card-hover':'rgb(var(--s2)       / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        card:      '0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
        'card-md': '0 6px 24px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.06)',
        modal:     '0 24px 80px rgba(0,0,0,0.18), 0 8px 32px rgba(0,0,0,0.10)',
      },
      keyframes: {
        drift: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%':       { transform: 'translate(40px, -60px) scale(1.08)' },
          '66%':       { transform: 'translate(-30px, 30px) scale(0.92)' },
        },
        'drift-slow': {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '50%':       { transform: 'translate(-50px, 40px) scale(1.12)' },
        },
        'pulse-ring': {
          '0%':   { transform: 'scale(1)', opacity: '1' },
          '100%': { transform: 'scale(1.5)', opacity: '0' },
        },
      },
      animation: {
        drift:        'drift 18s ease-in-out infinite',
        'drift-slow': 'drift-slow 24s ease-in-out infinite',
        'pulse-ring': 'pulse-ring 1.2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};

export default config;
