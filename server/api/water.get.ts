import { getQuery } from 'h3'
import { prisma } from '../utils/prisma'
import { nextDay, startOfDay } from '../utils/aggregates'
import { DATE_RE } from '../utils/foodSchemas'
import { DEFAULT_WATER_GOAL_ML } from '../utils/waterSchemas'

// Список записів води за добу (?date=YYYY-MM-DD; за замовчуванням — сьогодні)
// разом із денною сумою випитого та ціллю.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const q = getQuery(event)
  const dateStr = typeof q.date === 'string' && DATE_RE.test(q.date) ? q.date : null
  const base = dateStr ? new Date(`${dateStr}T12:00:00.000Z`) : new Date()
  const dayStart = startOfDay(base)
  const dayEnd = nextDay(base)

  const entries = await prisma.waterLog.findMany({
    where: { userId: user.id, measuredAt: { gte: dayStart, lt: dayEnd } },
    orderBy: { measuredAt: 'asc' },
    select: { id: true, volumeMl: true, measuredAt: true, createdAt: true },
  })

  const totalMl = entries.reduce((sum, e) => sum + e.volumeMl, 0)

  return {
    date: dayStart.toISOString().slice(0, 10),
    entries: entries.map((e) => ({
      id: e.id,
      volumeMl: e.volumeMl,
      measuredAt: e.measuredAt.toISOString(),
      createdAt: e.createdAt.toISOString(),
    })),
    totalMl,
    goalMl: DEFAULT_WATER_GOAL_ML,
  }
})
