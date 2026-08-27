import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { findAccessibleFoodById } from '../../utils/foodItem'

const bodySchema = z.object({
  foodItemId: z.string().min(1),
})

// Додає страву до улюблених користувача.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  assertRateLimit(event, {
    prefix: 'food-items/favorite',
    key: user.id,
    limit: 60,
    windowMs: 60_000,
  })

  const body = await readValidatedBody(event, (b) => bodySchema.safeParse(b))
  if (!body.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: body.error.issues[0]?.message ?? 'Некоректний запит',
    })
  }

  const food = await findAccessibleFoodById(prisma, user.id, body.data.foodItemId)
  if (!food) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Страву не знайдено' })
  }

  await prisma.foodFavorite.upsert({
    where: { userId_foodItemId: { userId: user.id, foodItemId: food.id } },
    update: {},
    create: { userId: user.id, foodItemId: food.id },
  })

  return { ok: true, foodItemId: food.id, favorite: true }
})
