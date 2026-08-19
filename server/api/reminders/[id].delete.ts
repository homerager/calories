import { getRouterParam } from 'h3'
import { prisma } from '../../utils/prisma'

// Видаляє нагадування користувача.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'Не вказано id нагадування' })
  }

  const existing = await prisma.reminder.findUnique({
    where: { id },
    select: { id: true, userId: true },
  })

  // 404 і для чужого запису, щоб не розкривати його існування.
  if (!existing || existing.userId !== user.id) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Нагадування не знайдено' })
  }

  await prisma.reminder.delete({ where: { id } })

  return { ok: true }
})
