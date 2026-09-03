import { z } from 'zod'
import { prisma } from '../../utils/prisma'

const schema = z.object({ token: z.string().min(1).max(4096) })

// Видаляє FCM-токен пристрою (вихід / вимкнення сповіщень у застосунку).
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const body = await readValidatedBody(event, (b) => schema.safeParse(b))
  if (!body.success) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'Некоректні дані' })
  }

  await prisma.fcmToken.deleteMany({ where: { token: body.data.token, userId: user.id } })
  return { ok: true }
})
