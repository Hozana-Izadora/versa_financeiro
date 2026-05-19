/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Backgrounds
        bg: {
          DEFAULT: '#f6f8fa',
          2: '#ffffff',
          3: '#f0f4f8',
          subtle: '#f0fdf4',
        },
        // Cards
        card: {
          DEFAULT: '#ffffff',
          2: '#f8fafc',
          hover: '#fafffe',
        },
        // Text hierarchy
        text: {
          base: '#0d1117',
          2: '#4b5563',
          3: '#9ca3af',
          inv: '#ffffff',
        },
        // Primary accent — emerald green
        accent: {
          DEFAULT: '#10b981',
          2: '#059669',
          3: '#047857',
          light: '#d1fae5',
          muted: 'rgba(16,185,129,0.10)',
        },
        // Border system
        border: {
          DEFAULT: 'rgba(0,0,0,0.07)',
          medium: 'rgba(0,0,0,0.11)',
          strong: 'rgba(0,0,0,0.18)',
        },
        // Financial semantic colors
        fin: {
          green: '#10b981',
          green2: '#059669',
          red: '#ef4444',
          red2: '#dc2626',
          yellow: '#f59e0b',
          blue: '#3b82f6',
          purple: '#8b5cf6',
          cyan: '#06b6d4',
          orange: '#f97316',
        },
      },
      fontFamily: {
        inter: ['ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'monospace'],
        outfit: ['ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '18px',
        card2: '10px',
        sm: '7px',
        xs: '5px',
        pill: '9999px',
      },
      boxShadow: {
        xs: '0 1px 2px rgba(0,0,0,0.04)',
        card: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'card-hover': '0 8px 28px rgba(0,0,0,0.09), 0 2px 6px rgba(0,0,0,0.05)',
        'green-glow': '0 6px 24px rgba(16,185,129,0.16)',
        modal: '0 24px 64px rgba(0,0,0,0.14), 0 4px 16px rgba(0,0,0,0.08)',
        inner: 'inset 0 1px 2px rgba(0,0,0,0.06)',
      },
      animation: {
        'spin-slow': 'spin 2s linear infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
}
