import { apiTokenRequestSchema } from '../../utils/authSchemas'
import { prisma } from '../../utils/prisma'
import { issueApiToken } from '../../utils/apiToken'

// Видача особистого Bearer-токена за email+паролем (для мобільного застосунку).
// Токен повертається РІВНО ОДИН РАЗ — далі в БД лише його SHA-256 хеш.
export default defineEventHandler(async (event) => {
  assertRateLimit(event, {
    prefix: 'auth/token',
    limit: 10,
    windowMs: 60_000,
  })

  const body = await readValidatedBody(event, (b) => apiTokenRequestSchema.safeParse(b))
  if (!body.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: body.error.issues[0]?.message ?? 'Некоректні дані',
    })
  }

  const { email, password, name } = body.data

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, passwordHash: true },
  })

  // Однакова відповідь для неіснуючого / OAuth-only / невірного пароля.
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

  const issued = await issueApiToken(user.id, name)

  return {
    token: issued.token,
    tokenId: issued.id,
    expiresAt: issued.expiresAt,
    user: { id: user.id, email: user.email },
  }
})
