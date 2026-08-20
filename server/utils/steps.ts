// Оцінка спалених калорій за кількістю кроків.
// Модель проста і лінійна: витрати пропорційні кількості кроків і вазі тіла.
// Опорна точка — ~0.04 ккал/крок для людини вагою 70 кг (≈400 ккал за 10 000 кроків),
// що відповідає типовим оцінкам фітнес-трекерів. За відсутності ваги беремо 70 кг.

export const DEFAULT_WEIGHT_KG = 70

/** Ккал на один крок для опорної ваги 70 кг. */
const KCAL_PER_STEP_AT_REF = 0.04

const KCAL_PER_STEP_PER_KG = KCAL_PER_STEP_AT_REF / DEFAULT_WEIGHT_KG

/**
 * Оцінює спалені калорії за кроками з поправкою на вагу.
 * @param steps кількість кроків (>= 0)
 * @param weightKg вага тіла, кг (необовʼязково — за замовчуванням 70)
 * @returns ціле число ккал (>= 0)
 */
export function kcalFromSteps(steps: number, weightKg?: number | null): number {
  if (!Number.isFinite(steps) || steps <= 0) return 0
  const weight = weightKg && weightKg > 0 ? weightKg : DEFAULT_WEIGHT_KG
  return Math.round(steps * weight * KCAL_PER_STEP_PER_KG)
}
