import { revokeApiToken } from '../../utils/apiToken'

// Вихід для мобільного клієнта: відкликає токен, яким зроблено цей запит.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const tokenId = event.context.apiTokenId
  if (!tokenId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Запит зроблено не через Bearer-токен',
    })
  }

  await revokeApiToken(tokenId, user.id)
  return { ok: true }
})
