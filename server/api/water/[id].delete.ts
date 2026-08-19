import { getRouterParam } from 'h3'
import { prisma } from '../../utils/prisma'
import { nextDay, startOfDay } from '../../utils/aggregates'

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

  // 404 і для чужого запису, щоб не розкривати його існування.
  if (!entry || entry.userId !== user.id) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Запис не знайдено' })
  }

  await prisma.waterLog.delete({ where: { id } })

  const dayStart = startOfDay(entry.measuredAt)
  const dayEnd = nextDay(entry.measuredAt)
  const sums = await prisma.waterLog.aggregate({
    where: { userId: user.id, measuredAt: { gte: dayStart, lt: dayEnd } },
    _sum: { volumeMl: true },
  })

  return {
    ok: true,
    date: dayStart.toISOString().slice(0, 10),
    totalMl: sums._sum.volumeMl ?? 0,
  }
})
