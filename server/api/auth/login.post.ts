import { credentialsSchema } from '../../utils/authSchemas'
import { prisma } from '../../utils/prisma'

// Вхід за email+паролем. Перевіряє scrypt-хеш і відкриває сесію.
export default defineEventHandler(async (event) => {
  // М'який rate limit на вхід (за IP) — захист від брутфорсу.
  assertRateLimit(event, {
    prefix: 'auth/login',
    limit: 10,
    windowMs: 60_000,
  })

  const body = await readValidatedBody(event, (b) => credentialsSchema.safeParse(b))
  if (!body.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: body.error.issues[0]?.message ?? 'Некоректні дані',
    })
  }

  const { email, password } = body.data

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, passwordHash: true },
  })

  // Однакова помилка для неіснуючого користувача / OAuth-only / невірного пароля,
  // щоб не розкривати наявність акаунта.
  const invalid = () =>
    createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'Невірний email або пароль',
    })

  if (!user || !user.passwordHash) {
    throw invalid()
  }

  const ok = await verifyPassword(user.passwordHash, password)
  if (!ok) {
    throw invalid()
  }

  await setUserSession(event, {
    user: { id: user.id, email: user.email },
    loggedInAt: Date.now(),
  })

  return { user: { id: user.id, email: user.email } }
})
