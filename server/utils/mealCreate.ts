import type { Prisma } from '../../prisma/generated/client/client'
import type { MealSlot, MealSource } from '../../prisma/generated/client/enums'
import { prisma } from './prisma'
import { recomputeDailyAggregate, type DailyTotals, type DbClient } from './aggregates'
import { toMealResponse, toPer100, type MealResponse } from './food'
import { scheduleEnsureEmbedding } from '../ai/embeddings'
import { resolveFoodItemForMeal } from './foodItem'

// Спільна логіка створення запису прийому їжі: гарантований звʼязок із FoodItem
// (upsert довідника без перезапису curated-даних) + перерахунок денного агрегату.
// Використовується POST /api/meals та POST /api/menu/apply.

export interface CreateMealInput {
  userId: string
  /** Початок доби (нормалізований), до якого відноситься запис. */
  dayStart: Date
  name: string
  portionGrams: number
  kcal: number
  protein: number
  fat: number
  carb: number
  slot?: MealSlot | null
  source: MealSource
  confidence?: number | null
  /** Якщо задано — привʼязка до наявного FoodItem (без upsert). */
  foodItemId?: string | null
  rawAiJson?: Prisma.InputJsonValue
}

const MEAL_SELECT = {
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
} as const

/**
 * Створює один MealEntry у межах транзакції (upsert FoodItem за назвою, якщо
 * foodItemId не заданий) і перераховує денний агрегат. Повертає DTO + суми.
 * Якщо передано зовнішній транзакційний клієнт `tx` — працює в ньому без
 * власної транзакції (для батч-створення кількох записів).
 */
export async function createMealEntry(
  input: CreateMealInput,
  tx?: DbClient,
): Promise<{ meal: MealResponse; totals: DailyTotals }> {
  const per100 = toPer100(input)

  const run = async (db: DbClient) => {
    const foodItemId = await resolveFoodItemForMeal(
      db,
      input.userId,
      input.name,
      per100,
      input.source,
      input.foodItemId,
    )

    const entry = await db.mealEntry.create({
      data: {
        userId: input.userId,
        foodItemId,
        date: input.dayStart,
        slot: input.slot ?? null,
        portionGrams: input.portionGrams,
        kcal: input.kcal,
        protein: input.protein,
        fat: input.fat,
        carb: input.carb,
        source: input.source,
        confidence: input.confidence ?? null,
        rawAiJson: input.rawAiJson,
      },
      select: MEAL_SELECT,
    })

    const totals = await recomputeDailyAggregate(input.userId, input.dayStart, db)
    return { entry, totals, foodItemId }
  }

  const created = tx ? await run(tx) : await prisma.$transaction((t) => run(t))
  // Після коміту: не блокуємо відповідь на HTTP embeddings.
  if (!tx) scheduleEnsureEmbedding(created.foodItemId, input.userId)
  return { meal: toMealResponse(created.entry), totals: created.totals }
}
