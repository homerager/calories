import { prisma } from '../utils/prisma'
import { encrypt, decrypt } from '../utils/crypto'
import { weightLogSchema } from '../utils/profileSchemas'
import { calcNorms, type NormsResult } from '../utils/mifflin'

// Додає запис зважування, оновлює поточну вагу у профілі та (за наявності даних) перераховує норми.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  assertRateLimit(event, {
    prefix: 'weight/post',
    key: user.id,
    limit: 30,
    windowMs: 60_000,
  })

  const body = await readValidatedBody(event, (b) => weightLogSchema.safeParse(b))
  if (!body.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: body.error.issues[0]?.message ?? 'Некоректні дані зважування',
    })
  }

  const { weightKg } = body.data
  const measuredAt = body.data.measuredAt
    ? new Date(`${body.data.measuredAt}T12:00:00.000Z`)
    : new Date()

  const entry = await prisma.$transaction(async (tx) => {
    const log = await tx.weightLog.create({
      data: {
        userId: user.id,
        weightEnc: encrypt(String(weightKg)),
        measuredAt,
      },
      select: { id: true, measuredAt: true },
    })

    // Синхронізуємо поточну вагу у профілі лише якщо це найсвіжіше зважування.
    const latest = await tx.weightLog.findFirst({
      where: { userId: user.id },
      orderBy: { measuredAt: 'desc' },
      select: { id: true },
    })

    if (latest?.id === log.id) {
      const profile = await tx.profile.findUnique({ where: { userId: user.id } })
      if (profile) {
        let heightCm: number | null = null
        if (profile.heightEnc) {
          try {
            heightCm = Number(decrypt(profile.heightEnc))
          } catch {
            heightCm = null
          }
        }

        let norms: NormsResult | null = null
        if (heightCm != null && profile.age != null) {
          norms = calcNorms({
            sex: profile.sex,
            age: profile.age,
            heightCm,
            weightKg,
            activityLevel: profile.activityLevel,
            goal: profile.goal,
          })
        }

        await tx.profile.update({
          where: { userId: user.id },
          data: {
            weightEnc: encrypt(String(weightKg)),
            dailyKcal: norms?.dailyKcal ?? profile.dailyKcal,
            proteinGrams: norms?.proteinGrams ?? profile.proteinGrams,
            fatGrams: norms?.fatGrams ?? profile.fatGrams,
            carbGrams: norms?.carbGrams ?? profile.carbGrams,
          },
        })
      }
    }

    return log
  })

  return {
    entry: {
      id: entry.id,
      weightKg,
      measuredAt: entry.measuredAt.toISOString(),
    },
  }
})
