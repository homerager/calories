import { aiSettingsUpdateSchema, buildAiSettingsResponse, upsertUserAiSettings } from '../ai/settings'

// Зберігає (upsert) персональні налаштування AI користувача.
// Порожні/відсутні поля означають повернення до базових значень із env.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  assertRateLimit(event, {
    prefix: 'ai-settings/post',
    key: user.id,
    limit: 30,
    windowMs: 60_000,
  })

  const body = await readValidatedBody(event, (b) => aiSettingsUpdateSchema.safeParse(b))
  if (!body.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: body.error.issues[0]?.message ?? 'Некоректні налаштування AI',
    })
  }

  await upsertUserAiSettings(user.id, body.data)
  return { settings: await buildAiSettingsResponse(user.id) }
})
