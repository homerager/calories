import type { ActivityLevel, Goal, Sex } from '~/composables/useProfile'

// Спільні опції для селектів профілю (використовуються на /profile та /onboarding).

export const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'MALE', label: 'Чоловіча' },
  { value: 'FEMALE', label: 'Жіноча' },
  { value: 'OTHER', label: 'Інша' },
]

export const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string }[] = [
  { value: 'SEDENTARY', label: 'Сидячий спосіб життя' },
  { value: 'LIGHT', label: 'Легка активність (1–3 трен./тиж.)' },
  { value: 'MODERATE', label: 'Помірна (3–5 трен./тиж.)' },
  { value: 'ACTIVE', label: 'Висока (6–7 трен./тиж.)' },
  { value: 'VERY_ACTIVE', label: 'Дуже висока / фізична робота' },
]

export const GOAL_OPTIONS: { value: Goal; label: string }[] = [
  { value: 'LOSE', label: 'Схуднення' },
  { value: 'MAINTAIN', label: 'Підтримка ваги' },
  { value: 'GAIN', label: 'Набір маси' },
]

export function parseNum(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const n = Number(trimmed.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}
