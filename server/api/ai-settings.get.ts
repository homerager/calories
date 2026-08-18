import { buildAiSettingsResponse } from '../ai/settings'

// Повертає персональні налаштування AI користувача: обраний провайдер,
// моделі (сирі + ефективні), доступність провайдерів і стан безкоштовної квоти.
// Секрети (ключі) не віддаються — лише прапорці наявності.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  return { settings: await buildAiSettingsResponse(user.id) }
})
