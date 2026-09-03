import { createSign } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { prisma } from './prisma'
import type { PushPayload } from './webPush'

// Доставка push через Firebase Cloud Messaging HTTP v1 — без firebase-admin.
// Потрібен service-account JSON:
//   NUXT_FCM_SERVICE_ACCOUNT — або сам JSON, або шлях до файлу.
// Якщо не задано — усі виклики стають no-op (мобільний push просто вимкнений).

interface ServiceAccount {
  client_email: string
  private_key: string
  project_id: string
}

let cachedAccount: ServiceAccount | null | undefined
let cachedToken: { value: string; expiresAt: number } | null = null

function resolveAccount(): ServiceAccount | null {
  if (cachedAccount !== undefined) return cachedAccount

  const raw = process.env.NUXT_FCM_SERVICE_ACCOUNT?.trim()
  if (!raw) {
    cachedAccount = null
    return null
  }

  try {
    const json = raw.startsWith('{') ? raw : readFileSync(raw, 'utf8')
    const parsed = JSON.parse(json) as ServiceAccount
    if (!parsed.client_email || !parsed.private_key || !parsed.project_id) {
      throw new Error('service account: бракує client_email / private_key / project_id')
    }
    cachedAccount = parsed
  } catch (err) {
    console.error('[fcm] не вдалося прочитати NUXT_FCM_SERVICE_ACCOUNT:', err)
    cachedAccount = null
  }
  return cachedAccount
}

/** OAuth2 access token для FCM (кешується ~55 хв). */
async function getAccessToken(account: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  if (cachedToken && cachedToken.expiresAt > now + 60) return cachedToken.value

  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = base64url(
    JSON.stringify({
      iss: account.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  )
  const signature = createSign('RSA-SHA256')
    .update(`${header}.${claims}`)
    .sign(account.private_key, 'base64url')
  const assertion = `${header}.${claims}.${signature}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })
  if (!res.ok) {
    throw new Error(`FCM OAuth ${res.status}: ${await res.text()}`)
  }
  const data = (await res.json()) as { access_token: string; expires_in: number }
  cachedToken = { value: data.access_token, expiresAt: now + data.expires_in }
  return data.access_token
}

function base64url(input: string): string {
  return Buffer.from(input).toString('base64url')
}

/** Надсилає push на всі FCM-токени користувача; протухлі токени видаляє. */
export async function sendFcmToUser(userId: string, payload: PushPayload): Promise<void> {
  const account = resolveAccount()
  if (!account) return

  const tokens = await prisma.fcmToken.findMany({ where: { userId }, select: { id: true, token: true } })
  if (tokens.length === 0) return

  let accessToken: string
  try {
    accessToken = await getAccessToken(account)
  } catch (err) {
    console.error('[fcm] не вдалося отримати access token:', err)
    return
  }

  const url = `https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`

  await Promise.all(
    tokens.map(async ({ id, token }) => {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${accessToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              token,
              notification: { title: payload.title, body: payload.body ?? undefined },
              data: payload.url ? { url: payload.url } : undefined,
              android: { priority: 'high', notification: { channel_id: 'reminders' } },
            },
          }),
        })
        if (res.status === 404 || res.status === 400) {
          // UNREGISTERED / INVALID_ARGUMENT — токен більше не валідний.
          await prisma.fcmToken.delete({ where: { id } }).catch(() => {})
        } else if (!res.ok) {
          console.error('[fcm] надсилання не вдалося', res.status, await res.text())
        }
      } catch (err) {
        console.error('[fcm] помилка мережі', err)
      }
    }),
  )
}
