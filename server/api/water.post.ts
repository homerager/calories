import { waterCreateSchema } from '../utils/waterSchemas'
import { prisma } from '../utils/prisma'
import { nextDay, startOfDay } from '../utils/aggregates'

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
  // Дату фіксуємо на полудень UTC, щоб нормалізація до доби була стабільною.
  const measuredAt = data.date ? new Date(`${data.date}T12:00:00.000Z`) : new Date()

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

  const dayStart = startOfDay(measuredAt)
  const dayEnd = nextDay(measuredAt)
  const sums = await prisma.waterLog.aggregate({
    where: { userId: user.id, measuredAt: { gte: dayStart, lt: dayEnd } },
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
