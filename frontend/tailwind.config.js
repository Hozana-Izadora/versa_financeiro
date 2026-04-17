/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#f1f5f9',
          2: '#ffffff',
          3: '#f8fafc',
        },
        card: {
          DEFAULT: '#ffffff',
          2: '#f8fafc',
        },
        text: {
          base: '#0f172a',
          2: '#475569',
          3: '#94a3b8',
        },
        accent: {
          DEFAULT: '#2563eb',
          2: '#4f46e5',
        },
        fin: {
          green: '#10b981',
          green2: '#059669',
          red: '#ef4444',
          red2: '#dc2626',
          yellow: '#d97706',
          cyan: '#0891b2',
          purple: '#7c3aed',
          orange: '#ea580c',
        },
      },
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
        mono: ['Geist Mono', 'monospace'],
        outfit: ['Outfit', 'sans-serif'],
      },
      borderRadius: {
        card: '12px',
        sm: '7px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
        modal: '0 20px 60px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.08)',
      },
    },
  },
  plugins: [],
}
