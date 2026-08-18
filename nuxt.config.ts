// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-08-01',
  devtools: { enabled: true },

  modules: ['@nuxtjs/tailwindcss', '@nuxt/eslint', 'nuxt-auth-utils'],

  tailwindcss: {
    cssPath: '~/assets/css/tailwind.css',
    configPath: '~/tailwind.config.ts',
  },

  // TSX / JSX support via @vitejs/plugin-vue-jsx (bundled with Nuxt's Vite builder)
  vite: {
    vueJsx: {
      // options forwarded to @vitejs/plugin-vue-jsx
    },
  },

  app: {
    head: {
      htmlAttrs: { lang: 'uk' },
      title: 'Лічильник калорій',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Веб-додаток для підрахунку калорій' },
      ],
    },
  },

  runtimeConfig: {
    // Server-only secrets (override via NUXT_* env vars)
    encryptionKey: process.env.ENCRYPTION_KEY,
    databaseUrl: process.env.DATABASE_URL,
    session: {
      password: process.env.NUXT_SESSION_PASSWORD ?? '',
    },
    oauth: {
      google: {
        clientId: process.env.NUXT_OAUTH_GOOGLE_CLIENT_ID,
        clientSecret: process.env.NUXT_OAUTH_GOOGLE_CLIENT_SECRET,
      },
      github: {
        clientId: process.env.NUXT_OAUTH_GITHUB_CLIENT_ID,
        clientSecret: process.env.NUXT_OAUTH_GITHUB_CLIENT_SECRET,
      },
    },
    // Public keys exposed to the client
    public: {},
  },

  typescript: {
    strict: true,
    typeCheck: false,
  },
})
