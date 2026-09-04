import { defineComponent, computed, ref } from 'vue'
import { ErrorBanner, NuxtLink } from '#components'
import { btnPrimaryClass, inputClass, labelClass } from '~/utils/ui'

export default defineComponent({
  name: 'ResetPasswordPage',
  setup() {
    definePageMeta({ middleware: 'guest' })

    const { fetch: refreshSession } = useUserSession()
    const route = useRoute()
    const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''))

    const password = ref('')
    const confirm = ref('')
    const error = ref<string | null>(token.value ? null : 'Немає токена в посиланні')
    const loading = ref(false)

    async function onSubmit(e: Event) {
      e.preventDefault()
      error.value = null
      if (password.value !== confirm.value) {
        error.value = 'Паролі не збігаються'
        return
      }
      loading.value = true
      try {
        await $fetch('/api/auth/reset-password', {
          method: 'POST',
          body: { token: token.value, password: password.value },
        })
        await refreshSession()
        await navigateTo('/')
      } catch (err: unknown) {
        error.value = extractErrorMessage(err) ?? 'Не вдалося змінити пароль'
      } finally {
        loading.value = false
      }
    }

    return () => (
      <section class="mx-auto max-w-md">
        <div class="rounded-2xl bg-card p-8 shadow-card">
          <h1 class="text-2xl font-bold text-gray-900">Новий пароль</h1>
          <p class="mt-1 text-sm text-gray-600">Придумайте пароль щонайменше з 8 символів.</p>

          {error.value && (
            <div class="mt-4">
              <ErrorBanner message={error.value} />
            </div>
          )}

          <form class="mt-6 space-y-4" onSubmit={onSubmit}>
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
              />
            </div>
            <div>
              <label class={labelClass} for="confirm">
                Підтвердження
              </label>
              <input
                id="confirm"
                v-model={confirm.value}
                type="password"
                required
                minlength={8}
                autocomplete="new-password"
                class={inputClass}
              />
            </div>
            <button
              type="submit"
              disabled={loading.value || !token.value}
              class={`${btnPrimaryClass} w-full`}
            >
              {loading.value ? 'Зберігаємо…' : 'Зберегти пароль'}
            </button>
          </form>

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
