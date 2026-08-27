import { defineComponent, ref } from 'vue'
import { ErrorBanner, NuxtLink, OAuthButtons } from '#components'
import { btnPrimaryClass, inputClass, labelClass } from '~/utils/ui'

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
          <p class="mt-1 text-sm text-gray-600">Раді бачити вас знову.</p>

          {error.value && (
            <div class="mt-4">
              <ErrorBanner message={error.value} />
            </div>
          )}

          <form class="mt-6 space-y-4" onSubmit={onSubmit}>
            <div>
              <label class={labelClass} for="email">
                Email
              </label>
              <input
                id="email"
                v-model={email.value}
                type="email"
                required
                autocomplete="email"
                class={inputClass}
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label class={labelClass} for="password">
                Пароль
              </label>
              <input
                id="password"
                v-model={password.value}
                type="password"
                required
                autocomplete="current-password"
                class={inputClass}
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading.value}
              aria-busy={loading.value}
              class={`${btnPrimaryClass} w-full`}
            >
              {loading.value ? 'Входимо…' : 'Увійти'}
            </button>
          </form>

          <p class="mt-3 text-center text-sm">
            <NuxtLink to="/forgot-password" class="font-medium text-brand-700 hover:text-brand-800">
              Забули пароль?
            </NuxtLink>
          </p>

          <OAuthButtons />

          <p class="mt-6 text-center text-sm text-gray-700">
            Немає акаунта?{' '}
            <NuxtLink to="/register" class="font-medium text-brand-700 hover:text-brand-800">
              Зареєструватися
            </NuxtLink>
          </p>
        </div>
      </section>
    )
  },
})
