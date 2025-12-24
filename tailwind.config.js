/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#165DFF', // Main Blue
          hover: '#4080FF',
          active: '#0E42D2',
        },
        accent: '#FF7D00', // Orange
        success: '#00B42A', // Green
        danger: '#F53F3F', // Red
        gray: {
          50: '#F7F8FA',
          100: '#F2F3F5',
          200: '#E5E6EB',
          300: '#C9CDD4',
          400: '#86909C',
          500: '#6B7785',
          600: '#4E5969',
          700: '#3C3C3C',
          800: '#2D2D2D',
          900: '#1F1F1F',
        }
      },
      fontFamily: {
        sans: ['Inter', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
