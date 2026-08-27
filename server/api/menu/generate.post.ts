import { prisma } from '../../utils/prisma'
import { normalizeFoodKey } from '../../utils/crypto'
import { startOfWeekFromKey, todayKey } from '../../utils/day'
import { getUserDishes, pickRandom } from '../../utils/myDishes'
import { toPer100 } from '../../utils/food'
import { menuGenerateSchema } from '../../utils/menuSchemas'
import { toMenuPlanResponse } from '../../utils/menuResponse'
import { mapAccessibleFoodsByKeys, resolveFoodItemForMeal } from '../../utils/foodItem'
import { AiProviderError, generateWeeklyMenu, statusForAiError } from '../../ai'
import { scheduleEnsureEmbedding } from '../../ai/embeddings'
import type { Goal } from '../../../prisma/generated/client/enums'

// Генерація меню на тиждень: норми профілю + знайомі страви користувача → AI → збереження.

const GOAL_LABELS: Record<Goal, string> = {
  LOSE: 'схуднення',
  MAINTAIN: 'підтримка ваги',
  GAIN: 'набір маси',
}

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  assertRateLimit(event, {
    prefix: 'menu/generate',
    key: user.id,
    limit: 10,
    windowMs: 60_000,
  })

  const body = await readValidatedBody(event, (b) => menuGenerateSchema.safeParse(b))
  if (!body.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: body.error.issues[0]?.message ?? 'Некоректний запит генерації меню',
    })
  }

  const data = body.data
  const startDate = startOfWeekFromKey(data.startDate ? data.startDate : todayKey())

  const [profile, candidates] = await Promise.all([
    prisma.profile.findUnique({
      where: { userId: user.id },
      select: { dailyKcal: true, proteinGrams: true, fatGrams: true, carbGrams: true, goal: true },
    }),
    getUserDishes(user.id, 40),
  ])

  try {
    const result = await generateWeeklyMenu({
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
        // Невелика ВИПАДКОВА вибірка знайомих страв (замість усього топ-списку) —
        // щоб меню не зациклювалось на одних і тих самих стравах і різнилось між генераціями.
        candidates: pickRandom(candidates, 8).map((c) => ({ name: c.name, per100: c.per100 })),
      },
    })

    // Best-effort привʼязка згенерованих страв до наявного довідника (за нормалізованим ключем).
    const keys = new Map<string, string>()
    for (const day of result.data.days) {
      for (const meal of day.meals) keys.set(normalizeFoodKey(meal.name), meal.name)
    }
    const idByKey = await mapAccessibleFoodsByKeys(prisma, user.id, [...keys.keys()])

    // Нові страви (без збігу в довіднику) — приватні FoodItem користувача.
    const newFoodItemIds: string[] = []

    const plan = await prisma.$transaction(async (tx) => {
      const createdPlan = await tx.menuPlan.create({ data: { userId: user.id, startDate } })

      const itemsData = []
      for (const day of result.data.days) {
        for (const meal of day.meals) {
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
            planId: createdPlan.id,
            dayIndex: day.dayIndex,
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
      }
      await tx.menuItem.createMany({ data: itemsData })

      return tx.menuPlan.findUniqueOrThrow({
        where: { id: createdPlan.id },
        include: { items: { orderBy: [{ dayIndex: 'asc' }] } },
      })
    })

    // Після коміту: не блокуємо відповідь на HTTP embeddings.
    for (const id of newFoodItemIds) scheduleEnsureEmbedding(id, user.id)

    return {
      plan: toMenuPlanResponse(plan),
      provider: result.provider,
      model: result.model,
      usingFallback: result.usingFallback,
    }
  } catch (err) {
    if (err instanceof AiProviderError) {
      console.error('[menu/generate] AI-провайдер:', err.provider, err.kind, err.message)
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
