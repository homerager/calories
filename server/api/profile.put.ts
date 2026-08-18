import { prisma } from '../utils/prisma'
import { encrypt, decrypt } from '../utils/crypto'
import { profileUpdateSchema } from '../utils/profileSchemas'
import { toProfileResponse } from '../utils/profileResponse'
import { ageFromBirthDate, calcNorms, type NormsResult } from '../utils/mifflin'

// Оновлює (upsert) профіль користувача, перераховує добові норми (Міффлін-Сан Жеор)
// і, за зміни ваги, додає запис у історію зважувань.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const body = await readValidatedBody(event, (b) => profileUpdateSchema.safeParse(b))
  if (!body.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: body.error.issues[0]?.message ?? 'Некоректні дані профілю',
    })
  }

  const data = body.data

  // Вік: пріоритет — дата народження; інакше явно вказаний вік.
  let birthDate: Date | null = null
  let resolvedAge: number | null = null
  if (data.birthDate) {
    birthDate = new Date(`${data.birthDate}T00:00:00.000Z`)
    resolvedAge = ageFromBirthDate(birthDate)
  } else if (data.age != null) {
    resolvedAge = data.age
  }

  // Норми рахуємо лише за наявності зросту, ваги та віку.
  let norms: NormsResult | null = null
  if (data.heightCm != null && data.weightKg != null && resolvedAge != null) {
    norms = calcNorms({
      sex: data.sex ?? null,
      age: resolvedAge,
      heightCm: data.heightCm,
      weightKg: data.weightKg,
      activityLevel: data.activityLevel,
      goal: data.goal,
    })
  }

  const heightEnc = data.heightCm != null ? encrypt(String(data.heightCm)) : null
  const weightEnc = data.weightKg != null ? encrypt(String(data.weightKg)) : null

  const persisted = {
    name: data.name ?? null,
    sex: data.sex ?? null,
    birthDate,
    age: resolvedAge,
    activityLevel: data.activityLevel,
    goal: data.goal,
    heightEnc,
    weightEnc,
    dailyKcal: norms?.dailyKcal ?? null,
    proteinGrams: norms?.proteinGrams ?? null,
    fatGrams: norms?.fatGrams ?? null,
    carbGrams: norms?.carbGrams ?? null,
  }

  const profile = await prisma.$transaction(async (tx) => {
    const existing = await tx.profile.findUnique({ where: { userId: user.id } })

    let prevWeight: number | null = null
    if (existing?.weightEnc) {
      try {
        prevWeight = Number(decrypt(existing.weightEnc))
      } catch {
        prevWeight = null
      }
    }

    const saved = await tx.profile.upsert({
      where: { userId: user.id },
      update: persisted,
      create: { userId: user.id, ...persisted },
    })

    // Логуємо зважування лише коли вага задана й змінилась (або її ще не було).
    if (
      data.weightKg != null &&
      (prevWeight == null || Math.abs(prevWeight - data.weightKg) > 1e-9)
    ) {
      await tx.weightLog.create({
        data: {
          userId: user.id,
          weightEnc: encrypt(String(data.weightKg)),
        },
      })
    }

    return saved
  })

  return { profile: toProfileResponse(profile) }
})
