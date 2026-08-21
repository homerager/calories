import { defineComponent } from 'vue'

// Кнопки OAuth-входу. Ведуть на серверні роути nuxt-auth-utils,
// які виконують повний редирект до провайдера (тому це звичайні посилання).
export default defineComponent({
  name: 'OAuthButtons',
  setup() {
    return () => (
      <div class="mt-6">
        <div class="relative">
          <div class="absolute inset-0 flex items-center">
            <div class="w-full border-t border-gray-200" />
          </div>
          <div class="relative flex justify-center text-xs">
            <span class="bg-white px-2 text-gray-400">або</span>
          </div>
        </div>

        <div class="mt-4 grid gap-3">
          <a
            href="/auth/google"
            class="flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-800 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-300"
          >
            <svg class="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.4 14.6 2.4 12 2.4 6.9 2.4 2.8 6.5 2.8 11.6S6.9 20.8 12 20.8c5.9 0 9.8-4.1 9.8-9.9 0-.7-.1-1.2-.2-1.7H12z" />
            </svg>
            Продовжити з Google
          </a>

          <a
            href="/auth/github"
            class="flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-800 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-300"
          >
            <svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49 0-.24-.01-.87-.01-1.71-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.49-1.11-1.49-.9-.63.07-.62.07-.62 1 .07 1.53 1.05 1.53 1.05.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.7 0 0 .84-.28 2.75 1.05a9.36 9.36 0 0 1 5 0c1.91-1.33 2.75-1.05 2.75-1.05.55 1.4.2 2.44.1 2.7.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.81-4.57 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.48-.01 2.82 0 .27.18.6.69.49A10.26 10.26 0 0 0 22 12.25C22 6.58 17.52 2 12 2z" />
            </svg>
            Продовжити з GitHub
          </a>
        </div>
      </div>
    )
  },
})
