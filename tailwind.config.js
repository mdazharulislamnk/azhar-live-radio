/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#dc2626',
          hover: '#b91c1c',
        },
        secondary: '#6b7280',
      },
      spacing: {
        'section': '2rem',
        'container': '0.5rem',
      },
    },
  },
  plugins: [],
}
