/** @type {import('tailwindcss').Config} */
// Colours are design tokens (CSS variables in src/app/globals.css), so light and dark mode work
// everywhere. Components use these names (bg-surface, text-muted, bg-brand …), never hex values.
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

module.exports = {
  content: ['./src/**/*.{js,jsx,mdx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      screens: { xs: '400px' },
      colors: {
        page: token('page'),
        surface: token('surface'),
        raised: token('raised'),
        border: token('border'),
        text: token('text'),
        muted: token('muted'),
        brand: {
          DEFAULT: token('brand'),
          strong: token('brand-strong'),
          soft: token('brand-soft'),
        },
        success: token('success'),
        warning: token('warning'),
        danger: token('danger'),
        info: token('info'),
        sidebar: token('sidebar'),
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
