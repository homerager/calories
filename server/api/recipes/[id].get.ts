import { getRouterParam } from 'h3'
import { prisma } from '../../utils/prisma'
import { findMenuDishById, toRecipeResponse } from '../../utils/recipe'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'Не вказано id страви' })
  }

  const row = await findMenuDishById(prisma, id)
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Страву не знайдено' })
  }

  return { recipe: toRecipeResponse(row) }
})
