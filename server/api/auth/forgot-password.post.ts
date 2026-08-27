import { forgotPasswordSchema } from '../../utils/authSchemas'
import { prisma } from '../../utils/prisma'
import { issuePasswordReset, sendPasswordResetEmail } from '../../utils/passwordReset'

// Завжди 200 — не розкриваємо, чи існує акаунт.
export default defineEventHandler(async (event) => {
  assertRateLimit(event, {
    prefix: 'auth/forgot',
    limit: 5,
    windowMs: 60_000,
  })

  const body = await readValidatedBody(event, (b) => forgotPasswordSchema.safeParse(b))
  if (!body.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: body.error.issues[0]?.message ?? 'Некоректний email',
    })
  }

  const user = await prisma.user.findUnique({
    where: { email: body.data.email },
    select: { id: true, email: true, passwordHash: true },
  })

  if (user?.passwordHash) {
    const { token } = await issuePasswordReset(user.id)
    await sendPasswordResetEmail(user.email, token)
  }

  return { ok: true }
})
