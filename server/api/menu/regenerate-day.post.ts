import { prisma } from '../../utils/prisma'
import { normalizeFoodKey } from '../../utils/crypto'
import { getUserDishes, pickRandom } from '../../utils/myDishes'
import { toPer100 } from '../../utils/food'
import { menuRegenerateDaySchema } from '../../utils/menuSchemas'
import { toMenuPlanResponse } from '../../utils/menuResponse'
import { AiProviderError, generateMenuDay, statusForAiError } from '../../ai'
import { scheduleEnsureEmbedding } from '../../ai/embeddings'
import { mapAccessibleFoodsByKeys, resolveFoodItemForMeal } from '../../utils/foodItem'
import type { Goal } from '../../../prisma/generated/client/enums'

// Перегенерація меню для одного дня: AI складає новий день з урахуванням норм
// та знайомих страв; позиції цього dayIndex у плані заміщуються.

const GOAL_LABELS: Record<Goal, string> = {
  LOSE: 'схуднення',
  MAINTAIN: 'підтримка ваги',
  GAIN: 'набір маси',
}

const DAY_LABELS = [
  'Понеділок',
  'Вівторок',
  'Середа',
  'Четвер',
  'Пʼятниця',
  'Субота',
  'Неділя',
]

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  assertRateLimit(event, {
    prefix: 'menu/regenerate-day',
    key: user.id,
    limit: 20,
    windowMs: 60_000,
  })

  const body = await readValidatedBody(event, (b) => menuRegenerateDaySchema.safeParse(b))
  if (!body.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: body.error.issues[0]?.message ?? 'Некоректний запит перегенерації',
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

  const [profile, candidates] = await Promise.all([
    prisma.profile.findUnique({
      where: { userId: user.id },
      select: { dailyKcal: true, proteinGrams: true, fatGrams: true, carbGrams: true, goal: true },
    }),
    getUserDishes(user.id, 40),
  ])

  // Страви з інших днів — щоб уникнути повторів у перегенерованому дні.
  const avoid = [
    ...new Set(plan.items.filter((it) => it.dayIndex !== data.dayIndex).map((it) => it.name)),
  ].slice(0, 40)

  try {
    const result = await generateMenuDay({
      userId: user.id,
      preferred: data.provider,
      input: {
        targets: {
          dailyKcal: profile?.dailyKcal ?? null,
          proteinGrams: profile?.proteinGrams ?? null,
          fatGrams: profile?.fatGrams ?? null,
          carbGrams: profile?.carbGrams ?? null,
          goal: profile ? GOAL_LABELS[profile.goal] : null,
        },
        // Невелика випадкова вибірка знайомих страв — для різноманіття дня.
        candidates: pickRandom(candidates, 5).map((c) => ({ name: c.name, per100: c.per100 })),
        dayLabel: DAY_LABELS[data.dayIndex],
        avoid,
      },
    })

    // Best-effort привʼязка до довідника за нормалізованим ключем.
    const keys = new Set(result.data.meals.map((m) => normalizeFoodKey(m.name)))
    const idByKey = await mapAccessibleFoodsByKeys(prisma, user.id, [...keys])

    const newFoodItemIds: string[] = []

    const updated = await prisma.$transaction(async (tx) => {
      await tx.menuItem.deleteMany({ where: { planId: plan.id, dayIndex: data.dayIndex } })

      const itemsData = []
      for (const meal of result.data.meals) {
        const normalizedKey = normalizeFoodKey(meal.name)
        let foodItemId = idByKey.get(normalizedKey) ?? null
        if (!foodItemId) {
          foodItemId = await resolveFoodItemForMeal(
            tx,
            user.id,
            meal.name,
            toPer100(meal),
            'AI_TEXT',
            null,
          )
          idByKey.set(normalizedKey, foodItemId)
          newFoodItemIds.push(foodItemId)
        }
        itemsData.push({
          planId: plan.id,
          dayIndex: data.dayIndex,
          slot: meal.slot,
          name: meal.name,
          portionGrams: meal.portionGrams,
          kcal: meal.kcal,
          protein: meal.protein,
          fat: meal.fat,
          carb: meal.carb,
          foodItemId,
        })
      }
      await tx.menuItem.createMany({ data: itemsData })

      // Оновлюємо updatedAt плану.
      await tx.menuPlan.update({ where: { id: plan.id }, data: { updatedAt: new Date() } })

      return tx.menuPlan.findUniqueOrThrow({
        where: { id: plan.id },
        include: { items: { orderBy: [{ dayIndex: 'asc' }] } },
      })
    })

    // Після коміту: не блокуємо відповідь на HTTP embeddings.
    for (const id of newFoodItemIds) scheduleEnsureEmbedding(id, user.id)

    return {
      plan: toMenuPlanResponse(updated),
      provider: result.provider,
      model: result.model,
      usingFallback: result.usingFallback,
    }
  } catch (err) {
    if (err instanceof AiProviderError) {
      console.error('[menu/regenerate-day] AI-провайдер:', err.provider, err.kind, err.message)
      throw createError({
        statusCode: statusForAiError(err.kind),
        statusMessage: 'AI Provider Error',
        message: err.userMessage,
        data: { aiErrorKind: err.kind, provider: err.provider },
      })
    }
    throw err
  }
})
