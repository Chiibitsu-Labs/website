import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
  safelist: [
    { pattern: /bg-(slate|zinc|violet|indigo|blue|teal|emerald|rose|amber|orange)-(50|100|500|600|700|800|900)/ },
    { pattern: /text-(slate|zinc|violet|indigo|blue|teal|emerald|rose|amber|orange)-(50|100|500|600|700|800|900)/ },
    { pattern: /border-(slate|zinc|violet|indigo|blue|teal|emerald|rose|amber|orange)-(200|300|500|600)/ },
    { pattern: /ring-(slate|zinc|violet|indigo|blue|teal|emerald|rose|amber|orange)-(300|500)/ },
    { pattern: /from-(slate|zinc|violet|indigo|blue|teal|emerald|rose|amber|orange)-(500|600|700|800)/ },
    { pattern: /to-(slate|zinc|violet|indigo|blue|teal|emerald|rose|amber|orange)-(600|700|800|900)/ },
  ],
}

export default config
