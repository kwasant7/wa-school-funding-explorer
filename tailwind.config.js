/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#f9f9f7',
        surface: '#fcfcfb',
        ink: {
          DEFAULT: '#0b0b0b',
          secondary: '#52514e',
          muted: '#898781',
        },
        line: '#e1e0d9',
        baseline: '#c3c2b7',
        accent: {
          DEFAULT: '#256abf',
          deep: '#104281',
          soft: '#cde2fb',
          wash: '#eef4fb',
        },
        series: {
          state: '#2a78d6',
          local: '#1baf7a',
          federal: '#eda100',
          other: '#008300',
        },
        good: '#006300',
        critical: '#d03b3b',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      maxWidth: {
        site: '72rem',
      },
    },
  },
  plugins: [],
};
