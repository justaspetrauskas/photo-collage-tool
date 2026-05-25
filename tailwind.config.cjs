/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: '1rem',
        sm: '1.25rem',
        lg: '1.5rem',
      },
    },
    extend: {
      colors: {
        bg: 'rgb(var(--color-bg) / <alpha-value>)',
        paper: 'rgb(var(--color-paper) / <alpha-value>)',
        ink: 'rgb(var(--color-ink) / <alpha-value>)',
        muted: 'rgb(var(--color-muted) / <alpha-value>)',
        accent: {
          DEFAULT: 'rgb(var(--color-accent) / <alpha-value>)',
          soft: 'rgb(var(--color-accent-soft) / <alpha-value>)',
          deep: 'rgb(var(--color-accent-deep) / <alpha-value>)',
        },
        line: 'rgb(var(--color-line) / <alpha-value>)',
        warn: 'rgb(var(--color-warn) / <alpha-value>)',
        danger: 'rgb(var(--color-danger) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        panel: '1.1rem',
      },
      boxShadow: {
        panel: '0 22px 48px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(148, 163, 184, 0.14)',
      },
      backgroundImage: {
        atmosphere:
          'radial-gradient(circle at 12% 8%, rgba(124,58,237,0.42) 0%, rgba(124,58,237,0) 48%), radial-gradient(circle at 88% 2%, rgba(34,211,238,0.35) 0%, rgba(34,211,238,0) 46%), radial-gradient(circle at 52% 96%, rgba(59,130,246,0.28) 0%, rgba(59,130,246,0) 42%)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 320ms ease-out',
      },
      zIndex: {
        overlay: '40',
        drawer: '50',
        toast: '70',
        tooltip: '80',
      },
    },
  },
  plugins: [],
};
