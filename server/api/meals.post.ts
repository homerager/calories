import { mealCreateSchema } from '../utils/foodSchemas'
import { startOfDay } from '../utils/aggregates'
import { createMealEntry } from '../utils/mealCreate'
import type { Prisma } from '../../prisma/generated/client/client'

// Підтвердження/редагування розпізнаного (або ручне додавання) → MealEntry.
// Гарантовано звʼязує запис із FoodItem (для назви), робить upsert довідника
// (без перезапису наявних curated-записів) і перераховує денний агрегат.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  assertRateLimit(event, {
    prefix: 'meals/post',
    key: user.id,
    limit: 60,
    windowMs: 60_000,
  })

  const body = await readValidatedBody(event, (b) => mealCreateSchema.safeParse(b))
  if (!body.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: body.error.issues[0]?.message ?? 'Некоректні дані запису',
    })
  }

  const data = body.data
  // Дату фіксуємо на полудень UTC, щоб нормалізація до доби була стабільною.
  const baseDate = data.date ? new Date(`${data.date}T12:00:00.000Z`) : new Date()
  const dayStart = startOfDay(baseDate)

  const rawAiJson =
    data.rawAiJson === undefined ? undefined : (data.rawAiJson as Prisma.InputJsonValue)

  return await createMealEntry({
    userId: user.id,
    dayStart,
    name: data.name,
    portionGrams: data.portionGrams,
    kcal: data.kcal,
    protein: data.protein,
    fat: data.fat,
    carb: data.carb,
    slot: data.slot ?? null,
    source: data.source,
    confidence: data.confidence ?? null,
    foodItemId: data.foodItemId ?? null,
    rawAiJson,
  })
})
