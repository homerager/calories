import { revokeApiToken } from '../../../utils/apiToken'

// Відкликати конкретний токен за id (з екрана «пристрої / сесії»).
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'Не вказано токен' })
  }

  const revoked = await revokeApiToken(id, user.id)
  if (!revoked) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Токен не знайдено' })
  }

  return { ok: true }
})
