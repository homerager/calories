import { getQuery } from 'h3'
import { prisma } from '../utils/prisma'
import { DATE_RE } from '../utils/foodSchemas'
import { resolveZonedDayBounds } from '../utils/day'

// Список записів води за добу (?date=YYYY-MM-DD; за замовчуванням — сьогодні
// у зоні застосунку) разом із денною сумою випитого (мл).
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const q = getQuery(event)
  const dateStr = typeof q.date === 'string' && DATE_RE.test(q.date) ? q.date : null
  const { key, start, end } = resolveZonedDayBounds(dateStr)

  const entries = await prisma.waterLog.findMany({
    where: { userId: user.id, measuredAt: { gte: start, lt: end } },
    orderBy: { measuredAt: 'asc' },
    select: {
      id: true,
      volumeMl: true,
      measuredAt: true,
      createdAt: true,
    },
  })

  const totalMl = entries.reduce((sum, e) => sum + e.volumeMl, 0)

  return {
    date: key,
    entries: entries.map((e) => ({
      id: e.id,
      volumeMl: e.volumeMl,
      measuredAt: e.measuredAt.toISOString(),
      createdAt: e.createdAt.toISOString(),
    })),
    totalMl,
  }
})
