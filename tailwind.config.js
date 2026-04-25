/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: '#0A0A0A',
        paper: '#FAFAFA',
        mist: '#F2F2F2',
        smoke: '#E0E0E0',
        ash: '#A0A0A0',
        charcoal: '#4A4A4A',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.08)',
        lifted: '0 4px 16px rgba(0,0,0,0.12)',
        drawer: '0 -4px 32px rgba(0,0,0,0.12)',
      },
      animation: {
        'slide-up': 'slideUp 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
        'fade-in': 'fadeIn 0.2s ease-out',
      },
      keyframes: {
        slideUp: {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
      },
    },
  },
  plugins: [],
};
