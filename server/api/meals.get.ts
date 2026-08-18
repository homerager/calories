import { getQuery } from 'h3'
import { prisma } from '../utils/prisma'
import { getDailyTotals, nextDay, startOfDay } from '../utils/aggregates'
import { toMealResponse } from '../utils/food'
import { DATE_RE } from '../utils/foodSchemas'

// Список записів прийому їжі за добу (?date=YYYY-MM-DD; за замовчуванням — сьогодні)
// разом із денними сумами калорій/БЖВ.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const q = getQuery(event)
  const dateStr = typeof q.date === 'string' && DATE_RE.test(q.date) ? q.date : null
  const base = dateStr ? new Date(`${dateStr}T12:00:00.000Z`) : new Date()
  const dayStart = startOfDay(base)
  const dayEnd = nextDay(base)

  const entries = await prisma.mealEntry.findMany({
    where: { userId: user.id, date: { gte: dayStart, lt: dayEnd } },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      date: true,
      slot: true,
      portionGrams: true,
      kcal: true,
      protein: true,
      fat: true,
      carb: true,
      source: true,
      confidence: true,
      createdAt: true,
      foodItem: { select: { name: true } },
    },
  })

  const totals = await getDailyTotals(user.id, dayStart)

  return {
    date: dayStart.toISOString().slice(0, 10),
    entries: entries.map(toMealResponse),
    totals,
  }
})
