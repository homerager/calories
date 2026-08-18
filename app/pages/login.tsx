import { defineComponent, ref } from 'vue'
import { NuxtLink, OAuthButtons } from '#components'

export default defineComponent({
  name: 'LoginPage',
  setup() {
    definePageMeta({ middleware: 'guest' })

    const { fetch: refreshSession } = useUserSession()
    const route = useRoute()

    const email = ref('')
    const password = ref('')
    const error = ref<string | null>(
      route.query.error === 'oauth' ? 'Не вдалося увійти через провайдера. Спробуйте ще раз.' : null,
    )
    const loading = ref(false)

    async function onSubmit(e: Event) {
      e.preventDefault()
      error.value = null
      loading.value = true
      try {
        await $fetch('/api/auth/login', {
          method: 'POST',
          body: { email: email.value, password: password.value },
        })
        await refreshSession()
        const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
        await navigateTo(redirect)
      } catch (err: unknown) {
        error.value = extractErrorMessage(err) ?? 'Не вдалося увійти'
      } finally {
        loading.value = false
      }
    }

    return () => (
      <section class="mx-auto max-w-md">
        <div class="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-100">
          <h1 class="text-2xl font-bold text-gray-900">Вхід</h1>
          <p class="mt-1 text-sm text-gray-500">Раді бачити вас знову.</p>

          {error.value && (
            <div class="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-100">
              {error.value}
            </div>
          )}

          <form class="mt-6 space-y-4" onSubmit={onSubmit}>
            <div>
              <label class="block text-sm font-medium text-gray-700" for="email">
                Email
              </label>
              <input
                id="email"
                v-model={email.value}
                type="email"
                required
                autocomplete="email"
                class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700" for="password">
                Пароль
              </label>
              <input
                id="password"
                v-model={password.value}
                type="password"
                required
                autocomplete="current-password"
                class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading.value}
              class="w-full rounded-lg bg-brand-600 px-4 py-2 font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading.value ? 'Входимо…' : 'Увійти'}
            </button>
          </form>

          <OAuthButtons />

          <p class="mt-6 text-center text-sm text-gray-600">
            Немає акаунта?{' '}
            <NuxtLink to="/register" class="font-medium text-brand-600 hover:text-brand-700">
              Зареєструватися
            </NuxtLink>
          </p>
        </div>
      </section>
    )
  },
})
