import { defineComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { NuxtLink } from '#components'
import { useNotifications } from '~/composables/useNotifications'

export default defineComponent({
  name: 'DefaultLayout',
  setup(_, { slots }) {
    const { loggedIn, user, clear } = useUserSession()
    const route = useRoute()
    const loggingOut = ref(false)
    const menuOpen = ref(false)
    const mobileOpen = ref(false)
    const menuRef = ref<HTMLElement | null>(null)
    const notifOpen = ref(false)
    const notifRef = ref<HTMLElement | null>(null)
    const { notifications, unreadCount, markAllRead, markRead } = useNotifications()

    function toggleMenu() {
      menuOpen.value = !menuOpen.value
    }

    function closeMenu() {
      menuOpen.value = false
    }

    function toggleNotif() {
      notifOpen.value = !notifOpen.value
    }

    function closeNotif() {
      notifOpen.value = false
    }

    function toggleMobile() {
      mobileOpen.value = !mobileOpen.value
    }

    function closeMobile() {
      mobileOpen.value = false
    }

    function onDocumentClick(event: MouseEvent) {
      if (menuRef.value && !menuRef.value.contains(event.target as Node)) {
        closeMenu()
      }
      if (notifRef.value && !notifRef.value.contains(event.target as Node)) {
        closeNotif()
      }
    }

    function formatNotifTime(iso: string): string {
      return new Date(iso).toLocaleString('uk-UA', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    }

    onMounted(() => document.addEventListener('click', onDocumentClick))
    onBeforeUnmount(() => document.removeEventListener('click', onDocumentClick))

    // Close the mobile menu whenever the route changes.
    watch(() => route.fullPath, closeMobile)

    async function onLogout() {
      loggingOut.value = true
      try {
        await $fetch('/api/auth/logout', { method: 'POST' })
        await clear()
        closeMenu()
        closeMobile()
        await navigateTo('/login')
      } finally {
        loggingOut.value = false
      }
    }

    function initials(email?: string) {
      return (email?.trim().charAt(0) || '?').toUpperCase()
    }

    const desktopLinkClass = 'font-medium text-gray-700 hover:text-brand-600'
    const mobileLinkClass =
      'block rounded-lg px-3 py-2 font-medium text-gray-700 transition hover:bg-gray-50'

    const navLinks = [
      { to: '/diary', label: 'Щоденник' },
      { to: '/menu', label: 'Меню' },
      { to: '/exercise', label: 'Активність' },
      { to: '/stats', label: 'Статистика' },
      { to: '/settings', label: 'Налаштування' },
    ]

    return () => (
      <div class="min-h-screen flex flex-col">
        <header class="border-b border-gray-200 bg-white">
          <div class="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
            <NuxtLink to="/" class="text-lg font-semibold text-brand-600">
              Calories
            </NuxtLink>

            {loggedIn.value ? (
              <>
                {/* Desktop navigation */}
                <nav class="hidden items-center gap-3 text-sm md:flex">
                  {navLinks.map((link) => (
                    <NuxtLink
                      key={link.to}
                      to={link.to}
                      class={desktopLinkClass}
                      activeClass="text-brand-600"
                    >
                      {link.label}
                    </NuxtLink>
                  ))}

                  <div class="relative" ref={notifRef}>
                    <button
                      type="button"
                      onClick={toggleNotif}
                      class="relative flex h-9 w-9 items-center justify-center rounded-full text-gray-600 transition hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-300"
                      aria-haspopup="menu"
                      aria-expanded={notifOpen.value}
                      title="Сповіщення"
                    >
                      <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                      </svg>
                      {unreadCount.value > 0 && (
                        <span class="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                          {unreadCount.value > 9 ? '9+' : unreadCount.value}
                        </span>
                      )}
                    </button>

                    {notifOpen.value ? (
                      <div class="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
                        <div class="flex items-center justify-between border-b border-gray-100 px-4 py-2">
                          <p class="text-sm font-medium text-gray-800">Сповіщення</p>
                          {unreadCount.value > 0 && (
                            <button
                              type="button"
                              onClick={markAllRead}
                              class="text-xs font-medium text-brand-600 hover:text-brand-700"
                            >
                              Прочитати всі
                            </button>
                          )}
                        </div>
                        <div class="max-h-80 overflow-y-auto">
                          {notifications.value.length === 0 ? (
                            <p class="px-4 py-3 text-sm text-gray-500">Немає сповіщень</p>
                          ) : (
                            notifications.value.map((n) => (
                              <button
                                type="button"
                                key={n.id}
                                onClick={() => (!n.readAt ? markRead(n.id) : undefined)}
                                class={
                                  'block w-full px-4 py-2 text-left text-sm transition hover:bg-gray-50 ' +
                                  (n.readAt ? 'text-gray-500' : 'font-medium text-gray-800')
                                }
                              >
                                <span class="block truncate">{n.title}</span>
                                {n.body && <span class="block truncate text-xs text-gray-500">{n.body}</span>}
                                <span class="block text-[11px] text-gray-400">{formatNotifTime(n.createdAt)}</span>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>

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
                </nav>

                {/* Mobile burger button */}
                <button
                  type="button"
                  onClick={toggleMobile}
                  class="inline-flex h-10 w-10 items-center justify-center rounded-lg text-gray-700 transition hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-300 md:hidden"
                  aria-label="Меню"
                  aria-haspopup="menu"
                  aria-expanded={mobileOpen.value}
                >
                  {mobileOpen.value ? (
                    <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  ) : (
                    <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  )}
                </button>
              </>
            ) : (
              <nav class="flex items-center gap-3 text-sm">
                <NuxtLink to="/login" class={desktopLinkClass}>
                  Вхід
                </NuxtLink>
                <NuxtLink
                  to="/register"
                  class="rounded-lg bg-brand-600 px-3 py-1.5 font-medium text-white transition hover:bg-brand-700"
                >
                  Реєстрація
                </NuxtLink>
              </nav>
            )}
          </div>

          {/* Mobile menu panel */}
          {loggedIn.value && mobileOpen.value ? (
            <nav class="border-t border-gray-100 bg-white px-4 py-3 text-sm md:hidden">
              <div class="space-y-1">
                {navLinks.map((link) => (
                  <NuxtLink
                    key={link.to}
                    to={link.to}
                    class={mobileLinkClass}
                    activeClass="bg-brand-50 text-brand-600"
                    onClick={closeMobile}
                  >
                    {link.label}
                  </NuxtLink>
                ))}
              </div>

              <div class="mt-3 border-t border-gray-100 pt-3">
                <div class="flex items-center gap-3 px-3 py-2">
                  <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">
                    {initials(user.value?.email)}
                  </span>
                  <div class="min-w-0">
                    <p class="text-xs text-gray-500">Ви увійшли як</p>
                    <p class="truncate text-sm font-medium text-gray-800">
                      {user.value?.email}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onLogout}
                  disabled={loggingOut.value}
                  class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-center font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
                >
                  {loggingOut.value ? 'Виходимо…' : 'Вийти'}
                </button>
              </div>
            </nav>
          ) : null}
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
