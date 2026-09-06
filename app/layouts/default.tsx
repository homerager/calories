import { defineComponent, nextTick, onBeforeUnmount, onMounted, ref, watch, type VNode } from 'vue'
import { useRoute } from 'vue-router'
import { AppToasts, NuxtLink, PwaPrompt } from '#components'
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
      document.body.style.overflow = ''
    })

    watch(() => route.fullPath, closeMobile)

    watch(mobileOpen, async (open) => {
      if (import.meta.client) {
        document.body.style.overflow = open ? 'hidden' : ''
      }
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

    function isActive(to: string) {
      const p = route.path
      return to === '/' ? p === '/' : p === to || p.startsWith(`${to}/`)
    }

    const desktopLinkClass = 'font-medium text-gray-700 hover:text-brand-700 focus:outline-none focus:underline'

    const navLinks = [
      { to: '/diary', label: 'Щоденник' },
      { to: '/menu', label: 'Меню' },
      { to: '/dishes', label: 'Страви' },
      { to: '/exercise', label: 'Активність' },
      //{ to: '/water', label: 'Вода' },
      { to: '/stats', label: 'Статистика' },
      { to: '/settings', label: 'Налаштування' },
    ]

    const drawerItemClass =
      'flex items-center gap-4 rounded-lg px-3 py-2.5 text-[15px] font-medium text-gray-700 transition hover:bg-gray-200 focus:outline-none focus:bg-gray-200 [&_svg]:text-gray-500'
    const drawerItemActiveClass = 'bg-brand-50 text-brand-700'

    const svg = (children: VNode) => (
      <svg
        class="h-5 w-5 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        {children}
      </svg>
    )

    const icons = {
      today: () => svg(<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>),
      diary: () => svg(<><path d="M3 2v7a2 2 0 0 0 4 0V2M5 2v20" /><path d="M17 2c-1.7 0-3 2.7-3 6s1.3 5 3 5V2Zm0 11v9" /></>),
      menu: () => svg(<><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18M15 3v18" /></>),
      dishes: () => svg(<><path d="M4 11h16" /><path d="M6 11V7a6 6 0 0 1 12 0v4" /><path d="M4 11v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /></>),
      exercise: () => svg(<path d="M22 12h-4l-3 9L9 3l-3 9H2" />),
      stats: () => svg(<><path d="M3 17l6-6 4 4 8-8" /><path d="M17 7h4v4" /></>),
      water: () => svg(<path d="M12 2.7 6.8 8.4a7 7 0 1 0 10.4 0Z" />),
      profile: () => svg(<><circle cx="12" cy="8" r="4" /><path d="M5.5 21a7 7 0 0 1 13 0" /></>),
      settings: () => svg(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V15Z" /></>),
      logout: () => svg(<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></>),
    }

    type DrawerLink = { to: string, label: string, exact?: boolean, icon: () => VNode }

    const drawerPrimary: DrawerLink[] = [
      { to: '/', label: 'Сьогодні', exact: true, icon: icons.today },
      { to: '/diary', label: 'Щоденник', icon: icons.diary },
      { to: '/menu', label: 'Меню', icon: icons.menu },
      { to: '/exercise', label: 'Активність', icon: icons.exercise },
      { to: '/stats', label: 'Статистика', icon: icons.stats },
    ]
    const drawerSecondary: DrawerLink[] = [
      { to: '/dishes', label: 'Страви', icon: icons.dishes },
      { to: '/water', label: 'Вода', icon: icons.water },
      { to: '/profile', label: 'Профіль', icon: icons.profile },
      { to: '/settings', label: 'Налаштування', icon: icons.settings },
    ]

    return () => (
      <div class="min-h-screen flex flex-col">
        <a href="#main-content" class="skip-link">
          Перейти до вмісту
        </a>

        <header class="border-b border-gray-200 bg-card">
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
                      class="relative flex h-9 w-9 items-center justify-center rounded-full text-gray-700 transition hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-300"
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
                  class="relative z-50 inline-flex h-10 w-10 items-center justify-center rounded-lg text-gray-800 transition hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-300 md:hidden"
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

          {loggedIn.value ? (
            <div
              class="fixed inset-0 z-40 md:hidden"
              inert={!mobileOpen.value || undefined}
              aria-hidden={!mobileOpen.value}
            >
              <div
                onClick={closeMobile}
                class={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${
                  mobileOpen.value ? 'opacity-100' : 'opacity-0'
                }`}
              />

              <nav
                id="mobile-nav"
                aria-label="Мобільна навігація"
                class={`absolute inset-y-0 left-0 flex w-[84%] max-w-xs flex-col overflow-y-auto bg-white shadow-xl transition-transform duration-200 ease-out ${
                  mobileOpen.value ? 'translate-x-0' : '-translate-x-full'
                }`}
              >
                <div class="bg-brand-600 px-5 pb-5 pt-6 text-white">
                  <span
                    class="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-2xl font-semibold text-brand-700"
                    aria-hidden="true"
                  >
                    {initials(user.value?.email)}
                  </span>
                  <p class="mt-3 text-lg font-semibold">Calories</p>
                  <p class="truncate text-sm text-white/80">{user.value?.email}</p>
                </div>

                <div class="flex-1 px-2 py-3">
                  <div class="space-y-0.5">
                    {drawerPrimary.map((item) => (
                      <NuxtLink
                        key={item.to}
                        to={item.to}
                        class={drawerItemClass}
                        activeClass={item.exact ? undefined : drawerItemActiveClass}
                        exactActiveClass={item.exact ? drawerItemActiveClass : undefined}
                        onClick={closeMobile}
                      >
                        {item.icon()}
                        <span>{item.label}</span>
                      </NuxtLink>
                    ))}
                  </div>

                  <div class="my-2 border-t border-gray-200" />

                  <div class="space-y-0.5">
                    {drawerSecondary.map((item) => (
                      <NuxtLink
                        key={item.to}
                        to={item.to}
                        class={drawerItemClass}
                        activeClass={drawerItemActiveClass}
                        onClick={closeMobile}
                      >
                        {item.icon()}
                        <span>{item.label}</span>
                      </NuxtLink>
                    ))}
                  </div>

                  <div class="my-2 border-t border-gray-200" />

                  <button
                    type="button"
                    onClick={onLogout}
                    disabled={loggingOut.value}
                    class={`${drawerItemClass} w-full text-left disabled:opacity-60`}
                  >
                    {icons.logout()}
                    <span>{loggingOut.value ? 'Виходимо…' : 'Вийти'}</span>
                  </button>
                </div>
              </nav>
            </div>
          ) : null}
        </header>

        <main
          id="main-content"
          tabindex="-1"
          class={`mx-auto w-full max-w-3xl flex-1 px-4 py-6 ${loggedIn.value ? 'pb-24 md:pb-6' : ''}`}
        >
          {slots.default?.()}
        </main>

        <footer class={`border-t border-gray-200 bg-white ${loggedIn.value ? 'hidden md:block' : ''}`}>
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

        {loggedIn.value ? (
          <nav
            class="bottom-mobile-navigation fixed inset-x-0 bottom-0 z-30 flex border-t border-gray-200 bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
            aria-label="Нижня навігація"
          >
            {drawerPrimary.map((item) => {
              const active = isActive(item.to)
              return (
                <NuxtLink
                  key={item.to}
                  to={item.to}
                  aria-current={active ? 'page' : undefined}
                  class={`flex flex-1 flex-col items-center gap-1 pt-2 pb-1.5 text-[11px] font-medium focus:outline-none ${
                    active ? 'text-brand-700' : 'text-gray-500'
                  }`}
                >
                  <span
                    class={`flex h-7 w-14 items-center justify-center rounded-full transition-colors ${
                      active ? 'bg-brand-100' : ''
                    }`}
                  >
                    {item.icon()}
                  </span>
                  <span>{item.label}</span>
                </NuxtLink>
              )
            })}
          </nav>
        ) : null}

        <AppToasts />
        <PwaPrompt />
      </div>
    )
  },
})
