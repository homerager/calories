import { prisma } from './prisma'

export interface OAuthIdentity {
  provider: string // "google" | "github"
  providerUserId: string
  email: string
}

/**
 * Знаходить або створює користувача за OAuth-ідентичністю.
 * Логіка:
 *  1) Якщо є звʼязка OAuthAccount — повертаємо повʼязаного користувача.
 *  2) Інакше, якщо є користувач із таким email — привʼязуємо провайдера до нього.
 *  3) Інакше створюємо нового користувача (без пароля) разом зі звʼязкою.
 */
export async function findOrCreateOAuthUser(identity: OAuthIdentity): Promise<{ id: string; email: string }> {
  const { provider, providerUserId } = identity
  const email = identity.email.trim().toLowerCase()

  const linked = await prisma.oAuthAccount.findUnique({
    where: { provider_providerUserId: { provider, providerUserId } },
    select: { user: { select: { id: true, email: true } } },
  })
  if (linked) return linked.user

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  })

  if (existing) {
    await prisma.oAuthAccount.create({
      data: { userId: existing.id, provider, providerUserId },
    })
    return existing
  }

  const created = await prisma.user.create({
    data: {
      email,
      oauthAccounts: { create: { provider, providerUserId } },
    },
    select: { id: true, email: true },
  })
  return created
}
