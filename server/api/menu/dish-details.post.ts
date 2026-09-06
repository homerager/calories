import { prisma } from '../../utils/prisma'
import { dishDetailsLookupSchema } from '../../utils/menuSchemas'
import { findAccessibleFoodByKey, foodVisibilityWhere } from '../../utils/foodItem'
import { normalizeFoodKey } from '../../utils/crypto'
import { roundKcal, roundMacro } from '../../utils/food'
import { findMenuDishByName, parseRecipeJson, upsertMenuDish } from '../../utils/recipe'
import { AiProviderError, generateDishDetails, statusForAiError } from '../../ai'
import type { DishDetails, DishDetailsInput } from '../../ai'

// Деталі страви для сторінки меню: глобальний MenuDish → памʼять процесу → AI.

const detailsCache = new Map<string, DishDetails>()
const CACHE_MAX = 500

function cacheSet(key: string, value: DishDetails): void {
  if (detailsCache.size >= CACHE_MAX) {
    const oldest = detailsCache.keys().next().value
    if (oldest) detailsCache.delete(oldest)
  }
  detailsCache.set(key, value)
}

interface FoodRow {
  name: string
  kcalPer100: number
  proteinPer100: number
  fatPer100: number
  carbPer100: number
}

function inputFromFood(food: FoodRow): DishDetailsInput {
  return {
    name: food.name,
    portionGrams: 100,
    kcal: roundKcal(food.kcalPer100),
    protein: roundMacro(food.proteinPer100),
    fat: roundMacro(food.fatPer100),
    carb: roundMacro(food.carbPer100),
  }
}

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  assertRateLimit(event, {
    prefix: 'menu/dish-details',
    key: user.id,
    limit: 30,
    windowMs: 60_000,
  })

  const body = await readValidatedBody(event, (b) => dishDetailsLookupSchema.safeParse(b))
  if (!body.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: body.error.issues[0]?.message ?? 'Некоректний запит деталей',
    })
  }

  const { foodItemId, name, provider } = body.data

  let cacheKey: string
  let aiInput: DishDetailsInput
  let resolvedName: string
  let resolvedFoodItemId: string | null = null

  if (foodItemId) {
    const food = await prisma.foodItem.findFirst({
      where: { id: foodItemId, ...foodVisibilityWhere(user.id) },
      select: {
        id: true,
        name: true,
        kcalPer100: true,
        proteinPer100: true,
        fatPer100: true,
        carbPer100: true,
      },
    })
    if (!food) {
      throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Страву не знайдено' })
    }
    cacheKey = `id:${food.id}`
    aiInput = inputFromFood(food)
    resolvedName = food.name
    resolvedFoodItemId = food.id
  } else {
    const key = normalizeFoodKey(name!)
    const match = await findAccessibleFoodByKey(prisma, user.id, key)
    if (match) {
      cacheKey = `id:${match.id}`
      aiInput = inputFromFood(match)
      resolvedName = match.name
      resolvedFoodItemId = match.id
    } else {
      cacheKey = `name:${key}`
      resolvedName = name!.trim()
      aiInput = { name: resolvedName, portionGrams: 100, kcal: 0, protein: 0, fat: 0, carb: 0 }
    }
  }

  const global = await findMenuDishByName(prisma, resolvedName)
  const globalDetails = global ? parseRecipeJson(global.detailsJson) : null
  if (globalDetails) {
    return { details: globalDetails, cacheHit: true }
  }

  const cached = detailsCache.get(cacheKey)
  if (cached) {
    return { details: cached, cacheHit: true }
  }

  try {
    const result = await generateDishDetails({
      userId: user.id,
      preferred: provider,
      input: aiInput,
    })

    cacheSet(cacheKey, result.data)
    await upsertMenuDish(prisma, {
      name: resolvedName,
      portionGrams: aiInput.portionGrams,
      kcal: aiInput.kcal,
      protein: aiInput.protein,
      fat: aiInput.fat,
      carb: aiInput.carb,
      details: result.data,
      foodItemId: resolvedFoodItemId,
    })

    return {
      details: result.data,
      cacheHit: false,
      provider: result.provider,
      model: result.model,
      usingFallback: result.usingFallback,
    }
  } catch (err) {
    if (err instanceof AiProviderError) {
      console.error('[menu/dish-details] AI-провайдер:', err.provider, err.kind, err.message)
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
