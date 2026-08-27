import { getQuery } from 'h3'
import { prisma } from '../utils/prisma'
import { DATE_RE } from '../utils/foodSchemas'
import { resolveZonedDayBounds } from '../utils/day'

// Список записів активності за добу (?date=YYYY-MM-DD; за замовчуванням — сьогодні).
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const q = getQuery(event)
  const dateStr = typeof q.date === 'string' && DATE_RE.test(q.date) ? q.date : null
  const { key, start, end } = resolveZonedDayBounds(dateStr)

  const entries = await prisma.exerciseLog.findMany({
    where: { userId: user.id, performedAt: { gte: start, lt: end } },
    orderBy: { performedAt: 'asc' },
    select: {
      id: true,
      name: true,
      durationMin: true,
      steps: true,
      kcalBurned: true,
      performedAt: true,
      createdAt: true,
    },
  })

  const totalKcalBurned = entries.reduce((sum, e) => sum + (e.kcalBurned ?? 0), 0)

  return {
    date: key,
    entries: entries.map((e) => ({
      id: e.id,
      name: e.name,
      durationMin: e.durationMin,
      steps: e.steps,
      kcalBurned: e.kcalBurned,
      performedAt: e.performedAt.toISOString(),
      createdAt: e.createdAt.toISOString(),
    })),
    totalKcalBurned,
  }
})
