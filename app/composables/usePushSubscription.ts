import { ref, onMounted } from 'vue'
import { urlBase64ToUint8Array } from '~/utils/push'

// Клієнтський composable для Web Push: реєстрація Service Worker, стан дозволу,
// підписка/відписка браузера на сповіщення.

export function usePushSubscription() {
  const supported = ref(false)
  const permission = ref<NotificationPermission>('default')
  const subscribed = ref(false)
  const busy = ref(false)
  const error = ref<string | null>(null)

  onMounted(async () => {
    if (!import.meta.client) return
    supported.value = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    if (!supported.value) return

    permission.value = Notification.permission

    try {
      const registration = await navigator.serviceWorker.register('/sw.js')
      const existing = await registration.pushManager.getSubscription()
      subscribed.value = existing !== null
    } catch {
      // Реєстрація SW не вдалась (напр. HTTP без localhost) — лишаємо supported=true,
      // subscribe() поверне зрозумілу помилку при спробі.
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

      const registration = await navigator.serviceWorker.ready
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
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
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
