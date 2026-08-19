import { getRouterParam } from 'h3'
import { prisma } from '../../utils/prisma'

// Позначає одне сповіщення прочитаним.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'Не вказано id сповіщення' })
  }

  const existing = await prisma.notification.findUnique({
    where: { id },
    select: { id: true, userId: true },
  })

  if (!existing || existing.userId !== user.id) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Сповіщення не знайдено' })
  }

  await prisma.notification.update({ where: { id }, data: { readAt: new Date() } })

  return { ok: true }
})
