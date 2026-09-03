import { z } from 'zod'
import { prisma } from '../../utils/prisma'

const schema = z.object({
  token: z.string().min(20, 'Некоректний FCM-токен').max(4096),
  platform: z.string().max(20).optional(),
})

// Реєструє (або перевідповідає власнику) FCM-токен пристрою для push-сповіщень.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  assertRateLimit(event, { prefix: 'push/fcm-subscribe', key: user.id, limit: 30, windowMs: 60_000 })

  const body = await readValidatedBody(event, (b) => schema.safeParse(b))
  if (!body.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: body.error.issues[0]?.message ?? 'Некоректні дані',
    })
  }

  const { token, platform } = body.data
  await prisma.fcmToken.upsert({
    where: { token },
    create: { userId: user.id, token, platform: platform ?? null },
    update: { userId: user.id, platform: platform ?? null, lastSeenAt: new Date() },
  })

  return { ok: true }
})
