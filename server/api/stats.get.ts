import { getQuery } from 'h3'
import { prisma } from '../utils/prisma'
import { startOfDay, nextDay } from '../utils/aggregates'
import { GOAL_ADJUSTMENTS } from '../utils/mifflin'

// Енергетичний еквівалент 1 кг маси тіла (≈7700 ккал) для оцінки зміни ваги.
const KCAL_PER_KG = 7700

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
  burned: number
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

  const [aggregates, profile, exerciseLogs] = await Promise.all([
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
      select: { dailyKcal: true, proteinGrams: true, fatGrams: true, carbGrams: true, goal: true },
    }),
    prisma.exerciseLog.findMany({
      where: { userId: user.id, performedAt: { gte: fromStart, lt: rangeEnd } },
      select: { performedAt: true, kcalBurned: true },
    }),
  ])

  // Мапа за ключем доби для швидкого заповнення нулями.
  const byDate = new Map<string, (typeof aggregates)[number]>()
  for (const agg of aggregates) byDate.set(dateKey(agg.date), agg)

  // Спалені калорії групуємо по добі (performedAt — timestamp, тому бакетимо у JS).
  const burnedByDate = new Map<string, number>()
  for (const log of exerciseLogs) {
    const key = dateKey(log.performedAt)
    burnedByDate.set(key, (burnedByDate.get(key) ?? 0) + (log.kcalBurned ?? 0))
  }

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
      burned: burnedByDate.get(key) ?? 0,
    })
    cursor.setDate(cursor.getDate() + 1)
  }

  const totals: Macros = { kcal: 0, protein: 0, fat: 0, carb: 0 }
  let loggedDays = 0
  let burnedTotal = 0
  let activeDays = 0 // дні зі спаленими калоріями
  for (const d of days) {
    totals.kcal += d.kcal
    totals.protein += d.protein
    totals.fat += d.fat
    totals.carb += d.carb
    burnedTotal += d.burned
    if (d.kcal > 0 || d.protein > 0 || d.fat > 0 || d.carb > 0) loggedDays++
    if (d.burned > 0) activeDays++
  }

  // Нетто = спожито − спалено (за весь період).
  const netTotal = totals.kcal - burnedTotal
  // Середнє спалених — по днях з активністю, щоб дні відпочинку не занижували показник.
  const burnedAvg = activeDays ? burnedTotal / activeDays : 0

  // Середні рахуємо по днях із записами, щоб дні без логування не занижували показник.
  const divisor = loggedDays || 1
  const averages: Macros = {
    kcal: loggedDays ? totals.kcal / divisor : 0,
    protein: loggedDays ? totals.protein / divisor : 0,
    fat: loggedDays ? totals.fat / divisor : 0,
    carb: loggedDays ? totals.carb / divisor : 0,
  }

  // Відновлюємо TDEE (підтримку) зі збереженої цільової норми та цілі:
  // dailyKcal = TDEE * (1 + корекція за ціллю) → TDEE = dailyKcal / (1 + корекція).
  const goalAdj = profile ? GOAL_ADJUSTMENTS[profile.goal] : 0
  const tdee =
    profile?.dailyKcal != null ? Math.round(profile.dailyKcal / (1 + goalAdj)) : null

  // Орієнтовна зміна ваги: рахуємо тільки по днях із записами (unlogged дні не
  // вважаємо «нульовим» споживанням, щоб не завищувати дефіцит).
  // Баланс = спожито − спалено (активність) − підтримка(TDEE)×дні з записами.
  let weightEstimate: {
    kcalBalance: number
    weightChangeKg: number
    basisDays: number
    tdee: number
  } | null = null
  if (tdee != null && loggedDays > 0) {
    const maintenance = tdee * loggedDays
    const kcalBalance = totals.kcal - burnedTotal - maintenance
    weightEstimate = {
      kcalBalance,
      weightChangeKg: kcalBalance / KCAL_PER_KG,
      basisDays: loggedDays,
      tdee,
    }
  }

  return {
    range,
    from: dateKey(fromStart),
    to: dateKey(todayStart),
    totalDays,
    loggedDays,
    activeDays,
    burnedTotal,
    burnedAvg,
    netTotal,
    norms: {
      dailyKcal: profile?.dailyKcal ?? null,
      proteinGrams: profile?.proteinGrams ?? null,
      fatGrams: profile?.fatGrams ?? null,
      carbGrams: profile?.carbGrams ?? null,
      tdee,
    },
    weightEstimate,
    days,
    totals,
    averages,
  }
})
