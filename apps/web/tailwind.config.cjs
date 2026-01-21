/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px'
      }
    }
    // Theme tokens (colors, radius, animations) are defined via @theme inline in globals.css
    // This CSS-first approach is the recommended pattern for Tailwind CSS v4
  },
  plugins: [require('tailwindcss-animate'), require('@tailwindcss/typography')]
};
