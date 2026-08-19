import { computed, onBeforeUnmount, onMounted } from 'vue'

// Клієнтський composable для in-app сповіщень: список, лічильник непрочитаних,
// позначення прочитаними. Легкий поллінг (60с), поки composable змонтовано.

export interface NotificationItem {
  id: string
  title: string
  body: string | null
  createdAt: string
  readAt: string | null
}

const POLL_INTERVAL_MS = 60_000

export function useNotifications() {
  const requestFetch = useRequestFetch()

  const { data, pending, refresh } = useAsyncData('notifications', () =>
    requestFetch<{ notifications: NotificationItem[]; unreadCount: number }>('/api/notifications'),
  )

  const notifications = computed<NotificationItem[]>(() => data.value?.notifications ?? [])
  const unreadCount = computed<number>(() => data.value?.unreadCount ?? 0)

  /** Позначає всі сповіщення прочитаними й оновлює стан. */
  async function markAllRead(): Promise<void> {
    await $fetch('/api/notifications/read-all', { method: 'POST' })
    await refresh()
  }

  /** Позначає одне сповіщення прочитаним і оновлює стан. */
  async function markRead(id: string): Promise<void> {
    await $fetch(`/api/notifications/${id}`, { method: 'PATCH' })
    await refresh()
  }

  let timer: ReturnType<typeof setInterval> | null = null

  onMounted(() => {
    if (import.meta.client) {
      timer = setInterval(() => {
        void refresh()
      }, POLL_INTERVAL_MS)
    }
  })

  onBeforeUnmount(() => {
    if (timer) clearInterval(timer)
  })

  return {
    notifications,
    unreadCount,
    pending,
    markAllRead,
    markRead,
    refresh,
  }
}
