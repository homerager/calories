import { pushUnsubscribeSchema } from '../../utils/pushSchemas'
import { prisma } from '../../utils/prisma'

// Видаляє підписку Web Push цього браузера (лише якщо належить поточному користувачу).
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const body = await readValidatedBody(event, (b) => pushUnsubscribeSchema.safeParse(b))
  if (!body.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: body.error.issues[0]?.message ?? 'Некоректні дані підписки',
    })
  }

  await prisma.pushSubscription.deleteMany({
    where: { endpoint: body.data.endpoint, userId: user.id },
  })

  return { ok: true }
})
