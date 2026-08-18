import { getQuery } from 'h3'
import { prisma } from '../../utils/prisma'
import { normalizeFoodKey } from '../../utils/crypto'

// Ручний пошук у довіднику страв (без AI): ?q=назва. Повертає поживність на 100 г.
export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const q = getQuery(event)
  const term = typeof q.q === 'string' ? q.q.trim() : ''
  if (term.length < 2) {
    return { items: [] }
  }

  const items = await prisma.foodItem.findMany({
    where: {
      OR: [
        { name: { contains: term, mode: 'insensitive' } },
        { normalizedKey: { contains: normalizeFoodKey(term) } },
      ],
    },
    orderBy: { name: 'asc' },
    take: 20,
    select: {
      id: true,
      name: true,
      kcalPer100: true,
      proteinPer100: true,
      fatPer100: true,
      carbPer100: true,
    },
  })

  return { items }
})
