import { getRouterParam } from 'h3'
import { prisma } from '../../utils/prisma'
import { nextDay, startOfDay } from '../../utils/aggregates'

// Видаляє запис активності користувача.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'Не вказано id запису' })
  }

  const entry = await prisma.exerciseLog.findUnique({
    where: { id },
    select: { id: true, userId: true, performedAt: true },
  })

  // 404 і для чужого запису, щоб не розкривати його існування.
  if (!entry || entry.userId !== user.id) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Запис не знайдено' })
  }

  await prisma.exerciseLog.delete({ where: { id } })

  const dayStart = startOfDay(entry.performedAt)
  const dayEnd = nextDay(entry.performedAt)
  const sums = await prisma.exerciseLog.aggregate({
    where: { userId: user.id, performedAt: { gte: dayStart, lt: dayEnd } },
    _sum: { kcalBurned: true },
  })

  return {
    ok: true,
    date: dayStart.toISOString().slice(0, 10),
    totalKcalBurned: sums._sum.kcalBurned ?? 0,
  }
})
