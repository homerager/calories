import { ref, onMounted } from 'vue'
import { urlBase64ToUint8Array } from '~/utils/push'

// Клієнтський composable для Web Push: стан дозволу, підписка/відписка.
// Service Worker реєструє @vite-pwa/nuxt — тут лише чекаємо ready.

export function usePushSubscription() {
  const supported = ref(false)
  const permission = ref<NotificationPermission>('default')
  const subscribed = ref(false)
  const busy = ref(false)
  const error = ref<string | null>(null)

  async function getRegistration(): Promise<ServiceWorkerRegistration | undefined> {
    if (!import.meta.client || !('serviceWorker' in navigator)) return undefined
    const { $pwa } = useNuxtApp()
    const fromPwa = $pwa?.getSWRegistration?.()
    if (fromPwa) return fromPwa
    return navigator.serviceWorker.ready
  }

  onMounted(async () => {
    if (!import.meta.client) return
    supported.value =
      'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    if (!supported.value) return

    permission.value = Notification.permission

    try {
      const registration = await getRegistration()
      const existing = await registration?.pushManager.getSubscription()
      subscribed.value = existing != null
    } catch {
      // SW ще не активовано (напр. HTTP без localhost) — subscribe() покаже помилку.
    }
  })

  /** Запитує дозвіл (за потреби) і підписує браузер на Web Push. */
  async function subscribe(): Promise<void> {
    error.value = null
    busy.value = true
    try {
      const config = useRuntimeConfig()
      const publicKey = config.public.pushVapidPublicKey
      if (!publicKey) {
        error.value = 'Push-сповіщення не налаштовано на сервері'
        return
      }

      const permissionResult = await Notification.requestPermission()
      permission.value = permissionResult
      if (permissionResult !== 'granted') {
        error.value = 'Дозвіл на сповіщення не надано'
        return
      }

      const registration = await getRegistration()
      if (!registration) {
        error.value = 'Service Worker ще не готовий. Оновіть сторінку й спробуйте ще раз.'
        return
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })

      const json = subscription.toJSON()
      await $fetch('/api/push/subscribe', {
        method: 'POST',
        body: { endpoint: json.endpoint, keys: json.keys },
      })

      subscribed.value = true
    } catch {
      error.value = 'Не вдалося увімкнути push-сповіщення'
    } finally {
      busy.value = false
    }
  }

  /** Відписує браузер від Web Push. */
  async function unsubscribe(): Promise<void> {
    error.value = null
    busy.value = true
    try {
      const registration = await getRegistration()
      const subscription = await registration?.pushManager.getSubscription()
      if (subscription) {
        const endpoint = subscription.endpoint
        await subscription.unsubscribe()
        await $fetch('/api/push/unsubscribe', { method: 'POST', body: { endpoint } })
      }
      subscribed.value = false
    } catch {
      error.value = 'Не вдалося вимкнути push-сповіщення'
    } finally {
      busy.value = false
    }
  }

  return {
    supported,
    permission,
    subscribed,
    busy,
    error,
    subscribe,
    unsubscribe,
  }
}
