import type { Config } from 'tailwindcss'

export default <Partial<Config>>{
  content: [
    './app/components/**/*.{vue,tsx,ts}',
    './app/layouts/**/*.{vue,tsx,ts}',
    './app/pages/**/*.{vue,tsx,ts}',
    './app/composables/**/*.ts',
    './app/utils/**/*.{ts,tsx}',
    './app/plugins/**/*.ts',
    './app/app.vue',
    './app/error.vue',
  ],
  theme: {
    extend: {
      boxShadow: {
        // М'яка «елевація» картки, як у мобільному застосунку
        card: '0 1px 3px rgb(16 24 40 / 0.10), 0 4px 10px -2px rgb(16 24 40 / 0.14), 0 12px 28px -6px rgb(16 24 40 / 0.16)',
      },
      colors: {
        // Тепло-зелений фон карток (як у мобільному застосунку)
        card: '#f2f5eb',
        brand: {
          50: '#eef7ee',
          100: '#d6ecd6',
          200: '#aed9ae',
          300: '#7fc17f',
          400: '#54a854',
          500: '#3a8d3a',
          600: '#2c6f2c',
          700: '#245824',
          800: '#1f461f',
          900: '#1a3a1a',
        },
      },
    },
  },
  plugins: [],
}
