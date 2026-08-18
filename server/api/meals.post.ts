import { mealCreateSchema } from '../utils/foodSchemas'
import { prisma } from '../utils/prisma'
import { normalizeFoodKey } from '../utils/crypto'
import { recomputeDailyAggregate, startOfDay } from '../utils/aggregates'
import { toMealResponse, toPer100 } from '../utils/food'
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

  const per100 = toPer100(data)
  const rawAiJson =
    data.rawAiJson === undefined ? undefined : (data.rawAiJson as Prisma.InputJsonValue)

  const created = await prisma.$transaction(async (tx) => {
    let foodItemId = data.foodItemId ?? null

    // Якщо конкретний запис довідника не заданий — знаходимо/створюємо за назвою.
    // Наявні записи НЕ перезаписуємо (update: {}), щоб AI не псував curated-дані.
    if (!foodItemId) {
      const normalizedKey = normalizeFoodKey(data.name)
      const item = await tx.foodItem.upsert({
        where: { normalizedKey },
        update: {},
        create: {
          name: data.name,
          normalizedKey,
          ...per100,
          source: data.source === 'MANUAL' ? 'USER' : 'AI',
        },
        select: { id: true },
      })
      foodItemId = item.id
    }

    const entry = await tx.mealEntry.create({
      data: {
        userId: user.id,
        foodItemId,
        date: dayStart,
        slot: data.slot ?? null,
        portionGrams: data.portionGrams,
        kcal: data.kcal,
        protein: data.protein,
        fat: data.fat,
        carb: data.carb,
        source: data.source,
        confidence: data.confidence ?? null,
        rawAiJson,
      },
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

    const totals = await recomputeDailyAggregate(user.id, dayStart, tx)
    return { entry, totals }
  })

  return { meal: toMealResponse(created.entry), totals: created.totals }
})
