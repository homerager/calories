import { defineComponent, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { AppToasts, NuxtLink, PwaPrompt } from '#components'
import { useNotifications } from '~/composables/useNotifications'
import { btnSecondaryClass } from '~/utils/ui'

export default defineComponent({
  name: 'DefaultLayout',
  setup(_, { slots }) {
    const { loggedIn, user, clear } = useUserSession()
    const route = useRoute()
    const loggingOut = ref(false)
    const menuOpen = ref(false)
    const mobileOpen = ref(false)
    const menuRef = ref<HTMLElement | null>(null)
    const menuButtonRef = ref<HTMLButtonElement | null>(null)
    const notifOpen = ref(false)
    const notifRef = ref<HTMLElement | null>(null)
    const notifButtonRef = ref<HTMLButtonElement | null>(null)
    const burgerRef = ref<HTMLButtonElement | null>(null)
    const { notifications, unreadCount, markAllRead, markRead } = useNotifications()

    function toggleMenu() {
      menuOpen.value = !menuOpen.value
      if (menuOpen.value) notifOpen.value = false
    }

    function closeMenu() {
      menuOpen.value = false
    }

    function toggleNotif() {
      notifOpen.value = !notifOpen.value
      if (notifOpen.value) menuOpen.value = false
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

    function onDocumentKeydown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      if (menuOpen.value) {
        closeMenu()
        menuButtonRef.value?.focus()
      }
      if (notifOpen.value) {
        closeNotif()
        notifButtonRef.value?.focus()
      }
      if (mobileOpen.value) {
        closeMobile()
        burgerRef.value?.focus()
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

    onMounted(() => {
      document.addEventListener('click', onDocumentClick)
      document.addEventListener('keydown', onDocumentKeydown)
    })
    onBeforeUnmount(() => {
      document.removeEventListener('click', onDocumentClick)
      document.removeEventListener('keydown', onDocumentKeydown)
    })

    watch(() => route.fullPath, closeMobile)

    watch(mobileOpen, async (open) => {
      if (!open) return
      await nextTick()
      const first = document.getElementById('mobile-nav')?.querySelector<HTMLElement>('a, button')
      first?.focus()
    })

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

    const desktopLinkClass = 'font-medium text-gray-700 hover:text-brand-700 focus:outline-none focus:underline'
    const mobileLinkClass =
      'block rounded-lg px-3 py-2 font-medium text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-300'

    const navLinks = [
      { to: '/diary', label: 'Щоденник' },
      { to: '/menu', label: 'Меню' },
      { to: '/exercise', label: 'Активність' },
      //{ to: '/water', label: 'Вода' },
      { to: '/stats', label: 'Статистика' },
      { to: '/settings', label: 'Налаштування' },
    ]

    return () => (
      <div class="min-h-screen flex flex-col">
        <a href="#main-content" class="skip-link">
          Перейти до вмісту
        </a>

        <header class="border-b border-gray-200 bg-white">
          <div class="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
            <NuxtLink to="/" class="text-lg font-semibold text-brand-700">
              Calories
            </NuxtLink>

            {loggedIn.value ? (
              <>
                <nav class="hidden items-center gap-3 text-sm md:flex" aria-label="Основна навігація">
                  {navLinks.map((link) => (
                    <NuxtLink
                      key={link.to}
                      to={link.to}
                      class={desktopLinkClass}
                      activeClass="text-brand-700"
                    >
                      {link.label}
                    </NuxtLink>
                  ))}

                  <div class="relative" ref={notifRef}>
                    <button
                      ref={notifButtonRef}
                      type="button"
                      onClick={toggleNotif}
                      class="relative flex h-9 w-9 items-center justify-center rounded-full text-gray-700 transition hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-300"
                      aria-haspopup="menu"
                      aria-expanded={notifOpen.value}
                      aria-controls="notif-menu"
                      aria-label={
                        unreadCount.value > 0
                          ? `Сповіщення, непрочитаних: ${unreadCount.value}`
                          : 'Сповіщення'
                      }
                    >
                      <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                      </svg>
                      {unreadCount.value > 0 && (
                        <span class="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-700 px-1 text-[10px] font-semibold text-white" aria-hidden="true">
                          {unreadCount.value > 9 ? '9+' : unreadCount.value}
                        </span>
                      )}
                    </button>

                    {notifOpen.value ? (
                      <div
                        id="notif-menu"
                        role="menu"
                        aria-label="Сповіщення"
                        class="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
                      >
                        <div class="flex items-center justify-between border-b border-gray-100 px-4 py-2">
                          <p class="text-sm font-medium text-gray-800">Сповіщення</p>
                          {unreadCount.value > 0 && (
                            <button
                              type="button"
                              role="menuitem"
                              onClick={markAllRead}
                              class="text-xs font-medium text-brand-700 hover:text-brand-800 focus:outline-none focus:underline"
                            >
                              Прочитати всі
                            </button>
                          )}
                        </div>
                        <div class="max-h-80 overflow-y-auto">
                          {notifications.value.length === 0 ? (
                            <p class="px-4 py-3 text-sm text-gray-600">Немає сповіщень</p>
                          ) : (
                            notifications.value.map((n) => (
                              <button
                                type="button"
                                role="menuitem"
                                key={n.id}
                                onClick={() => (!n.readAt ? markRead(n.id) : undefined)}
                                class={
                                  'block w-full px-4 py-2 text-left text-sm transition hover:bg-gray-50 focus:bg-gray-50 focus:outline-none ' +
                                  (n.readAt ? 'text-gray-600' : 'font-medium text-gray-800')
                                }
                              >
                                <span class="block truncate">{n.title}</span>
                                {n.body && <span class="block truncate text-xs text-gray-600">{n.body}</span>}
                                <span class="block text-[11px] text-gray-500">{formatNotifTime(n.createdAt)}</span>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div class="relative" ref={menuRef}>
                    <button
                      ref={menuButtonRef}
                      type="button"
                      onClick={toggleMenu}
                      class="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-300"
                      aria-haspopup="menu"
                      aria-expanded={menuOpen.value}
                      aria-controls="account-menu"
                      aria-label="Обліковий запис"
                      title={user.value?.email}
                    >
                      {initials(user.value?.email)}
                    </button>

                    {menuOpen.value ? (
                      <div
                        id="account-menu"
                        role="menu"
                        aria-label="Обліковий запис"
                        class="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
                      >
                        <div class="border-b border-gray-100 px-4 py-2">
                          <p class="text-xs text-gray-600">Ви увійшли як</p>
                          <p class="truncate text-sm font-medium text-gray-800">
                            {user.value?.email}
                          </p>
                        </div>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={onLogout}
                          disabled={loggingOut.value}
                          class="block w-full px-4 py-2 text-left text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus:bg-gray-50 focus:outline-none disabled:opacity-60"
                        >
                          {loggingOut.value ? 'Виходимо…' : 'Вийти'}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </nav>

                <button
                  ref={burgerRef}
                  type="button"
                  onClick={toggleMobile}
                  class="inline-flex h-10 w-10 items-center justify-center rounded-lg text-gray-800 transition hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-300 md:hidden"
                  aria-label={mobileOpen.value ? 'Закрити меню' : 'Відкрити меню'}
                  aria-haspopup="true"
                  aria-expanded={mobileOpen.value}
                  aria-controls="mobile-nav"
                >
                  {mobileOpen.value ? (
                    <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  ) : (
                    <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <path d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  )}
                </button>
              </>
            ) : (
              <nav class="flex items-center gap-3 text-sm" aria-label="Авторизація">
                <NuxtLink to="/login" class={desktopLinkClass}>
                  Вхід
                </NuxtLink>
                <NuxtLink
                  to="/register"
                  class="rounded-lg bg-brand-600 px-3 py-1.5 font-medium text-white transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-300"
                >
                  Реєстрація
                </NuxtLink>
              </nav>
            )}
          </div>

          {loggedIn.value && mobileOpen.value ? (
            <nav
              id="mobile-nav"
              class="border-t border-gray-100 bg-white px-4 py-3 text-sm md:hidden"
              aria-label="Мобільна навігація"
            >
              <div class="space-y-1">
                {navLinks.map((link) => (
                  <NuxtLink
                    key={link.to}
                    to={link.to}
                    class={mobileLinkClass}
                    activeClass="bg-brand-50 text-brand-700"
                    onClick={closeMobile}
                  >
                    {link.label}
                  </NuxtLink>
                ))}
              </div>

              <div class="mt-3 border-t border-gray-100 pt-3">
                <div class="flex items-center gap-3 px-3 py-2">
                  <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white" aria-hidden="true">
                    {initials(user.value?.email)}
                  </span>
                  <div class="min-w-0">
                    <p class="text-xs text-gray-600">Ви увійшли як</p>
                    <p class="truncate text-sm font-medium text-gray-800">
                      {user.value?.email}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onLogout}
                  disabled={loggingOut.value}
                  class={`${btnSecondaryClass} mt-1 w-full text-center`}
                >
                  {loggingOut.value ? 'Виходимо…' : 'Вийти'}
                </button>
              </div>
            </nav>
          ) : null}
        </header>

        <main id="main-content" tabindex="-1" class="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
          {slots.default?.()}
        </main>

        <footer class="border-t border-gray-200 bg-white">
          <div class="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-4 text-center text-sm text-gray-600">
            <span>© {new Date().getFullYear()} Calories</span>
            <span aria-hidden="true">·</span>
            <NuxtLink
              to="/privacy"
              class="font-medium text-gray-700 hover:text-brand-700 focus:outline-none focus:underline"
            >
              Privacy
            </NuxtLink>
          </div>
        </footer>

        <AppToasts />
        <PwaPrompt />
      </div>
    )
  },
})
