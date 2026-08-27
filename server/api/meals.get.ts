import { getQuery } from 'h3'
import { prisma } from '../utils/prisma'
import { getDailyTotals } from '../utils/aggregates'
import { toMealResponse } from '../utils/food'
import { DATE_RE } from '../utils/foodSchemas'
import { dayKeyFromStored, nextDayStart, resolveDayStart } from '../utils/day'

// Список записів прийому їжі за добу (?date=YYYY-MM-DD; за замовчуванням — сьогодні
// у зоні застосунку) разом із денними сумами калорій/БЖВ.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const q = getQuery(event)
  const dateStr = typeof q.date === 'string' && DATE_RE.test(q.date) ? q.date : null
  const dayStart = resolveDayStart(dateStr)
  const dayEnd = nextDayStart(dayStart)

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
    date: dayKeyFromStored(dayStart),
    entries: entries.map(toMealResponse),
    totals,
  }
})
