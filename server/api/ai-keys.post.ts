import { aiKeyUpsertSchema, upsertUserAiKey } from '../ai/keys'

// Додає або оновлює власний AI-ключ користувача (шифрується at rest).
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  assertRateLimit(event, {
    prefix: 'ai-keys/post',
    key: user.id,
    limit: 20,
    windowMs: 60_000,
  })

  const body = await readValidatedBody(event, (b) => aiKeyUpsertSchema.safeParse(b))
  if (!body.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: body.error.issues[0]?.message ?? 'Некоректний AI-ключ',
    })
  }

  const keys = await upsertUserAiKey(user.id, body.data)
  return { keys }
})
