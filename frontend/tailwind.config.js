/** @type {import('tailwindcss').Config} */
export default {
  // Only scan files that actually use Tailwind classes — keeps the CSS bundle tiny
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      // Role-specific accent colours used across the app
      colors: {
        admin:   { DEFAULT: '#6366f1', light: '#818cf8', dark: '#4f46e5' }, // indigo
        faculty: { DEFAULT: '#0ea5e9', light: '#38bdf8', dark: '#0284c7' }, // sky
        student: { DEFAULT: '#10b981', light: '#34d399', dark: '#059669' }, // emerald
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
