import { getRouterParam } from 'h3'
import { mealUpdateSchema } from '../../utils/foodSchemas'
import { prisma } from '../../utils/prisma'
import { normalizeFoodKey } from '../../utils/crypto'
import { recomputeDailyAggregate, startOfDay } from '../../utils/aggregates'
import { toMealResponse, toPer100 } from '../../utils/food'

// Редагування наявного запису прийому їжі: назва, порція, БЖВ, прийом їжі.
// День запису не змінюється; при зміні назви пере-привʼязуємо FoodItem (upsert
// без перезапису curated-даних) і перераховуємо денний агрегат.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  assertRateLimit(event, {
    prefix: 'meals/patch',
    key: user.id,
    limit: 60,
    windowMs: 60_000,
  })

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'Не вказано id запису' })
  }

  const existing = await prisma.mealEntry.findUnique({
    where: { id },
    select: { id: true, userId: true, date: true },
  })

  // 404 і для чужого запису, щоб не розкривати його існування.
  if (!existing || existing.userId !== user.id) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Запис не знайдено' })
  }

  const body = await readValidatedBody(event, (b) => mealUpdateSchema.safeParse(b))
  if (!body.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: body.error.issues[0]?.message ?? 'Некоректні дані запису',
    })
  }

  const data = body.data
  const dayStart = startOfDay(existing.date)
  const per100 = toPer100(data)

  const updated = await prisma.$transaction(async (tx) => {
    let foodItemId = data.foodItemId ?? null

    // Якщо конкретний запис довідника не заданий — знаходимо/створюємо за назвою.
    if (!foodItemId) {
      const normalizedKey = normalizeFoodKey(data.name)
      const item = await tx.foodItem.upsert({
        where: { normalizedKey },
        update: {},
        create: {
          name: data.name,
          normalizedKey,
          ...per100,
          source: (data.source ?? 'MANUAL') === 'MANUAL' ? 'USER' : 'AI',
        },
        select: { id: true },
      })
      foodItemId = item.id
    }

    const entry = await tx.mealEntry.update({
      where: { id },
      data: {
        foodItemId,
        slot: data.slot ?? null,
        portionGrams: data.portionGrams,
        kcal: data.kcal,
        protein: data.protein,
        fat: data.fat,
        carb: data.carb,
        ...(data.source ? { source: data.source } : {}),
        confidence: data.confidence ?? null,
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

  return { meal: toMealResponse(updated.entry), totals: updated.totals }
})
