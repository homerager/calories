import { exerciseCreateSchema } from '../utils/exerciseSchemas'
import { prisma } from '../utils/prisma'
import { calendarKeyInZone, instantForDay, zonedDayBounds } from '../utils/day'
import { decrypt } from '../utils/crypto'
import { kcalFromSteps } from '../utils/steps'

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
  const performedAt = instantForDay(data.date)

  const steps = data.steps ?? null
  // Якщо калорії не вказані вручну, але є кроки — оцінюємо витрати за вагою профілю.
  let kcalBurned = data.kcalBurned ?? null
  if (kcalBurned == null && steps != null) {
    kcalBurned = kcalFromSteps(steps, await getUserWeightKg(user.id))
  }

  const entry = await prisma.exerciseLog.create({
    data: {
      userId: user.id,
      name: data.name,
      durationMin: data.durationMin ?? null,
      steps,
      kcalBurned,
      performedAt,
    },
    select: {
      id: true,
      name: true,
      durationMin: true,
      steps: true,
      kcalBurned: true,
      performedAt: true,
      createdAt: true,
    },
  })

  const key = calendarKeyInZone(performedAt)
  const { start, end } = zonedDayBounds(key)
  const sums = await prisma.exerciseLog.aggregate({
    where: { userId: user.id, performedAt: { gte: start, lt: end } },
    _sum: { kcalBurned: true },
  })

  return {
    entry: {
      id: entry.id,
      name: entry.name,
      durationMin: entry.durationMin,
      steps: entry.steps,
      kcalBurned: entry.kcalBurned,
      performedAt: entry.performedAt.toISOString(),
      createdAt: entry.createdAt.toISOString(),
    },
    totalKcalBurned: sums._sum.kcalBurned ?? 0,
  }
})

/** Розшифровує вагу користувача з профілю; повертає null за відсутності/помилки. */
async function getUserWeightKg(userId: string): Promise<number | null> {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { weightEnc: true },
  })
  if (!profile?.weightEnc) return null
  try {
    const value = Number(decrypt(profile.weightEnc))
    return Number.isFinite(value) && value > 0 ? value : null
  } catch {
    return null
  }
}
