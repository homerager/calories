import { prisma } from '../../utils/prisma'
import { menuItemDetailsSchema } from '../../utils/menuSchemas'
import { findMenuDishByName, parseRecipeJson, upsertMenuDish } from '../../utils/recipe'
import { AiProviderError, generateDishDetails, statusForAiError } from '../../ai'
import type { DishDetails } from '../../ai'
import type { Prisma } from '../../../prisma/generated/client/client'

// Деталі страви меню. Порядок кешу: MenuItem.detailsJson → глобальний MenuDish → AI.

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  assertRateLimit(event, {
    prefix: 'menu/item-details',
    key: user.id,
    limit: 30,
    windowMs: 60_000,
  })

  const body = await readValidatedBody(event, (b) => menuItemDetailsSchema.safeParse(b))
  if (!body.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: body.error.issues[0]?.message ?? 'Некоректний запит деталей',
    })
  }

  const item = await prisma.menuItem.findUnique({
    where: { id: body.data.itemId },
    select: {
      id: true,
      name: true,
      slot: true,
      portionGrams: true,
      kcal: true,
      protein: true,
      fat: true,
      carb: true,
      detailsJson: true,
      foodItemId: true,
      plan: { select: { userId: true } },
    },
  })

  if (!item || item.plan.userId !== user.id) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Страву не знайдено' })
  }

  const meal = item

  async function persistGlobal(details: DishDetails) {
    await upsertMenuDish(prisma, {
      name: meal.name,
      slot: meal.slot,
      portionGrams: meal.portionGrams,
      kcal: meal.kcal,
      protein: meal.protein,
      fat: meal.fat,
      carb: meal.carb,
      details,
      foodItemId: meal.foodItemId,
    })
  }

  const local = parseRecipeJson(meal.detailsJson)
  if (local) {
    await persistGlobal(local)
    return { details: local, cacheHit: true }
  }

  const global = await findMenuDishByName(prisma, meal.name)
  const globalDetails = global ? parseRecipeJson(global.detailsJson) : null
  if (globalDetails) {
    await prisma.menuItem.update({
      where: { id: meal.id },
      data: { detailsJson: globalDetails as unknown as Prisma.InputJsonValue },
    })
    return { details: globalDetails, cacheHit: true }
  }

  try {
    const result = await generateDishDetails({
      userId: user.id,
      preferred: body.data.provider,
      input: {
        name: meal.name,
        portionGrams: meal.portionGrams,
        kcal: meal.kcal,
        protein: meal.protein,
        fat: meal.fat,
        carb: meal.carb,
      },
    })

    await prisma.menuItem.update({
      where: { id: meal.id },
      data: { detailsJson: result.data as unknown as Prisma.InputJsonValue },
    })
    await persistGlobal(result.data)

    return {
      details: result.data,
      cacheHit: false,
      provider: result.provider,
      model: result.model,
      usingFallback: result.usingFallback,
    }
  } catch (err) {
    if (err instanceof AiProviderError) {
      console.error('[menu/item-details] AI-провайдер:', err.provider, err.kind, err.message)
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
