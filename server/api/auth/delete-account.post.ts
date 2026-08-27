import { deleteAccountSchema } from '../../utils/authSchemas'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const { user } = session

  assertRateLimit(event, {
    prefix: 'auth/delete-account',
    key: user.id,
    limit: 5,
    windowMs: 60_000,
  })

  const body = await readValidatedBody(event, (b) => deleteAccountSchema.safeParse(b))
  if (!body.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: body.error.issues[0]?.message ?? 'Підтвердіть видалення',
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
    if (!body.data.password) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: 'Вкажіть пароль для підтвердження',
      })
    }
    const ok = await verifyPassword(row.passwordHash, body.data.password)
    if (!ok) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized',
        message: 'Невірний пароль',
      })
    }
  }

  await prisma.user.delete({ where: { id: user.id } })
  await clearUserSession(event)
  return { ok: true }
})
