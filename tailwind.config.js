/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        accent: {
          50: 'var(--color-accent-50)',
          100: 'var(--color-accent-100)',
          200: 'var(--color-accent-200)',
          300: 'var(--color-accent-300)',
          400: 'var(--color-accent-400)',
          500: 'var(--color-accent-500)',
          600: 'var(--color-accent-600)',
          700: 'var(--color-accent-700)',
          800: 'var(--color-accent-800)',
          900: 'var(--color-accent-900)',
          950: 'var(--color-accent-950)',
        }
      },
      spacing: {
        '0.5': 'calc(0.125rem * var(--spacing-scale))',
        '1': 'calc(0.25rem * var(--spacing-scale))',
        '1.5': 'calc(0.375rem * var(--spacing-scale))',
        '2': 'calc(0.5rem * var(--spacing-scale))',
        '2.5': 'calc(0.625rem * var(--spacing-scale))',
        '3': 'calc(0.75rem * var(--spacing-scale))',
        '3.5': 'calc(0.875rem * var(--spacing-scale))',
        '4': 'calc(1rem * var(--spacing-scale))',
        '5': 'calc(1.25rem * var(--spacing-scale))',
        '6': 'calc(1.5rem * var(--spacing-scale))',
        '7': 'calc(1.75rem * var(--spacing-scale))',
        '8': 'calc(2rem * var(--spacing-scale))',
        '9': 'calc(2.25rem * var(--spacing-scale))',
        '10': 'calc(2.5rem * var(--spacing-scale))',
        '11': 'calc(2.75rem * var(--spacing-scale))',
        '12': 'calc(3rem * var(--spacing-scale))',
        '14': 'calc(3.5rem * var(--spacing-scale))',
        '16': 'calc(4rem * var(--spacing-scale))',
        '20': 'calc(5rem * var(--spacing-scale))',
        '24': 'calc(6rem * var(--spacing-scale))',
      }
    },
  },
  plugins: [],
}

