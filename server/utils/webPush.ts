import webpush from 'web-push'
import { prisma } from './prisma'

let configured = false

/** Налаштовує VAPID-деталі один раз (лениво, на перший виклик). */
function ensureConfigured(): boolean {
  if (configured) return true

  const config = useRuntimeConfig()
  const publicKey = config.push.vapidPublicKey
  const privateKey = config.push.vapidPrivateKey
  if (!publicKey || !privateKey) return false

  webpush.setVapidDetails(config.push.vapidSubject, publicKey, privateKey)
  configured = true
  return true
}

export interface PushPayload {
  title: string
  body?: string | null
  url?: string
}

/** Надсилає Web Push-сповіщення на всі підписки користувача; протухлі підписки видаляє. */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!ensureConfigured()) return

  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } })
  if (subscriptions.length === 0) return

  const body = JSON.stringify(payload)

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
        )
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number }).statusCode
        // 404/410 — підписка більше не валідна (браузер її відкликав).
        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {})
        } else {
          console.error('[push] надсилання не вдалося', err)
        }
      }
    }),
  )
}
