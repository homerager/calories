import { getRouterParam } from 'h3'
import { Prisma } from '../../../../prisma/generated/client/client'
import { prisma } from '../../../utils/prisma'
import { findMenuDishById, menuDishSelect, parseRecipeJson, toRecipeResponse } from '../../../utils/recipe'
import { AiProviderError, generateDishDetails, statusForAiError } from '../../../ai'

// Генерація інгредієнтів/кроків для страви з глобального каталогу.

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  assertRateLimit(event, {
    prefix: 'recipes/generate',
    key: user.id,
    limit: 30,
    windowMs: 60_000,
  })

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'Не вказано id страви' })
  }

  const dish = await findMenuDishById(prisma, id)
  if (!dish) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Страву не знайдено' })
  }

  const existing = parseRecipeJson(dish.detailsJson)
  if (existing) {
    return { recipe: toRecipeResponse(dish), cacheHit: true }
  }

  try {
    const result = await generateDishDetails({
      userId: user.id,
      input: {
        name: dish.name,
        portionGrams: dish.portionGrams,
        kcal: dish.kcal,
        protein: dish.protein,
        fat: dish.fat,
        carb: dish.carb,
      },
    })

    const row = await prisma.menuDish.update({
      where: { id: dish.id },
      data: { detailsJson: result.data as unknown as Prisma.InputJsonValue },
      select: menuDishSelect,
    })

    return {
      recipe: toRecipeResponse(row),
      cacheHit: false,
      provider: result.provider,
      model: result.model,
      usingFallback: result.usingFallback,
    }
  } catch (err) {
    if (err instanceof AiProviderError) {
      console.error('[recipes/generate] AI-провайдер:', err.provider, err.kind, err.message)
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
