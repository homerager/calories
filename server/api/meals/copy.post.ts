import { mealCopySchema } from '../../utils/foodSchemas'
import { prisma } from '../../utils/prisma'
import { dayKeyFromStored, nextDayStart, resolveDayStart, todayKey } from '../../utils/day'
import { createMealEntry } from '../../utils/mealCreate'
import type { DailyTotals } from '../../utils/aggregates'



// Копіює всі записи прийому їжі з fromDate на toDate (дописує, не замінює).
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  assertRateLimit(event, {
    prefix: 'meals/copy',
    key: user.id,
    limit: 20,
    windowMs: 60_000,
  })

  const body = await readValidatedBody(event, (b) => mealCopySchema.safeParse(b))
  if (!body.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: body.error.issues[0]?.message ?? 'Некоректний запит копіювання',
    })
  }

  const fromStart = resolveDayStart(body.data.fromDate)
  const toStart = resolveDayStart(body.data.toDate)
  if (dayKeyFromStored(toStart) > todayKey()) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Не можна копіювати в майбутній день',
    })
  }
  if (fromStart.getTime() === toStart.getTime()) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Оберіть інший день-джерело',
    })
  }

  const sources = await prisma.mealEntry.findMany({
    where: { userId: user.id, date: { gte: fromStart, lt: nextDayStart(fromStart) } },
    orderBy: { createdAt: 'asc' },
    select: {
      slot: true,
      portionGrams: true,
      kcal: true,
      protein: true,
      fat: true,
      carb: true,
      source: true,
      confidence: true,
      foodItemId: true,
      foodItem: { select: { name: true } },
    },
  })

  if (sources.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'У день-джерело немає записів',
    })
  }

  let totals: DailyTotals = { totalKcal: 0, totalProtein: 0, totalFat: 0, totalCarb: 0 }
  await prisma.$transaction(async (tx) => {
    for (const item of sources) {
      const res = await createMealEntry(
        {
          userId: user.id,
          dayStart: toStart,
          name: item.foodItem?.name ?? 'Страва',
          portionGrams: item.portionGrams,
          kcal: item.kcal,
          protein: item.protein,
          fat: item.fat,
          carb: item.carb,
          slot: item.slot,
          source: item.source === 'AI_PHOTO' || item.source === 'AI_TEXT' ? 'MANUAL' : item.source,
          confidence: item.confidence,
          foodItemId: item.foodItemId,
        },
        tx,
      )
      totals = res.totals
    }
  })

  return {
    copied: sources.length,
    date: dayKeyFromStored(toStart),
    totals,
  }
})
