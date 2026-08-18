import { defineComponent, ref } from 'vue'
import { NuxtLink } from '#components'

export default defineComponent({
  name: 'DefaultLayout',
  setup(_, { slots }) {
    const { loggedIn, user, clear } = useUserSession()
    const loggingOut = ref(false)

    async function onLogout() {
      loggingOut.value = true
      try {
        await $fetch('/api/auth/logout', { method: 'POST' })
        await clear()
        await navigateTo('/login')
      } finally {
        loggingOut.value = false
      }
    }

    return () => (
      <div class="min-h-screen flex flex-col">
        <header class="border-b border-gray-200 bg-white">
          <div class="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
            <NuxtLink to="/" class="text-lg font-semibold text-brand-600">
              Лічильник калорій
            </NuxtLink>

            <nav class="flex items-center gap-3 text-sm">
              {loggedIn.value ? (
                <>
                  <NuxtLink
                    to="/diary"
                    class="font-medium text-gray-700 hover:text-brand-600"
                    activeClass="text-brand-600"
                  >
                    Щоденник
                  </NuxtLink>
                  <NuxtLink
                    to="/stats"
                    class="font-medium text-gray-700 hover:text-brand-600"
                    activeClass="text-brand-600"
                  >
                    Статистика
                  </NuxtLink>
                  <NuxtLink
                    to="/profile"
                    class="font-medium text-gray-700 hover:text-brand-600"
                    activeClass="text-brand-600"
                  >
                    Профіль
                  </NuxtLink>
                  <NuxtLink
                    to="/settings/ai-keys"
                    class="font-medium text-gray-700 hover:text-brand-600"
                    activeClass="text-brand-600"
                  >
                    Налаштування
                  </NuxtLink>
                  <span class="hidden text-gray-500 sm:inline">{user.value?.email}</span>
                  <button
                    type="button"
                    onClick={onLogout}
                    disabled={loggingOut.value}
                    class="rounded-lg border border-gray-300 px-3 py-1.5 font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
                  >
                    {loggingOut.value ? 'Виходимо…' : 'Вийти'}
                  </button>
                </>
              ) : (
                <>
                  <NuxtLink to="/login" class="font-medium text-gray-700 hover:text-brand-600">
                    Вхід
                  </NuxtLink>
                  <NuxtLink
                    to="/register"
                    class="rounded-lg bg-brand-600 px-3 py-1.5 font-medium text-white transition hover:bg-brand-700"
                  >
                    Реєстрація
                  </NuxtLink>
                </>
              )}
            </nav>
          </div>
        </header>

        <main class="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
          {slots.default?.()}
        </main>

        <footer class="border-t border-gray-200 bg-white">
          <div class="mx-auto max-w-3xl px-4 py-4 text-center text-sm text-gray-500">
            © {new Date().getFullYear()} Лічильник калорій
          </div>
        </footer>
      </div>
    )
  },
})
