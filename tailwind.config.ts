import type { Config } from 'tailwindcss';

/**
 * Design tokens for the hiring platform.
 *
 * Two rules hold the palette together:
 *
 * 1. `petrol` is the only interactive colour — buttons, links, focus rings —
 *    and is never used to convey a status. The semantic ramp (slate, amber,
 *    green, rose) is never used for interactive chrome. One hue, one job, so a
 *    coloured element is never ambiguous about what it is telling you.
 * 2. Colour is never the sole carrier of meaning. Green (Shortlisted) and rose
 *    (Rejected) are nearly indistinguishable under deuteranopia, so status is
 *    always accompanied by a text label, an icon, and position on the pipeline
 *    rail — all of which survive in greyscale.
 *
 * Every foreground value below clears WCAG AA against its intended background;
 * most approach AAA.
 */
const config: Config = {
  content: ['./src/app/**/*.{ts,tsx}', './src/components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Primary — interactive only.
        petrol: {
          50: '#F0F6F7',
          100: '#DCEBEE',
          200: '#BBD8DD',
          300: '#8FBEC7',
          400: '#4E93A0',
          500: '#177586',
          600: '#0F6675', // 6.61:1 on white
          700: '#0B4E5A', // 9.33:1 on white
          800: '#093C45',
          900: '#072D34',
        },
        // Neutrals — cool, teal-leaning, deliberately not cream and not pure grey.
        ink: {
          DEFAULT: '#16262B', // 15.6:1 on white — body text
          soft: '#2B4048',
          muted: '#55686F', // 5.84:1 — secondary text
          // Darkened from #7C8D93, which measured 3.45:1 on white and failed AA
          // for the small meta text (dates, file sizes) it is used for.
          faint: '#5F7176', // 5.11:1 on white, 4.79:1 on canvas, 4.50:1 on mist-200
        },
        mist: {
          50: '#FAFCFC',
          100: '#F5F8F9', // page canvas
          200: '#EDF1F3',
          300: '#DDE4E7', // hairlines
          400: '#C6D1D6',
        },
        // Semantic — status only, never interactive.
        status: {
          applied: '#4E6674',
          'applied-tint': '#EDF1F3',
          reviewed: '#96520A',
          'reviewed-tint': '#FBF0DF',
          shortlisted: '#116B45',
          'shortlisted-tint': '#E2F1E9',
          rejected: '#B02A45',
          'rejected-tint': '#FBE7EB',
        },
      },
      fontFamily: {
        // Display: sturdy grotesque, used with restraint at large sizes.
        display: ['var(--font-display)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        // Body: drawn for dense business content, which is what this app is.
        sans: ['var(--font-body)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display-lg': ['2.5rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'display-md': ['1.875rem', { lineHeight: '1.15', letterSpacing: '-0.018em' }],
        'display-sm': ['1.375rem', { lineHeight: '1.25', letterSpacing: '-0.012em' }],
      },
      boxShadow: {
        card: '0 1px 2px rgba(22, 38, 43, 0.04), 0 1px 3px rgba(22, 38, 43, 0.06)',
        'card-hover': '0 2px 4px rgba(22, 38, 43, 0.06), 0 8px 20px rgba(22, 38, 43, 0.08)',
      },
      borderRadius: {
        card: '0.625rem',
      },
      maxWidth: {
        prose: '68ch',
      },
    },
  },
  plugins: [],
};

export default config;
