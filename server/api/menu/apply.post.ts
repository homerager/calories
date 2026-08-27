import { prisma } from '../../utils/prisma'
import { dayKeyFromStored, resolveDayStart } from '../../utils/day'
import { createMealEntry } from '../../utils/mealCreate'
import { menuApplySchema } from '../../utils/menuSchemas'
import type { DailyTotals } from '../../utils/aggregates'

// Застосування меню у щоденник: додає страви дня (dayIndex) або одну страву (itemId)
// на обрану дату як MealEntry, переиспользуючи логіку створення записів.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  assertRateLimit(event, {
    prefix: 'menu/apply',
    key: user.id,
    limit: 60,
    windowMs: 60_000,
  })

  const body = await readValidatedBody(event, (b) => menuApplySchema.safeParse(b))
  if (!body.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: body.error.issues[0]?.message ?? 'Некоректний запит застосування меню',
    })
  }

  const data = body.data

  const plan = await prisma.menuPlan.findFirst({
    where: { id: data.planId, userId: user.id },
    include: { items: true },
  })
  if (!plan) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Меню не знайдено' })
  }

  const toApply = data.itemId
    ? plan.items.filter((it) => it.id === data.itemId)
    : plan.items.filter((it) => it.dayIndex === data.dayIndex)

  if (toApply.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Немає страв для застосування',
    })
  }

  const dayStart = resolveDayStart(data.date)

  let totals: DailyTotals = { totalKcal: 0, totalProtein: 0, totalFat: 0, totalCarb: 0 }
  await prisma.$transaction(async (tx) => {
    for (const item of toApply) {
      const res = await createMealEntry(
        {
          userId: user.id,
          dayStart,
          name: item.name,
          portionGrams: item.portionGrams,
          kcal: item.kcal,
          protein: item.protein,
          fat: item.fat,
          carb: item.carb,
          slot: item.slot,
          source: 'MANUAL',
          confidence: null,
          foodItemId: item.foodItemId,
        },
        tx,
      )
      totals = res.totals
    }
  })

  return {
    applied: toApply.length,
    date: dayKeyFromStored(dayStart),
    totals,
  }
})
