import { getRouterParam } from 'h3'
import { prisma } from '../../../utils/prisma'

// Прибирає страву з улюблених.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const foodItemId = getRouterParam(event, 'id')
  if (!foodItemId) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'Не вказано id страви' })
  }

  await prisma.foodFavorite.deleteMany({
    where: { userId: user.id, foodItemId },
  })

  return { ok: true, foodItemId, favorite: false }
})
