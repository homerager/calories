import { createHash, randomBytes } from 'node:crypto'

// prisma підвантажується ліниво: чисті хелпери (newApiToken / hashApiToken)
// лишаються придатними до імпорту без DATABASE_URL (юніт-тести).
async function db() {
  return (await import('./prisma')).prisma
}

// Особисті токени доступу (Bearer) для не-браузерних клієнтів (мобільний застосунок).
//
// Токен показуємо клієнту рівно один раз — у БД лежить лише SHA-256 хеш
// (токен має 256 біт ентропії, тож повільний KDF не потрібен).
// Формат: `cal_<43 base64url-символи>`.

const TOKEN_PREFIX = 'cal_'
const TOKEN_BYTES = 32

// Раз на скільки оновлювати lastUsedAt (щоб не писати в БД на кожен запит).
const LAST_USED_THROTTLE_MS = 10 * 60 * 1000

/** Термін дії нового токена в днях (0 / порожньо → безстроковий). */
function tokenTtlDays(): number {
  const raw = Number(process.env.NUXT_API_TOKEN_TTL_DAYS)
  return Number.isFinite(raw) && raw > 0 ? raw : 0
}

/** Генерує новий сирий токен (показується клієнту один раз). */
export function newApiToken(): string {
  return TOKEN_PREFIX + randomBytes(TOKEN_BYTES).toString('base64url')
}

/** SHA-256 хеш токена (hex) — те, що зберігаємо й шукаємо в БД. */
export function hashApiToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export interface IssuedApiToken {
  id: string
  token: string
  expiresAt: Date | null
}

/** Створює токен для користувача й повертає сирий токен (більше ніде не доступний). */
export async function issueApiToken(userId: string, name?: string | null): Promise<IssuedApiToken> {
  const token = newApiToken()
  const ttlDays = tokenTtlDays()
  const expiresAt = ttlDays > 0 ? new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000) : null

  const row = await (await db()).apiToken.create({
    data: {
      userId,
      tokenHash: hashApiToken(token),
      name: name?.trim() || null,
      expiresAt,
    },
    select: { id: true },
  })

  return { id: row.id, token, expiresAt }
}

export interface ResolvedApiToken {
  tokenId: string
  user: { id: string; email: string }
}

/**
 * Перевіряє Bearer-токен: знаходить активний рядок (не відкликаний, не прострочений),
 * оновлює lastUsedAt (з троттлінгом) і повертає власника. Інакше — null.
 */
export async function resolveApiToken(token: string): Promise<ResolvedApiToken | null> {
  if (!token.startsWith(TOKEN_PREFIX)) return null

  const prisma = await db()
  const row = await prisma.apiToken.findUnique({
    where: { tokenHash: hashApiToken(token) },
    select: {
      id: true,
      revokedAt: true,
      expiresAt: true,
      lastUsedAt: true,
      user: { select: { id: true, email: true } },
    },
  })

  if (!row || row.revokedAt) return null
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return null

  const staleUsage =
    !row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > LAST_USED_THROTTLE_MS
  if (staleUsage) {
    await prisma.apiToken
      .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
      .catch(() => {
        // Гонитва / рядок видалено паралельно — некритично для запиту.
      })
  }

  return { tokenId: row.id, user: { id: row.user.id, email: row.user.email } }
}

/** Відкликає токен за id (ідемпотентно). */
export async function revokeApiToken(tokenId: string, userId: string): Promise<boolean> {
  const res = await (await db()).apiToken.updateMany({
    where: { id: tokenId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
  return res.count > 0
}
