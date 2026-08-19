import { getQuery } from 'h3'
import { prisma } from '../utils/prisma'
import { nextDay, startOfDay } from '../utils/aggregates'
import { DATE_RE } from '../utils/foodSchemas'

// Список записів активності за добу (?date=YYYY-MM-DD; за замовчуванням — сьогодні)
// разом із денною сумою спалених калорій.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const q = getQuery(event)
  const dateStr = typeof q.date === 'string' && DATE_RE.test(q.date) ? q.date : null
  const base = dateStr ? new Date(`${dateStr}T12:00:00.000Z`) : new Date()
  const dayStart = startOfDay(base)
  const dayEnd = nextDay(base)

  const entries = await prisma.exerciseLog.findMany({
    where: { userId: user.id, performedAt: { gte: dayStart, lt: dayEnd } },
    orderBy: { performedAt: 'asc' },
    select: {
      id: true,
      name: true,
      durationMin: true,
      kcalBurned: true,
      performedAt: true,
      createdAt: true,
    },
  })

  const totalKcalBurned = entries.reduce((sum, e) => sum + (e.kcalBurned ?? 0), 0)

  return {
    date: dayStart.toISOString().slice(0, 10),
    entries: entries.map((e) => ({
      id: e.id,
      name: e.name,
      durationMin: e.durationMin,
      kcalBurned: e.kcalBurned,
      performedAt: e.performedAt.toISOString(),
      createdAt: e.createdAt.toISOString(),
    })),
    totalKcalBurned,
  }
})
