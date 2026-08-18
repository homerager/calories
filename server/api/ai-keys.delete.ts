import { getQuery } from 'h3'
import { aiProviderSchema } from '../ai/settings'
import { deleteUserAiKey } from '../ai/keys'

// Видаляє власний AI-ключ користувача для вказаного провайдера (?provider=OPENAI).
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const parsed = aiProviderSchema.safeParse(getQuery(event).provider)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Вкажіть коректний провайдер: OPENAI | ANTHROPIC | GEMINI',
    })
  }

  const keys = await deleteUserAiKey(user.id, parsed.data)
  return { keys }
})
