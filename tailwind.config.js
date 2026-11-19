/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      screens: {
        xs: '380px',
      },
      colors: {
        navy: {
          50: '#F0F4FA',
          100: '#D9E4F2',
          200: '#B3C7E2',
          300: '#7E9CC4',
          400: '#4C6E9C',
          500: '#2C4E7A',
          600: '#1E4572',
          700: '#17375D',
          800: '#112A4A',
          900: '#0B1F3A',
          950: '#071527',
        },
        amber: {
          50: '#FFFAEB',
          100: '#FFF1C6',
          200: '#FFE488',
          300: '#FFD54F',
          400: '#FFC61F',
          500: '#FFB400',
          600: '#E09E00',
          700: '#B87C00',
          800: '#8F5F00',
          900: '#6B4700',
        },
        success: '#16A34A',
        danger: '#DC2626',
        warning: '#F97316',
        canvas: '#F5F7FA',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Noto Sans', 'Noto Sans Devanagari', 'Noto Sans Gujarati', 'sans-serif'],
        display: ['Sora', 'Inter', 'Noto Sans Devanagari', 'Noto Sans Gujarati', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        xs: ['12px', { lineHeight: '1.45' }],
        sm: ['14px', { lineHeight: '1.45' }],
        base: ['16px', { lineHeight: '1.5' }],
        lg: ['18px', { lineHeight: '1.45' }],
        xl: ['22px', { lineHeight: '1.4' }],
        '2xl': ['28px', { lineHeight: '1.3' }],
        '3xl': ['34px', { lineHeight: '1.2' }],
      },
      borderRadius: {
        '2xl': '18px',
        '3xl': '24px',
        '4xl': '30px',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(11,31,58,0.04), 0 8px 24px -12px rgba(11,31,58,0.18)',
        lift: '0 12px 40px -16px rgba(11,31,58,0.35)',
        fab: '0 10px 28px -6px rgba(255,180,0,0.55), 0 2px 6px rgba(11,31,58,0.35)',
      },
      keyframes: {
        'slide-up': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.32)', opacity: '0.9' },
          '80%,100%': { transform: 'scale(1)', opacity: '0' },
        },
        pop: {
          '0%': { transform: 'scale(0.9)', opacity: '0' },
          '60%': { transform: 'scale(1.02)', opacity: '1' },
          '100%': { transform: 'scale(1)' },
        },
      },
      animation: {
        'slide-up': 'slide-up 300ms cubic-bezier(0.32, 0.72, 0, 1)',
        shimmer: 'shimmer 1.4s infinite',
        'pulse-ring': 'pulse-ring 2.4s cubic-bezier(0.2, 0.6, 0.3, 1) infinite',
        pop: 'pop 220ms ease-out',
      },
    },
  },
  plugins: [],
}
