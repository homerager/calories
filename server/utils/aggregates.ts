import type { Prisma } from '../../prisma/generated/client/client'
import { prisma } from './prisma'

// Перерахунок денного агрегату (DailyAggregate) із записів MealEntry.
// Викликається після будь-якої зміни записів дня (create/update/delete).

/** Клієнт БД: або основний prisma, або транзакційний клієнт. */
export type DbClient = Prisma.TransactionClient | typeof prisma

/** Нормалізує дату до початку доби (00:00:00.000) у локальному часі. */
export function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Наступна доба після startOfDay(date). */
export function nextDay(date: Date): Date {
  const d = startOfDay(date)
  d.setDate(d.getDate() + 1)
  return d
}

export interface DailyTotals {
  totalKcal: number
  totalProtein: number
  totalFat: number
  totalCarb: number
}

/**
 * Перераховує суми БЖВ/калорій за добу й робить upsert у DailyAggregate.
 * Якщо записів немає — агрегат обнуляється (а не видаляється), щоб зберегти історію.
 */
export async function recomputeDailyAggregate(
  userId: string,
  date: Date,
  db: DbClient = prisma,
): Promise<DailyTotals> {
  const dayStart = startOfDay(date)
  const dayEnd = nextDay(date)

  const sums = await db.mealEntry.aggregate({
    where: {
      userId,
      date: { gte: dayStart, lt: dayEnd },
    },
    _sum: {
      kcal: true,
      protein: true,
      fat: true,
      carb: true,
    },
  })

  const totals: DailyTotals = {
    totalKcal: sums._sum.kcal ?? 0,
    totalProtein: sums._sum.protein ?? 0,
    totalFat: sums._sum.fat ?? 0,
    totalCarb: sums._sum.carb ?? 0,
  }

  await db.dailyAggregate.upsert({
    where: { userId_date: { userId, date: dayStart } },
    update: { ...totals },
    create: { userId, date: dayStart, ...totals },
  })

  return totals
}

/**
 * Повертає денний агрегат (нулі, якщо запису ще немає).
 * Читання без перерахунку.
 */
export async function getDailyTotals(
  userId: string,
  date: Date,
  db: DbClient = prisma,
): Promise<DailyTotals> {
  const dayStart = startOfDay(date)
  const agg = await db.dailyAggregate.findUnique({
    where: { userId_date: { userId, date: dayStart } },
  })

  return {
    totalKcal: agg?.totalKcal ?? 0,
    totalProtein: agg?.totalProtein ?? 0,
    totalFat: agg?.totalFat ?? 0,
    totalCarb: agg?.totalCarb ?? 0,
  }
}
