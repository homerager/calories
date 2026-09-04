import { defineComponent, ref } from 'vue'
import { ErrorBanner, NuxtLink } from '#components'
import { btnPrimaryClass, inputClass, labelClass } from '~/utils/ui'

export default defineComponent({
  name: 'ForgotPasswordPage',
  setup() {
    definePageMeta({ middleware: 'guest' })

    const email = ref('')
    const error = ref<string | null>(null)
    const done = ref(false)
    const loading = ref(false)

    async function onSubmit(e: Event) {
      e.preventDefault()
      error.value = null
      loading.value = true
      try {
        await $fetch('/api/auth/forgot-password', {
          method: 'POST',
          body: { email: email.value },
        })
        done.value = true
      } catch (err: unknown) {
        error.value = extractErrorMessage(err) ?? 'Не вдалося надіслати лист'
      } finally {
        loading.value = false
      }
    }

    return () => (
      <section class="mx-auto max-w-md">
        <div class="rounded-2xl bg-card p-8 shadow-card">
          <h1 class="text-2xl font-bold text-gray-900">Скидання пароля</h1>
          <p class="mt-1 text-sm text-gray-600">
            Вкажіть email — якщо акаунт існує, надішлемо посилання (дійсне 1 годину).
          </p>

          {error.value && (
            <div class="mt-4">
              <ErrorBanner message={error.value} />
            </div>
          )}

          {done.value ? (
            <p class="mt-6 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-900">
              Якщо цей email зареєстровано з паролем, лист уже в дорозі. Перевірте також папку «Спам».
            </p>
          ) : (
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
                />
              </div>
              <button
                type="submit"
                disabled={loading.value}
                class={`${btnPrimaryClass} w-full`}
              >
                {loading.value ? 'Надсилаємо…' : 'Надіслати посилання'}
              </button>
            </form>
          )}

          <p class="mt-6 text-center text-sm text-gray-700">
            <NuxtLink to="/login" class="font-medium text-brand-700 hover:text-brand-800">
              Назад до входу
            </NuxtLink>
          </p>
        </div>
      </section>
    )
  },
})
