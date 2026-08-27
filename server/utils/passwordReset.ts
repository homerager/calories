import { createHash, randomBytes } from 'node:crypto'
import { prisma } from './prisma'

const TOKEN_TTL_MS = 60 * 60 * 1000

export function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function newResetToken(): string {
  return randomBytes(32).toString('base64url')
}

export async function issuePasswordReset(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = newResetToken()
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS)
  await prisma.passwordResetToken.create({
    data: {
      userId,
      tokenHash: hashResetToken(token),
      expiresAt,
    },
  })
  return { token, expiresAt }
}

export function resetLink(token: string): string {
  const base = (process.env.NUXT_APP_URL ?? 'http://localhost:3001').replace(/\/$/, '')
  return `${base}/reset-password?token=${encodeURIComponent(token)}`
}

/** Відправляє лист, якщо задано SMTP; інакше логує посилання (dev / без пошти). */
export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const link = resetLink(token)
  const host = process.env.NUXT_SMTP_HOST?.trim()
  if (!host) {
    console.info(`[auth] скидання пароля для ${email}: ${link}`)
    return
  }

  console.info(`[auth] SMTP задано (${host}), але транспорт не підключено. Посилання для ${email}: ${link}`)
}
