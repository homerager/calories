import { defineComponent, ref } from 'vue'
import { ErrorBanner } from '#components'
import { useToast } from '~/composables/useToast'
import { btnDangerClass, btnPrimaryClass, inputClass, labelClass } from '~/utils/ui'

export default defineComponent({
  name: 'AccountSettingsPage',
  setup() {
    definePageMeta({ middleware: 'auth' })

    const { clear } = useUserSession()
    const toast = useToast()

    const currentPassword = ref('')
    const newPassword = ref('')
    const confirmPassword = ref('')
    const pwdError = ref<string | null>(null)
    const pwdSaving = ref(false)

    const deletePassword = ref('')
    const deleteConfirm = ref('')
    const delError = ref<string | null>(null)
    const deleting = ref(false)

    async function onChangePassword(e: Event) {
      e.preventDefault()
      pwdError.value = null
      if (newPassword.value !== confirmPassword.value) {
        pwdError.value = 'Нові паролі не збігаються'
        return
      }
      pwdSaving.value = true
      try {
        await $fetch('/api/auth/change-password', {
          method: 'POST',
          body: {
            currentPassword: currentPassword.value || undefined,
            newPassword: newPassword.value,
          },
        })
        currentPassword.value = ''
        newPassword.value = ''
        confirmPassword.value = ''
        toast.success('Пароль оновлено')
      } catch (err: unknown) {
        pwdError.value = extractErrorMessage(err) ?? 'Не вдалося змінити пароль'
      } finally {
        pwdSaving.value = false
      }
    }

    async function onDeleteAccount(e: Event) {
      e.preventDefault()
      delError.value = null
      deleting.value = true
      try {
        await $fetch('/api/auth/delete-account', {
          method: 'POST',
          body: {
            confirm: deleteConfirm.value,
            password: deletePassword.value || undefined,
          },
        })
        await clear()
        await navigateTo('/login')
      } catch (err: unknown) {
        delError.value = extractErrorMessage(err) ?? 'Не вдалося видалити акаунт'
      } finally {
        deleting.value = false
      }
    }

    return () => (
      <section class="space-y-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Акаунт</h1>
          <p class="mt-1 text-sm text-gray-500">Зміна пароля та видалення даних.</p>
        </div>

        <div class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
          <h2 class="text-lg font-semibold text-gray-900">Пароль</h2>
          {pwdError.value && (
            <div class="mt-3">
              <ErrorBanner message={pwdError.value} />
            </div>
          )}
          <form class="mt-4 max-w-md space-y-3" onSubmit={onChangePassword}>
            <div>
              <label class={labelClass} for="currentPassword">
                Поточний пароль
              </label>
              <input
                id="currentPassword"
                v-model={currentPassword.value}
                type="password"
                autocomplete="current-password"
                class={inputClass}
              />
              <p class="mt-1 text-xs text-gray-400">Порожньо, якщо входили лише через Google/GitHub.</p>
            </div>
            <div>
              <label class={labelClass} for="newPassword">
                Новий пароль
              </label>
              <input
                id="newPassword"
                v-model={newPassword.value}
                type="password"
                required
                minlength={8}
                autocomplete="new-password"
                class={inputClass}
              />
            </div>
            <div>
              <label class={labelClass} for="confirmPassword">
                Підтвердження
              </label>
              <input
                id="confirmPassword"
                v-model={confirmPassword.value}
                type="password"
                required
                minlength={8}
                autocomplete="new-password"
                class={inputClass}
              />
            </div>
            <button type="submit" disabled={pwdSaving.value} class={btnPrimaryClass}>
              {pwdSaving.value ? 'Зберігаємо…' : 'Змінити пароль'}
            </button>
          </form>
        </div>

        <div class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-red-100">
          <h2 class="text-lg font-semibold text-red-800">Видалити акаунт</h2>
          <p class="mt-1 text-sm text-gray-600">
            Буде стерто щоденник, профіль, меню та ключі AI. Цю дію не можна скасувати.
          </p>
          {delError.value && (
            <div class="mt-3">
              <ErrorBanner message={delError.value} />
            </div>
          )}
          <form class="mt-4 max-w-md space-y-3" onSubmit={onDeleteAccount}>
            <div>
              <label class={labelClass} for="deletePassword">
                Пароль
              </label>
              <input
                id="deletePassword"
                v-model={deletePassword.value}
                type="password"
                autocomplete="current-password"
                class={inputClass}
              />
            </div>
            <div>
              <label class={labelClass} for="deleteConfirm">
                Введіть DELETE
              </label>
              <input
                id="deleteConfirm"
                v-model={deleteConfirm.value}
                type="text"
                required
                class={inputClass}
                placeholder="DELETE"
              />
            </div>
            <button type="submit" disabled={deleting.value} class={btnDangerClass}>
              {deleting.value ? 'Видаляємо…' : 'Видалити акаунт назавжди'}
            </button>
          </form>
        </div>
      </section>
    )
  },
})
