import { defineComponent, computed, ref } from 'vue'
import { ErrorBanner, NuxtLink, OAuthButtons } from '#components'
import { btnPrimaryClass, inputClass, labelClass } from '~/utils/ui'

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
        await navigateTo('/onboarding')
      } catch (err: unknown) {
        error.value = extractErrorMessage(err) ?? 'Не вдалося зареєструватися'
      } finally {
        loading.value = false
      }
    }

    return () => (
      <section class="mx-auto max-w-md">
        <div class="rounded-2xl bg-card p-8 shadow-card">
          <h1 class="text-2xl font-bold text-gray-900">Реєстрація</h1>
          <p class="mt-1 text-sm text-gray-600">Створіть акаунт, щоб почати вести щоденник.</p>

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
                minlength={8}
                autocomplete="new-password"
                class={inputClass}
                placeholder="Мінімум 8 символів"
              />
            </div>

            <div>
              <label class={labelClass} for="confirm">
                Підтвердіть пароль
              </label>
              <input
                id="confirm"
                v-model={confirm.value}
                type="password"
                required
                autocomplete="new-password"
                aria-invalid={passwordMismatch.value}
                aria-describedby={passwordMismatch.value ? 'confirm-error' : undefined}
                class={[
                  inputClass,
                  passwordMismatch.value ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : '',
                ]}
                placeholder="Повторіть пароль"
              />
              {passwordMismatch.value && (
                <p id="confirm-error" class="mt-1 text-xs text-red-700">
                  Паролі не збігаються
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading.value}
              aria-busy={loading.value}
              class={`${btnPrimaryClass} w-full`}
            >
              {loading.value ? 'Створюємо…' : 'Зареєструватися'}
            </button>
          </form>

          <p class="mt-3 text-center text-xs text-gray-500">
            Реєструючись, ви погоджуєтесь із{' '}
            <NuxtLink to="/privacy" class="font-medium text-brand-700 hover:text-brand-800">
              політикою конфіденційності
            </NuxtLink>
            .
          </p>

          <OAuthButtons />

          <p class="mt-6 text-center text-sm text-gray-700">
            Вже маєте акаунт?{' '}
            <NuxtLink to="/login" class="font-medium text-brand-700 hover:text-brand-800">
              Увійти
            </NuxtLink>
          </p>
        </div>
      </section>
    )
  },
})
