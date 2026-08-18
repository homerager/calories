import { defineComponent, onBeforeUnmount, onMounted, ref } from 'vue'
import { NuxtLink } from '#components'

export default defineComponent({
  name: 'DefaultLayout',
  setup(_, { slots }) {
    const { loggedIn, user, clear } = useUserSession()
    const loggingOut = ref(false)
    const menuOpen = ref(false)
    const menuRef = ref<HTMLElement | null>(null)

    function toggleMenu() {
      menuOpen.value = !menuOpen.value
    }

    function closeMenu() {
      menuOpen.value = false
    }

    function onDocumentClick(event: MouseEvent) {
      if (menuRef.value && !menuRef.value.contains(event.target as Node)) {
        closeMenu()
      }
    }

    onMounted(() => document.addEventListener('click', onDocumentClick))
    onBeforeUnmount(() => document.removeEventListener('click', onDocumentClick))

    async function onLogout() {
      loggingOut.value = true
      try {
        await $fetch('/api/auth/logout', { method: 'POST' })
        await clear()
        closeMenu()
        await navigateTo('/login')
      } finally {
        loggingOut.value = false
      }
    }

    function initials(email?: string) {
      return (email?.trim().charAt(0) || '?').toUpperCase()
    }

    return () => (
      <div class="min-h-screen flex flex-col">
        <header class="border-b border-gray-200 bg-white">
          <div class="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
            <NuxtLink to="/" class="text-lg font-semibold text-brand-600">
              Calories
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

                  <div class="relative" ref={menuRef}>
                    <button
                      type="button"
                      onClick={toggleMenu}
                      class="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-300"
                      aria-haspopup="menu"
                      aria-expanded={menuOpen.value}
                      title={user.value?.email}
                    >
                      {initials(user.value?.email)}
                    </button>

                    {menuOpen.value ? (
                      <div class="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
                        <div class="border-b border-gray-100 px-4 py-2">
                          <p class="text-xs text-gray-500">Ви увійшли як</p>
                          <p class="truncate text-sm font-medium text-gray-800">
                            {user.value?.email}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={onLogout}
                          disabled={loggingOut.value}
                          class="block w-full px-4 py-2 text-left text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
                        >
                          {loggingOut.value ? 'Виходимо…' : 'Вийти'}
                        </button>
                      </div>
                    ) : null}
                  </div>
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
            © {new Date().getFullYear()} Calories
          </div>
        </footer>
      </div>
    )
  },
})
