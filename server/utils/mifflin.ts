import type { ActivityLevel, Goal, Sex } from '../../prisma/generated/client/enums'

// Розрахунок добових норм: BMR (Міффлін-Сан Жеор) → TDEE → корекція за ціллю → БЖВ.

/** Коефіцієнти активності (множник до BMR для отримання TDEE). */
export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  SEDENTARY: 1.2,
  LIGHT: 1.375,
  MODERATE: 1.55,
  ACTIVE: 1.725,
  VERY_ACTIVE: 1.9,
}

/** Корекція калорій за ціллю (частка від TDEE). */
export const GOAL_ADJUSTMENTS: Record<Goal, number> = {
  LOSE: -0.15,
  MAINTAIN: 0,
  GAIN: 0.15,
}

/**
 * Розкладка макронутрієнтів (частка від добових калорій).
 * Білок/вуглеводи — 4 ккал/г, жир — 9 ккал/г.
 */
export const MACRO_SPLIT = {
  protein: 0.3,
  fat: 0.25,
  carb: 0.45,
} as const

const KCAL_PER_GRAM = { protein: 4, fat: 9, carb: 4 } as const

export interface NormsInput {
  sex?: Sex | null
  age: number // повних років
  heightCm: number
  weightKg: number
  activityLevel: ActivityLevel
  goal: Goal
}

export interface NormsResult {
  bmr: number // базовий метаболізм, ккал
  tdee: number // повні добові витрати, ккал
  dailyKcal: number // цільові добові калорії (після корекції за ціллю)
  proteinGrams: number
  fatGrams: number
  carbGrams: number
}

/**
 * BMR за формулою Міффліна-Сан Жеора.
 * Стать-константа: чол +5, жін −161, інше/невідомо — середнє (−78).
 */
export function calcBMR(sex: Sex | null | undefined, weightKg: number, heightCm: number, age: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  const sexConstant = sex === 'MALE' ? 5 : sex === 'FEMALE' ? -161 : -78
  return base + sexConstant
}

/** Обчислює вік у повних роках із дати народження. */
export function ageFromBirthDate(birthDate: Date, now: Date = new Date()): number {
  let age = now.getFullYear() - birthDate.getFullYear()
  const m = now.getMonth() - birthDate.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) {
    age--
  }
  return Math.max(0, age)
}

/** Повний розрахунок норм: BMR → TDEE → цільові калорії → БЖВ у грамах. */
export function calcNorms(input: NormsInput): NormsResult {
  const { sex, age, heightCm, weightKg, activityLevel, goal } = input

  const bmr = calcBMR(sex, weightKg, heightCm, age)
  const tdee = bmr * ACTIVITY_FACTORS[activityLevel]
  const dailyKcal = tdee * (1 + GOAL_ADJUSTMENTS[goal])

  const proteinGrams = (dailyKcal * MACRO_SPLIT.protein) / KCAL_PER_GRAM.protein
  const fatGrams = (dailyKcal * MACRO_SPLIT.fat) / KCAL_PER_GRAM.fat
  const carbGrams = (dailyKcal * MACRO_SPLIT.carb) / KCAL_PER_GRAM.carb

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    dailyKcal: Math.round(dailyKcal),
    proteinGrams: Math.round(proteinGrams),
    fatGrams: Math.round(fatGrams),
    carbGrams: Math.round(carbGrams),
  }
}
