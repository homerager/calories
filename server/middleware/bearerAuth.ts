import { getRequestHeader, type H3Event } from 'h3'
import { resolveApiToken } from '../utils/apiToken'

// Автентифікація не-браузерних клієнтів (мобільний застосунок) через
// `Authorization: Bearer <token>`.
//
// nuxt-auth-utils тримає сесію у запечатаному cookie. Замість переписування
// 40+ обробників ми підставляємо вже «розпечатану» сесію напряму в кеш h3
// (`event.context.sessions[<name>]`) — після цього `getUserSession` /
// `requireUserSession` повертають користувача так само, як для cookie-сесії,
// і жодного Set-Cookie у відповідь не додається.

interface CachedSession {
  id: string
  createdAt: number
  data: Record<string, unknown>
}

function sessionName(event: H3Event): string {
  const cfg = useRuntimeConfig(event) as { session?: { name?: string } }
  return cfg.session?.name || 'nuxt-session'
}

export default defineEventHandler(async (event) => {
  const header = getRequestHeader(event, 'authorization')
  if (!header || !header.startsWith('Bearer ')) return

  const token = header.slice('Bearer '.length).trim()
  if (!token) return

  const resolved = await resolveApiToken(token)
  // Невалідний токен: не чіпаємо контекст — далі спрацює звичайний 401.
  if (!resolved) return

  const name = sessionName(event)
  const store = (event.context.sessions ??= Object.create(null)) as Record<string, CachedSession>

  // Не перетираємо вже ініціалізовану cookie-сесію (напр. одночасний вхід).
  if (!store[name]) {
    store[name] = {
      id: `apitoken:${resolved.tokenId}`,
      createdAt: Date.now(),
      data: {
        user: resolved.user,
        loggedInAt: Date.now(),
        viaApiToken: true,
      },
    }
  }

  event.context.apiTokenId = resolved.tokenId
})
