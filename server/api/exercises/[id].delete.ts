import { getRouterParam } from 'h3'
import { prisma } from '../../utils/prisma'
import { calendarKeyInZone, zonedDayBounds } from '../../utils/day'

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

  if (!entry || entry.userId !== user.id) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Запис не знайдено' })
  }

  await prisma.exerciseLog.delete({ where: { id } })

  const key = calendarKeyInZone(entry.performedAt)
  const { start, end } = zonedDayBounds(key)
  const sums = await prisma.exerciseLog.aggregate({
    where: { userId: user.id, performedAt: { gte: start, lt: end } },
    _sum: { kcalBurned: true },
  })

  return {
    ok: true,
    date: key,
    totalKcalBurned: sums._sum.kcalBurned ?? 0,
  }
})
