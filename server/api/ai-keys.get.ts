import { listUserAiKeys } from '../ai/keys'

// Повертає список власних AI-ключів користувача (замасковані, без секретів).
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  return { keys: await listUserAiKeys(user.id) }
})
