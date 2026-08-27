import { waterCreateSchema } from '../utils/waterSchemas'
import { prisma } from '../utils/prisma'
import { calendarKeyInZone, instantForDay, zonedDayBounds } from '../utils/day'

// Додає запис випитої води (ручне введення) → WaterLog.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  assertRateLimit(event, {
    prefix: 'water/post',
    key: user.id,
    limit: 60,
    windowMs: 60_000,
  })

  const body = await readValidatedBody(event, (b) => waterCreateSchema.safeParse(b))
  if (!body.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: body.error.issues[0]?.message ?? 'Некоректні дані запису води',
    })
  }

  const data = body.data
  const measuredAt = instantForDay(data.date)

  const entry = await prisma.waterLog.create({
    data: {
      userId: user.id,
      volumeMl: data.volumeMl,
      measuredAt,
    },
    select: {
      id: true,
      volumeMl: true,
      measuredAt: true,
      createdAt: true,
    },
  })

  const key = calendarKeyInZone(measuredAt)
  const { start, end } = zonedDayBounds(key)
  const sums = await prisma.waterLog.aggregate({
    where: { userId: user.id, measuredAt: { gte: start, lt: end } },
    _sum: { volumeMl: true },
  })

  return {
    entry: {
      id: entry.id,
      volumeMl: entry.volumeMl,
      measuredAt: entry.measuredAt.toISOString(),
      createdAt: entry.createdAt.toISOString(),
    },
    totalMl: sums._sum.volumeMl ?? 0,
  }
})
