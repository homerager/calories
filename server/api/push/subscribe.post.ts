import { pushSubscribeSchema } from '../../utils/pushSchemas'
import { prisma } from '../../utils/prisma'

// Реєструє (або перевідповідає власнику) підписку Web Push цього браузера.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const body = await readValidatedBody(event, (b) => pushSubscribeSchema.safeParse(b))
  if (!body.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: body.error.issues[0]?.message ?? 'Некоректні дані підписки',
    })
  }

  const { endpoint, keys } = body.data

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { userId: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    update: { userId: user.id, p256dh: keys.p256dh, auth: keys.auth },
  })

  return { ok: true }
})
