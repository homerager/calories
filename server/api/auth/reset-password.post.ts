import { resetPasswordSchema } from '../../utils/authSchemas'
import { prisma } from '../../utils/prisma'
import { hashResetToken } from '../../utils/passwordReset'

export default defineEventHandler(async (event) => {
  assertRateLimit(event, {
    prefix: 'auth/reset',
    limit: 10,
    windowMs: 60_000,
  })

  const body = await readValidatedBody(event, (b) => resetPasswordSchema.safeParse(b))
  if (!body.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: body.error.issues[0]?.message ?? 'Некоректні дані',
    })
  }

  const tokenHash = hashResetToken(body.data.token)
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  })

  if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Посилання недійсне або прострочене. Запросіть скидання ще раз.',
    })
  }

  const passwordHash = await hashPassword(body.data.password)

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: row.userId },
      data: { passwordHash },
    })
    await tx.passwordResetToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    })
    await tx.passwordResetToken.updateMany({
      where: { userId: row.userId, usedAt: null, id: { not: row.id } },
      data: { usedAt: new Date() },
    })
  })

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: row.userId },
    select: { id: true, email: true },
  })

  await setUserSession(event, {
    user: { id: user.id, email: user.email },
    loggedInAt: Date.now(),
  })

  return { user }
})
