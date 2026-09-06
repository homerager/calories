import { prisma } from '../utils/prisma'
import { dishDetailsSchema, recipeCreateSchema } from '../utils/recipeSchemas'
import { parseRecipeJson, toRecipeResponse, upsertMenuDish } from '../utils/recipe'
import type { MealSlot } from '../../prisma/generated/client/enums'

// Додати / оновити страву в глобальному каталозі.

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  assertRateLimit(event, {
    prefix: 'recipes/post',
    key: user.id,
    limit: 30,
    windowMs: 60_000,
  })

  const body = await readValidatedBody(event, (b) => recipeCreateSchema.safeParse(b))
  if (!body.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: body.error.issues[0]?.message ?? 'Некоректні дані страви',
    })
  }

  const data = body.data
  let name = data.name?.trim() ?? ''
  let slot: MealSlot | null = data.slot ?? null
  let details = data.details ?? null
  let portionGrams = data.portionGrams
  let macros =
    data.kcal != null && data.protein != null && data.fat != null && data.carb != null
      ? { kcal: data.kcal, protein: data.protein, fat: data.fat, carb: data.carb }
      : null
  let foodItemId = data.foodItemId ?? null

  if (data.menuItemId) {
    const item = await prisma.menuItem.findUnique({
      where: { id: data.menuItemId },
      select: {
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
      throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Страву меню не знайдено' })
    }
    name = name || item.name
    slot = slot ?? item.slot
    portionGrams = portionGrams ?? item.portionGrams
    macros = macros ?? {
      kcal: item.kcal,
      protein: item.protein,
      fat: item.fat,
      carb: item.carb,
    }
    foodItemId = foodItemId ?? item.foodItemId
    if (!details) details = parseRecipeJson(item.detailsJson)
  }

  if (!name) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Вкажіть назву страви',
    })
  }

  if (details) {
    const parsed = dishDetailsSchema.safeParse(details)
    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: parsed.error.issues[0]?.message ?? 'Некоректний рецепт',
      })
    }
    details = parsed.data
  }

  const row = await upsertMenuDish(prisma, {
    name,
    slot,
    portionGrams: portionGrams ?? 100,
    kcal: macros?.kcal ?? 0,
    protein: macros?.protein ?? 0,
    fat: macros?.fat ?? 0,
    carb: macros?.carb ?? 0,
    details,
    foodItemId,
    overwriteDetails: Boolean(details),
  })

  return { recipe: toRecipeResponse(row) }
})
