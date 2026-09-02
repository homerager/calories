import { prisma } from '../../utils/prisma'

// Список активних Bearer-токенів користувача (екран «пристрої / сесії»).
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const rows = await prisma.apiToken.findMany({
    where: { userId: user.id, revokedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, lastUsedAt: true, expiresAt: true, createdAt: true },
  })

  const now = Date.now()
  return {
    tokens: rows
      .filter((r) => !r.expiresAt || r.expiresAt.getTime() > now)
      .map((r) => ({
        id: r.id,
        name: r.name,
        lastUsedAt: r.lastUsedAt,
        expiresAt: r.expiresAt,
        createdAt: r.createdAt,
        current: r.id === event.context.apiTokenId,
      })),
  }
})
