import { ref, onMounted } from 'vue'
import { urlBase64ToUint8Array } from '~/utils/push'
import { extractErrorMessage } from '~/utils/errors'

// Клієнтський composable для Web Push: стан дозволу, підписка/відписка.
// Service Worker реєструє @vite-pwa/nuxt — тут лише чекаємо active registration.
//
// iOS (PWA з домашнього екрана) має кілька пасток:
// 1. Notification.requestPermission() має викликатися синхронно в тому ж тапі,
//    без await і без реактивних оновлень (disabled на кнопці знімає user gesture).
// 2. requestPermission() інколи повертає denied/default навіть після «Дозволити» —
//    тоді все одно пробуємо pushManager.subscribe().
// 3. navigator.serviceWorker.ready на iOS PWA часто зависає, навіть коли
//    реєстрація вже є. Беремо її через getRegistration() і підписуємось
//    без очікування, що SW уже контролює сторінку.

const SW_POLL_MS = 200
const SW_WAIT_MS = 15_000

function isIosDevice(): boolean {
  if (!import.meta.client) return false
  const nav = navigator as Navigator & { standalone?: boolean }
  return (
    /iP(ad|hone|od)/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ||
    nav.standalone === true
  )
}

function isStandaloneDisplay(): boolean {
  if (!import.meta.client) return false
  const nav = navigator as Navigator & { standalone?: boolean }
  return (
    nav.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches
  )
}

function bufferToBase64Url(buf: ArrayBuffer | null): string | undefined {
  if (!buf) return undefined
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]!)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function subscriptionPayload(subscription: PushSubscription): {
  endpoint: string
  keys: { p256dh: string; auth: string }
} | null {
  const json = subscription.toJSON()
  const endpoint = json.endpoint ?? subscription.endpoint
  const p256dh = json.keys?.p256dh ?? bufferToBase64Url(subscription.getKey('p256dh'))
  const auth = json.keys?.auth ?? bufferToBase64Url(subscription.getKey('auth'))
  if (!endpoint || !p256dh || !auth) return null
  return { endpoint, keys: { p256dh, auth } }
}

function permissionDeniedMessage(): string {
  if (isIosDevice()) {
    return 'Сповіщення заборонено для цього додатка. На iPhone: Налаштування → Сповіщення → Calories — увімкніть «Дозволити сповіщення», потім знову відкрийте додаток з іконки на головному екрані.'
  }
  return 'Дозвіл на сповіщення не надано. Дозвольте сповіщення для цього сайту в налаштуваннях браузера.'
}

export function usePushSubscription() {
  const supported = ref(false)
  const permission = ref<NotificationPermission>('default')
  const subscribed = ref(false)
  const busy = ref(false)
  const error = ref<string | null>(null)
  const needsIosInstall = ref(false)

  // Не реактивний: блокує подвійний тап, не тригерить re-render під час системного діалогу.
  let inFlight = false

  function pwaRegistration(): ServiceWorkerRegistration | undefined {
    return useNuxtApp().$pwa?.getSWRegistration?.()
  }

  async function lookupRegistration(): Promise<ServiceWorkerRegistration | undefined> {
    const fromPwa = pwaRegistration()
    if (fromPwa) return fromPwa

    try {
      const matching = await navigator.serviceWorker.getRegistration()
      if (matching) return matching
      const all = await navigator.serviceWorker.getRegistrations()
      return all.find((r) => r.active || r.waiting || r.installing) ?? all[0]
    } catch {
      return undefined
    }
  }

  function waitUntilActivated(reg: ServiceWorkerRegistration): Promise<ServiceWorkerRegistration> {
    if (reg.active) return Promise.resolve(reg)

    return new Promise((resolve) => {
      const finish = () => resolve(reg)
      const timer = window.setTimeout(finish, SW_WAIT_MS)

      const watch = (sw: ServiceWorker | null) => {
        if (!sw) return
        if (sw.state === 'activated') {
          window.clearTimeout(timer)
          finish()
          return
        }
        sw.addEventListener('statechange', () => {
          if (sw.state === 'activated') {
            window.clearTimeout(timer)
            finish()
          }
        })
      }

      watch(reg.installing)
      watch(reg.waiting)
      watch(reg.active)
      reg.addEventListener('updatefound', () => watch(reg.installing))
    })
  }

  async function waitForActiveRegistration(): Promise<ServiceWorkerRegistration | undefined> {
    if (!import.meta.client || !('serviceWorker' in navigator)) return undefined

    const deadline = Date.now() + SW_WAIT_MS
    while (Date.now() < deadline) {
      const found = await lookupRegistration()
      if (found) {
        found.waiting?.postMessage({ type: 'SKIP_WAITING' })
        return waitUntilActivated(found)
      }
      await new Promise((r) => window.setTimeout(r, SW_POLL_MS))
    }

    // Не використовуємо navigator.serviceWorker.ready: на iOS PWA воно часто
    // ніколи не резолвиться, навіть коли реєстрація вже є.
    return lookupRegistration()
  }

  onMounted(async () => {
    if (!import.meta.client) return

    needsIosInstall.value = isIosDevice() && !isStandaloneDisplay()
    supported.value =
      'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    if (!supported.value) return

    permission.value = Notification.permission

    try {
      const registration = await waitForActiveRegistration()
      const existing = await registration?.pushManager.getSubscription()
      subscribed.value = existing != null
    } catch {
      // SW ще не активовано (напр. HTTP без localhost) — subscribe() покаже помилку.
    }
  })

  /** Запитує дозвіл (за потреби) і підписує браузер на Web Push. */
  function subscribe(): Promise<void> {
    if (!import.meta.client || inFlight || busy.value) return Promise.resolve()

    const publicKey = useRuntimeConfig().public.pushVapidPublicKey
    if (!publicKey) {
      error.value = 'Push-сповіщення не налаштовано на сервері'
      return Promise.resolve()
    }

    if (!('Notification' in window) || !('PushManager' in window)) {
      error.value = needsIosInstall.value
        ? 'На iPhone push-сповіщення працюють лише з іконки на головному екрані. Safari → Поділитися → На екран «Домівка», потім відкрийте Calories звідти.'
        : 'Цей браузер не підтримує push-сповіщення'
      return Promise.resolve()
    }

    // Вже відхилено раніше — повторний prompt iOS не покаже.
    if (Notification.permission === 'denied') {
      error.value = permissionDeniedMessage()
      permission.value = 'denied'
      return Promise.resolve()
    }

    inFlight = true

    // Синхронно в тому ж тапі, без реактивних записів і без await перед цим.
    const permissionPromise: Promise<NotificationPermission> =
      Notification.permission === 'granted'
        ? Promise.resolve('granted')
        : Notification.requestPermission()

    return completeSubscribe(permissionPromise, publicKey).finally(() => {
      inFlight = false
    })
  }

  async function completeSubscribe(
    permissionPromise: Promise<NotificationPermission>,
    publicKey: string,
  ): Promise<void> {
    const permissionResult = await permissionPromise
    permission.value = Notification.permission || permissionResult

    // busy лише ПІСЛЯ діалогу — інакше disabled на кнопці зриває жест на iOS.
    busy.value = true
    error.value = null
    try {
      const registration = await waitForActiveRegistration()
      if (!registration) {
        error.value =
          'Не вдалося зареєструвати Service Worker. Закрийте додаток повністю й відкрийте знову з іконки на головному екрані.'
        return
      }

      let subscription = await registration.pushManager.getSubscription()
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        })
      }

      const payload = subscriptionPayload(subscription)
      if (!payload) {
        error.value = 'Браузер не повернув ключі підписки. Оновіть сторінку й спробуйте ще раз.'
        return
      }

      await $fetch('/api/push/subscribe', {
        method: 'POST',
        body: payload,
      })

      permission.value = Notification.permission
      subscribed.value = true
    } catch (err: unknown) {
      permission.value = Notification.permission
      const name = err && typeof err === 'object' ? (err as { name?: string }).name : undefined
      if (Notification.permission === 'denied' || name === 'NotAllowedError') {
        error.value = permissionDeniedMessage()
        return
      }
      error.value = extractErrorMessage(err) ?? 'Не вдалося увімкнути push-сповіщення'
    } finally {
      busy.value = false
    }
  }

  /** Відписує браузер від Web Push. */
  async function unsubscribe(): Promise<void> {
    if (inFlight) return
    error.value = null
    busy.value = true
    inFlight = true
    try {
      const registration = await waitForActiveRegistration()
      const subscription = await registration?.pushManager.getSubscription()
      if (subscription) {
        const endpoint = subscription.endpoint
        await subscription.unsubscribe()
        await $fetch('/api/push/unsubscribe', { method: 'POST', body: { endpoint } })
      }
      subscribed.value = false
    } catch (err: unknown) {
      error.value = extractErrorMessage(err) ?? 'Не вдалося вимкнути push-сповіщення'
    } finally {
      busy.value = false
      inFlight = false
    }
  }

  return {
    supported,
    permission,
    subscribed,
    busy,
    error,
    needsIosInstall,
    subscribe,
    unsubscribe,
  }
}
