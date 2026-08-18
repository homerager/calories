import { defineComponent, computed, ref } from 'vue'
import { NuxtLink, OAuthButtons } from '#components'

export default defineComponent({
  name: 'RegisterPage',
  setup() {
    definePageMeta({ middleware: 'guest' })

    const { fetch: refreshSession } = useUserSession()

    const email = ref('')
    const password = ref('')
    const confirm = ref('')
    const error = ref<string | null>(null)
    const loading = ref(false)

    const passwordMismatch = computed(
      () => confirm.value.length > 0 && password.value !== confirm.value,
    )

    async function onSubmit(e: Event) {
      e.preventDefault()
      error.value = null

      if (password.value !== confirm.value) {
        error.value = 'Паролі не збігаються'
        return
      }

      loading.value = true
      try {
        await $fetch('/api/auth/register', {
          method: 'POST',
          body: { email: email.value, password: password.value },
        })
        await refreshSession()
        await navigateTo('/')
      } catch (err: unknown) {
        error.value = extractErrorMessage(err) ?? 'Не вдалося зареєструватися'
      } finally {
        loading.value = false
      }
    }

    return () => (
      <section class="mx-auto max-w-md">
        <div class="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-100">
          <h1 class="text-2xl font-bold text-gray-900">Реєстрація</h1>
          <p class="mt-1 text-sm text-gray-500">Створіть акаунт, щоб почати вести щоденник.</p>

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
                minlength={8}
                autocomplete="new-password"
                class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                placeholder="Мінімум 8 символів"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700" for="confirm">
                Підтвердіть пароль
              </label>
              <input
                id="confirm"
                v-model={confirm.value}
                type="password"
                required
                autocomplete="new-password"
                class={[
                  'mt-1 w-full rounded-lg border px-3 py-2 text-gray-900 outline-none focus:ring-2 focus:ring-brand-200',
                  passwordMismatch.value
                    ? 'border-red-300 focus:border-red-400'
                    : 'border-gray-300 focus:border-brand-500',
                ]}
                placeholder="Повторіть пароль"
              />
              {passwordMismatch.value && (
                <p class="mt-1 text-xs text-red-600">Паролі не збігаються</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading.value}
              class="w-full rounded-lg bg-brand-600 px-4 py-2 font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading.value ? 'Створюємо…' : 'Зареєструватися'}
            </button>
          </form>

          <OAuthButtons />

          <p class="mt-6 text-center text-sm text-gray-600">
            Вже маєте акаунт?{' '}
            <NuxtLink to="/login" class="font-medium text-brand-600 hover:text-brand-700">
              Увійти
            </NuxtLink>
          </p>
        </div>
      </section>
    )
  },
})
