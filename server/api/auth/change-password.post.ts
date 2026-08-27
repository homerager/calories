import { changePasswordSchema } from '../../utils/authSchemas'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  assertRateLimit(event, {
    prefix: 'auth/change-password',
    key: user.id,
    limit: 10,
    windowMs: 60_000,
  })

  const body = await readValidatedBody(event, (b) => changePasswordSchema.safeParse(b))
  if (!body.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: body.error.issues[0]?.message ?? 'Некоректні дані',
    })
  }

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, passwordHash: true },
  })
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Користувача не знайдено' })
  }

  if (row.passwordHash) {
    if (!body.data.currentPassword) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: 'Вкажіть поточний пароль',
      })
    }
    const ok = await verifyPassword(row.passwordHash, body.data.currentPassword)
    if (!ok) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized',
        message: 'Невірний поточний пароль',
      })
    }
  }

  const passwordHash = await hashPassword(body.data.newPassword)
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  })

  return { ok: true }
})
