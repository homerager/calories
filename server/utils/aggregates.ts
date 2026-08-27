import type { Prisma } from '../../prisma/generated/client/client'
import { prisma } from './prisma'
import { asDayStart, nextDayStart } from './day'

// Перерахунок денного агрегату (DailyAggregate) із записів MealEntry.
// Викликається після будь-якої зміни записів дня (create/update/delete).
// Дата дня — UTC-північ YYYY-MM-DD (див. server/utils/day.ts).

/** Клієнт БД: або основний prisma, або транзакційний клієнт. */
export type DbClient = Prisma.TransactionClient | typeof prisma

/** @deprecated використовуйте asDayStart з ./day; лишаємо аліас для викликів агрегатів. */
export const startOfDay = asDayStart

/** @deprecated використовуйте nextDayStart з ./day. */
export const nextDay = nextDayStart

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
