import { getRouterParam } from 'h3'

// Глобальний каталог спільний — рядки не видаляємо.

export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  getRouterParam(event, 'id')
  throw createError({
    statusCode: 405,
    statusMessage: 'Method Not Allowed',
    message: 'Страви зі спільної бази не видаляються',
  })
})
