/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#fdf5f1',
          100: '#f9e6de',
          200: '#f2cdc0',
          300: '#e9aa94',
          400: '#e08c6b',
          500: '#da7858',
          600: '#c5613e',
          700: '#a44e32',
          800: '#87412c',
          900: '#6e3726',
        },
        surface: {
          base:    '#FAF9F5',
          raised:  '#E9E7DD',
          overlay: '#EEEEE8',
          border:  '#D8D5CB',
        },
        crm: {
          sidebar: '#333638',
          'sidebar-hover': '#414547',
          'sidebar-border': '#4A4D50',
          'sidebar-text': '#FAF9F5',
          'sidebar-muted': '#A0A5A8',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
};
