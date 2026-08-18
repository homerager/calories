import type { Config } from 'tailwindcss'

export default <Partial<Config>>{
  content: [
    './app/components/**/*.{vue,tsx,ts}',
    './app/layouts/**/*.{vue,tsx,ts}',
    './app/pages/**/*.{vue,tsx,ts}',
    './app/composables/**/*.ts',
    './app/plugins/**/*.ts',
    './app/app.vue',
    './app/error.vue',
  ],
  theme: {
    extend: {
      colors: {
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
