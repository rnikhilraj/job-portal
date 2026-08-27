import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/app/**/*.{ts,tsx}', './src/components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#d9e5ff',
          500: '#3b6bf5',
          600: '#2b53d4',
          700: '#2242ab',
        },
      },
    },
  },
  plugins: [],
};

export default config;
