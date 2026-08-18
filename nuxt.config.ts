// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-08-01',
  devtools: { enabled: true },

  // Проєкт завжди стартує на порту 3001 (dev-сервер).
  devServer: {
    port: 3001,
  },

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
      title: 'Calories',
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
      cookie: {
        sameSite: 'lax',
        // За замовчуванням Secure (потрібен HTTPS). На HTTP-сервері тимчасово
        // вимикається через NUXT_SESSION_COOKIE_SECURE=false, інакше браузер
        // не збереже cookie сесії і вхід «не запам'ятовується».
        secure: process.env.NUXT_SESSION_COOKIE_SECURE !== 'false',
      },
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
    // AI-шар: сервісні (fallback) ключі, моделі, провайдер за замовчуванням, квота.
    ai: {
      openaiApiKey: process.env.NUXT_AI_OPENAI_API_KEY,
      anthropicApiKey: process.env.NUXT_AI_ANTHROPIC_API_KEY,
      geminiApiKey: process.env.NUXT_AI_GEMINI_API_KEY,
      openaiModel: process.env.NUXT_AI_OPENAI_MODEL,
      anthropicModel: process.env.NUXT_AI_ANTHROPIC_MODEL,
      geminiModel: process.env.NUXT_AI_GEMINI_MODEL,
      defaultProvider: process.env.NUXT_AI_DEFAULT_PROVIDER,
      freeQuotaLimit: process.env.NUXT_AI_FREE_QUOTA_LIMIT,
      freeQuotaPeriodDays: process.env.NUXT_AI_FREE_QUOTA_PERIOD_DAYS,
    },
    // Public keys exposed to the client
    public: {},
  },

  typescript: {
    strict: true,
    typeCheck: false,
  },
})
