import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ADE-ish palette
        night: '#0b0b12',
        panel: '#15151f',
        panel2: '#1c1c29',
        accent: '#ff2e63',
        accent2: '#ffd166',
        muted: '#8b8ba7',
        line: '#26263a',
      },
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};

export default config;
