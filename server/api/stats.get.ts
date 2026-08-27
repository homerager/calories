import { getQuery } from 'h3'
import { prisma } from '../utils/prisma'
import { GOAL_ADJUSTMENTS } from '../utils/mifflin'
import { decrypt } from '../utils/crypto'
import {
  addDaysToKey,
  calendarKeyInZone,
  dayKeyFromStored,
  dayStartFromKey,
  nextDayStart,
  todayKey,
  zonedDayBounds,
} from '../utils/day'

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

interface DayPoint {
  date: string
  kcal: number
  protein: number
  fat: number
  carb: number
  burned: number
  waterMl: number
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

  const today = todayKey()
  const fromKey = addDaysToKey(today, -(totalDays - 1))
  const fromStart = dayStartFromKey(fromKey)
  const rangeEnd = nextDayStart(dayStartFromKey(today))
  const { start: fromInstant } = zonedDayBounds(fromKey)
  const { end: rangeInstantEnd } = zonedDayBounds(today)

  const [aggregates, profile, exerciseLogs, weightLogs, waterLogs] = await Promise.all([
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
      where: { userId: user.id, performedAt: { gte: fromInstant, lt: rangeInstantEnd } },
      select: { performedAt: true, kcalBurned: true },
    }),
    // Усі зважування до кінця періоду (за зростанням) — щоб мати і базову точку
    // (останнє зважування до початку періоду), і зважування всередині періоду.
    prisma.weightLog.findMany({
      where: { userId: user.id, measuredAt: { lt: rangeInstantEnd } },
      orderBy: { measuredAt: 'asc' },
      select: { weightEnc: true, measuredAt: true },
    }),
    prisma.waterLog.findMany({
      where: { userId: user.id, measuredAt: { gte: fromInstant, lt: rangeInstantEnd } },
      select: { volumeMl: true, measuredAt: true },
    }),
  ])

  // Мапа за ключем доби для швидкого заповнення нулями.
  const byDate = new Map<string, (typeof aggregates)[number]>()
  for (const agg of aggregates) byDate.set(dayKeyFromStored(agg.date), agg)

  const burnedByDate = new Map<string, number>()
  for (const log of exerciseLogs) {
    const key = calendarKeyInZone(log.performedAt)
    burnedByDate.set(key, (burnedByDate.get(key) ?? 0) + (log.kcalBurned ?? 0))
  }

  const waterByDate = new Map<string, number>()
  for (const log of waterLogs) {
    const key = calendarKeyInZone(log.measuredAt)
    waterByDate.set(key, (waterByDate.get(key) ?? 0) + log.volumeMl)
  }

  const days: DayPoint[] = []
  for (let i = 0; i < totalDays; i++) {
    const key = addDaysToKey(fromKey, i)
    const agg = byDate.get(key)
    days.push({
      date: key,
      kcal: agg?.totalKcal ?? 0,
      protein: agg?.totalProtein ?? 0,
      fat: agg?.totalFat ?? 0,
      carb: agg?.totalCarb ?? 0,
      burned: burnedByDate.get(key) ?? 0,
      waterMl: waterByDate.get(key) ?? 0,
    })
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

  // Фактична зміна ваги за період із WeightLog (розшифровуємо at rest).
  // Стартова точка: останнє зважування ДО початку періоду (вага «на вході»),
  // або перше зважування всередині періоду, якщо попередніх немає.
  // Кінцева точка: останнє зважування всередині періоду.
  const decoded = weightLogs
    .map((log) => {
      let weightKg: number | null
      try {
        weightKg = Number(decrypt(log.weightEnc))
      } catch {
        weightKg = null
      }
      return weightKg != null && Number.isFinite(weightKg)
        ? { weightKg, measuredAt: log.measuredAt }
        : null
    })
    .filter((e): e is { weightKg: number; measuredAt: Date } => e !== null)

  const before = decoded.filter((e) => e.measuredAt < fromInstant)
  const inPeriod = decoded.filter((e) => e.measuredAt >= fromInstant)

  let weightActual: {
    startKg: number
    endKg: number
    changeKg: number
    startAt: string
    endAt: string
  } | null = null
  if (inPeriod.length > 0) {
    const baseline = before.length > 0 ? before[before.length - 1]! : inPeriod[0]!
    const end = inPeriod[inPeriod.length - 1]!
    // Потрібні дві різні точки виміру, інакше зміну рахувати немає з чого.
    if (baseline.measuredAt.getTime() !== end.measuredAt.getTime()) {
      weightActual = {
        startKg: baseline.weightKg,
        endKg: end.weightKg,
        changeKg: Math.round((end.weightKg - baseline.weightKg) * 10) / 10,
        startAt: baseline.measuredAt.toISOString(),
        endAt: end.measuredAt.toISOString(),
      }
    }
  }

  return {
    range,
    from: fromKey,
    to: today,
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
    weightActual,
    days,
    totals,
    averages,
  }
})
