import type { ActivityLevel, Goal, Sex } from '../../prisma/generated/client/enums'
import { decrypt } from './crypto'

// Серіалізація запису Profile у безпечну для клієнта форму:
// чутливі виміри розшифровуються, дата народження віддається як YYYY-MM-DD.

/** Структурно-типізований запис профілю (поля, потрібні для відповіді). */
export interface ProfileRecord {
  name: string | null
  sex: Sex | null
  birthDate: Date | null
  age: number | null
  activityLevel: ActivityLevel
  goal: Goal
  heightEnc: string | null
  weightEnc: string | null
  targetWeightEnc: string | null
  dailyKcal: number | null
  proteinGrams: number | null
  fatGrams: number | null
  carbGrams: number | null
}

export interface ProfileResponse {
  name: string | null
  sex: Sex | null
  birthDate: string | null
  age: number | null
  activityLevel: ActivityLevel
  goal: Goal
  heightCm: number | null
  weightKg: number | null
  targetWeightKg: number | null
  dailyKcal: number | null
  proteinGrams: number | null
  fatGrams: number | null
  carbGrams: number | null
}

/** Безпечно розшифровує числовий вимір; повертає null за відсутності/помилки. */
function decryptNumber(enc: string | null): number | null {
  if (!enc) return null
  try {
    const value = Number(decrypt(enc))
    return Number.isFinite(value) ? value : null
  } catch {
    return null
  }
}

/** Перетворює запис Profile у DTO для клієнта (без шифротекстів). */
export function toProfileResponse(profile: ProfileRecord): ProfileResponse {
  return {
    name: profile.name,
    sex: profile.sex,
    birthDate: profile.birthDate ? profile.birthDate.toISOString().slice(0, 10) : null,
    age: profile.age,
    activityLevel: profile.activityLevel,
    goal: profile.goal,
    heightCm: decryptNumber(profile.heightEnc),
    weightKg: decryptNumber(profile.weightEnc),
    targetWeightKg: decryptNumber(profile.targetWeightEnc),
    dailyKcal: profile.dailyKcal,
    proteinGrams: profile.proteinGrams,
    fatGrams: profile.fatGrams,
    carbGrams: profile.carbGrams,
  }
}
