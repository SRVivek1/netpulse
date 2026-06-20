/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans:    ['DM Sans', 'system-ui', 'sans-serif'],
        display: ['Syne', 'sans-serif'],
        mono:    ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        surface:  'var(--np-bg-surface)',
        elevated: 'var(--np-bg-elevated)',
        hover:    'var(--np-bg-hover)',
        active:   'var(--np-bg-active)',
        accent:   'var(--np-accent)',
      },
    },
  },
  plugins: [],
};
