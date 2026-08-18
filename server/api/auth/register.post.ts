import { credentialsSchema } from '../../utils/authSchemas'
import { prisma } from '../../utils/prisma'

// Реєстрація за email+паролем. Створює User з scrypt-хешем і відкриває сесію.
export default defineEventHandler(async (event) => {
  // М'який rate limit на реєстрацію (за IP).
  assertRateLimit(event, {
    prefix: 'auth/register',
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

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Conflict',
      message: 'Користувач із таким email вже існує',
    })
  }

  const passwordHash = await hashPassword(password)

  const user = await prisma.user.create({
    data: { email, passwordHash },
    select: { id: true, email: true },
  })

  await setUserSession(event, {
    user: { id: user.id, email: user.email },
    loggedInAt: Date.now(),
  })

  return { user }
})
