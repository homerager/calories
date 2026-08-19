import { prisma } from '../../utils/prisma'
import { normalizeFoodKey } from '../../utils/crypto'
import { startOfDay } from '../../utils/aggregates'
import { getUserDishes, pickRandom } from '../../utils/myDishes'
import { menuGenerateSchema } from '../../utils/menuSchemas'
import { toMenuPlanResponse } from '../../utils/menuResponse'
import { AiProviderError, generateWeeklyMenu, statusForAiError } from '../../ai'
import type { Goal } from '../../../prisma/generated/client/enums'

// Генерація меню на тиждень: норми профілю + знайомі страви користувача → AI → збереження.

const GOAL_LABELS: Record<Goal, string> = {
  LOSE: 'схуднення',
  MAINTAIN: 'підтримка ваги',
  GAIN: 'набір маси',
}

/** Понеділок тижня для заданої дати (нормалізований до початку доби). */
function startOfWeek(date: Date): Date {
  const d = startOfDay(date)
  const mondayOffset = (d.getDay() + 6) % 7 // Пн = 0
  d.setDate(d.getDate() - mondayOffset)
  return d
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
  const baseDate = data.startDate ? new Date(`${data.startDate}T12:00:00.000Z`) : new Date()
  const startDate = startOfWeek(baseDate)

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
    const existing = await prisma.foodItem.findMany({
      where: { normalizedKey: { in: [...keys.keys()] } },
      select: { id: true, normalizedKey: true },
    })
    const idByKey = new Map(existing.map((f) => [f.normalizedKey, f.id]))

    const plan = await prisma.$transaction(async (tx) => {
      const createdPlan = await tx.menuPlan.create({ data: { userId: user.id, startDate } })

      const itemsData = result.data.days.flatMap((day) =>
        day.meals.map((meal) => ({
          planId: createdPlan.id,
          dayIndex: day.dayIndex,
          slot: meal.slot,
          name: meal.name,
          portionGrams: meal.portionGrams,
          kcal: meal.kcal,
          protein: meal.protein,
          fat: meal.fat,
          carb: meal.carb,
          foodItemId: idByKey.get(normalizeFoodKey(meal.name)) ?? null,
        })),
      )
      await tx.menuItem.createMany({ data: itemsData })

      return tx.menuPlan.findUniqueOrThrow({
        where: { id: createdPlan.id },
        include: { items: { orderBy: [{ dayIndex: 'asc' }] } },
      })
    })

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
