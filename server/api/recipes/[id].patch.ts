import { getRouterParam } from 'h3'
import { Prisma } from '../../../prisma/generated/client/client'
import { prisma } from '../../utils/prisma'
import { recipeUpdateSchema } from '../../utils/recipeSchemas'
import { normalizeFoodKey } from '../../utils/crypto'
import { findMenuDishById, toRecipeResponse } from '../../utils/recipe'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  assertRateLimit(event, {
    prefix: 'recipes/patch',
    key: user.id,
    limit: 30,
    windowMs: 60_000,
  })

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'Не вказано id страви' })
  }

  const existing = await findMenuDishById(prisma, id)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Страву не знайдено' })
  }

  const body = await readValidatedBody(event, (b) => recipeUpdateSchema.safeParse(b))
  if (!body.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: body.error.issues[0]?.message ?? 'Некоректні дані страви',
    })
  }

  const data = body.data
  if (
    data.name === undefined &&
    data.slot === undefined &&
    data.portionGrams === undefined &&
    data.kcal === undefined &&
    data.protein === undefined &&
    data.fat === undefined &&
    data.carb === undefined &&
    data.details === undefined
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Немає полів для оновлення',
    })
  }

  let normalizedKey: string | undefined
  if (data.name !== undefined) {
    normalizedKey = normalizeFoodKey(data.name)
    if (!normalizedKey) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: 'Вкажіть назву страви',
      })
    }
    const clash = await prisma.menuDish.findFirst({
      where: { normalizedKey, id: { not: id } },
      select: { id: true },
    })
    if (clash) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Conflict',
        message: 'Страва з такою назвою вже є в каталозі',
      })
    }
  }

  const row = await prisma.menuDish.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name, normalizedKey } : {}),
      ...(data.slot !== undefined ? { slot: data.slot } : {}),
      ...(data.portionGrams !== undefined ? { portionGrams: data.portionGrams } : {}),
      ...(data.kcal !== undefined ? { kcal: data.kcal } : {}),
      ...(data.protein !== undefined ? { protein: data.protein } : {}),
      ...(data.fat !== undefined ? { fat: data.fat } : {}),
      ...(data.carb !== undefined ? { carb: data.carb } : {}),
      ...(data.details !== undefined
        ? { detailsJson: data.details as unknown as Prisma.InputJsonValue }
        : {}),
    },
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
      updatedAt: true,
    },
  })

  return { recipe: toRecipeResponse(row) }
})
