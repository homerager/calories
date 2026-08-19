import { exerciseCreateSchema } from '../utils/exerciseSchemas'
import { prisma } from '../utils/prisma'
import { nextDay, startOfDay } from '../utils/aggregates'

// Додає запис активності (ручне введення) → ExerciseLog.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  assertRateLimit(event, {
    prefix: 'exercises/post',
    key: user.id,
    limit: 60,
    windowMs: 60_000,
  })

  const body = await readValidatedBody(event, (b) => exerciseCreateSchema.safeParse(b))
  if (!body.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: body.error.issues[0]?.message ?? 'Некоректні дані активності',
    })
  }

  const data = body.data
  // Дату фіксуємо на полудень UTC, щоб нормалізація до доби була стабільною.
  const performedAt = data.date ? new Date(`${data.date}T12:00:00.000Z`) : new Date()

  const entry = await prisma.exerciseLog.create({
    data: {
      userId: user.id,
      name: data.name,
      durationMin: data.durationMin ?? null,
      kcalBurned: data.kcalBurned ?? null,
      performedAt,
    },
    select: {
      id: true,
      name: true,
      durationMin: true,
      kcalBurned: true,
      performedAt: true,
    },
  })

  const dayStart = startOfDay(performedAt)
  const dayEnd = nextDay(performedAt)
  const sums = await prisma.exerciseLog.aggregate({
    where: { userId: user.id, performedAt: { gte: dayStart, lt: dayEnd } },
    _sum: { kcalBurned: true },
  })

  return {
    entry: {
      id: entry.id,
      name: entry.name,
      durationMin: entry.durationMin,
      kcalBurned: entry.kcalBurned,
      performedAt: entry.performedAt.toISOString(),
    },
    totalKcalBurned: sums._sum.kcalBurned ?? 0,
  }
})
