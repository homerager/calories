import { getQuery } from 'h3'
import { prisma } from '../utils/prisma'
import { startOfDay, nextDay } from '../utils/aggregates'

// Статистика споживання за період (день / тиждень / місяць) із DailyAggregate.
// Повертає добові точки (із нулями для днів без записів), суми, середні
// (по днях із записами) та цільові норми з профілю — для прогресу відносно норм.

type StatsRange = 'day' | 'week' | 'month'

// Кількість календарних днів у діапазоні (включно з сьогоднішнім).
const RANGE_DAYS: Record<StatsRange, number> = {
  day: 1,
  week: 7,
  month: 30,
}

function parseRange(value: unknown): StatsRange {
  return value === 'day' || value === 'week' || value === 'month' ? value : 'week'
}

/** Локальний ключ доби YYYY-MM-DD (без зсуву в UTC, узгоджений зі startOfDay). */
function dateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

interface DayPoint {
  date: string
  kcal: number
  protein: number
  fat: number
  carb: number
}

interface Macros {
  kcal: number
  protein: number
  fat: number
  carb: number
}

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const q = getQuery(event)
  const range = parseRange(q.range)
  const totalDays = RANGE_DAYS[range]

  const todayStart = startOfDay(new Date())
  const fromStart = new Date(todayStart)
  fromStart.setDate(fromStart.getDate() - (totalDays - 1))
  const rangeEnd = nextDay(todayStart)

  const [aggregates, profile] = await Promise.all([
    prisma.dailyAggregate.findMany({
      where: { userId: user.id, date: { gte: fromStart, lt: rangeEnd } },
      orderBy: { date: 'asc' },
      select: {
        date: true,
        totalKcal: true,
        totalProtein: true,
        totalFat: true,
        totalCarb: true,
      },
    }),
    prisma.profile.findUnique({
      where: { userId: user.id },
      select: { dailyKcal: true, proteinGrams: true, fatGrams: true, carbGrams: true },
    }),
  ])

  // Мапа за ключем доби для швидкого заповнення нулями.
  const byDate = new Map<string, (typeof aggregates)[number]>()
  for (const agg of aggregates) byDate.set(dateKey(agg.date), agg)

  const days: DayPoint[] = []
  const cursor = new Date(fromStart)
  for (let i = 0; i < totalDays; i++) {
    const key = dateKey(cursor)
    const agg = byDate.get(key)
    days.push({
      date: key,
      kcal: agg?.totalKcal ?? 0,
      protein: agg?.totalProtein ?? 0,
      fat: agg?.totalFat ?? 0,
      carb: agg?.totalCarb ?? 0,
    })
    cursor.setDate(cursor.getDate() + 1)
  }

  const totals: Macros = { kcal: 0, protein: 0, fat: 0, carb: 0 }
  let loggedDays = 0
  for (const d of days) {
    totals.kcal += d.kcal
    totals.protein += d.protein
    totals.fat += d.fat
    totals.carb += d.carb
    if (d.kcal > 0 || d.protein > 0 || d.fat > 0 || d.carb > 0) loggedDays++
  }

  // Середні рахуємо по днях із записами, щоб дні без логування не занижували показник.
  const divisor = loggedDays || 1
  const averages: Macros = {
    kcal: loggedDays ? totals.kcal / divisor : 0,
    protein: loggedDays ? totals.protein / divisor : 0,
    fat: loggedDays ? totals.fat / divisor : 0,
    carb: loggedDays ? totals.carb / divisor : 0,
  }

  return {
    range,
    from: dateKey(fromStart),
    to: dateKey(todayStart),
    totalDays,
    loggedDays,
    norms: {
      dailyKcal: profile?.dailyKcal ?? null,
      proteinGrams: profile?.proteinGrams ?? null,
      fatGrams: profile?.fatGrams ?? null,
      carbGrams: profile?.carbGrams ?? null,
    },
    days,
    totals,
    averages,
  }
})
