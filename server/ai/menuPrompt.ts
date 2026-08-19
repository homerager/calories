import type { MenuGenerationInput } from './types'

// Промпти та JSON-схеми для генерації меню на тиждень (structured output).
// Контракт валідується `menuPlanSchema` у types.ts.

/** Системна інструкція для генерації меню. */
export const MENU_SYSTEM_PROMPT = `Ти — нутриціолог. Склади збалансоване меню на тиждень.
Повертай ЛИШЕ структуровані дані у заданій схемі, без пояснень і тексту поза схемою.

Правила:
- Рівно 7 днів, поле dayIndex приймає значення 0..6.
- Для кожного дня: сніданок (BREAKFAST), обід (LUNCH), вечеря (DINNER) і за потреби перекус (SNACK).
- name: коротка назва страви українською.
- portionGrams: маса порції у грамах (> 0).
- kcal, protein, fat, carb: значення для ВСІЄЇ порції (не на 100 г). Грами для protein/fat/carb.
- Сумарна калорійність кожного дня має бути близькою до цільової норми (±10%).
- Максимально використовуй надані знайомі страви користувача; додавай нові лише щоб добити норму та урізноманітнити раціон.
- Не повторюй однакові страви щодня — забезпеч різноманіття протягом тижня.`

/** Будує користувацький промпт із норм та списку знайомих страв. */
export function menuUserPrompt(input: MenuGenerationInput): string {
  const t = input.targets

  const targetLine =
    t.dailyKcal != null
      ? `Добові цільові норми: ~${t.dailyKcal} ккал, білки ~${t.proteinGrams ?? '?'} г, жири ~${t.fatGrams ?? '?'} г, вуглеводи ~${t.carbGrams ?? '?'} г.`
      : 'Добові норми не задані — орієнтуйся на збалансований раціон ~2000 ккал.'

  const goalLine = t.goal ? `Ціль користувача: ${t.goal}.` : ''

  const candidateLine = input.candidates.length
    ? [
        'Знайомі страви користувача (значення на 100 г) — використовуй їх пріоритетно:',
        ...input.candidates.map(
          (c) =>
            `- ${c.name}: ${Math.round(c.per100.kcal)} ккал, Б ${c.per100.protein}, Ж ${c.per100.fat}, В ${c.per100.carb}`,
        ),
      ].join('\n')
    : 'У користувача ще немає збережених страв — склади меню з поширених збалансованих страв.'

  return [
    'Склади меню на 7 днів (dayIndex 0..6).',
    targetLine,
    goalLine,
    candidateLine,
  ]
    .filter(Boolean)
    .join('\n\n')
}

/** Назва структури/інструмента, спільна для всіх провайдерів. */
export const MENU_SCHEMA_NAME = 'weekly_menu'

const MEAL_PROPERTIES = {
  slot: { type: 'string', enum: ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'] },
  name: { type: 'string', description: 'Коротка назва страви українською' },
  portionGrams: { type: 'number', description: 'Маса порції, г' },
  kcal: { type: 'number', description: 'Калорійність усієї порції, ккал' },
  protein: { type: 'number', description: 'Білки всієї порції, г' },
  fat: { type: 'number', description: 'Жири всієї порції, г' },
  carb: { type: 'number', description: 'Вуглеводи всієї порції, г' },
} as const

const MEAL_REQUIRED = ['slot', 'name', 'portionGrams', 'kcal', 'protein', 'fat', 'carb']

/**
 * JSON Schema для OpenAI strict / Anthropic tool input.
 * `additionalProperties: false` потрібне для OpenAI strict-режиму.
 */
export const MENU_JSON_SCHEMA = {
  type: 'object',
  properties: {
    days: {
      type: 'array',
      description: 'Рівно 7 днів меню',
      items: {
        type: 'object',
        properties: {
          dayIndex: { type: 'integer', description: 'Індекс дня 0..6' },
          meals: {
            type: 'array',
            items: {
              type: 'object',
              properties: MEAL_PROPERTIES,
              required: MEAL_REQUIRED,
              additionalProperties: false,
            },
          },
        },
        required: ['dayIndex', 'meals'],
        additionalProperties: false,
      },
    },
  },
  required: ['days'],
  additionalProperties: false,
} as const

/** Gemini responseSchema не підтримує additionalProperties → окрема схема. */
export const MENU_GEMINI_SCHEMA = {
  type: 'object',
  properties: {
    days: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          dayIndex: { type: 'integer' },
          meals: {
            type: 'array',
            items: {
              type: 'object',
              properties: MEAL_PROPERTIES,
              required: MEAL_REQUIRED,
            },
          },
        },
        required: ['dayIndex', 'meals'],
      },
    },
  },
  required: ['days'],
} as const
