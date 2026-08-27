import { getRouterParam } from 'h3'
import { prisma } from '../../utils/prisma'
import { calendarKeyInZone, zonedDayBounds } from '../../utils/day'

// Видаляє запис води користувача.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'Не вказано id запису' })
  }

  const entry = await prisma.waterLog.findUnique({
    where: { id },
    select: { id: true, userId: true, measuredAt: true },
  })

  if (!entry || entry.userId !== user.id) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Запис не знайдено' })
  }

  await prisma.waterLog.delete({ where: { id } })

  const key = calendarKeyInZone(entry.measuredAt)
  const { start, end } = zonedDayBounds(key)
  const sums = await prisma.waterLog.aggregate({
    where: { userId: user.id, measuredAt: { gte: start, lt: end } },
    _sum: { volumeMl: true },
  })

  return {
    ok: true,
    date: key,
    totalMl: sums._sum.volumeMl ?? 0,
  }
})
