import type { DishDetailsInput, MenuDayGenerationInput, MenuGenerationInput } from './types'

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
- ГОЛОВНЕ — РІЗНОМАНІТТЯ та користь: щодня різні страви, різні джерела білка (мʼясо, риба, яйця, бобові, молочні), різні гарніри й овочі.
- Знайомі страви користувача можна зрідка включати для звички, але НЕ роби на них акцент і не став ту саму страву більш ніж 1–2 рази на тиждень. Більшість страв мають бути новими та різними.
- Не повторюй ту саму страву у сусідні дні. Урізноманітнюй навіть перекуси (не став той самий фрукт щодня).
- Пропонуй цікаві, але реалістичні корисні страви; роби кожен тиждень несхожим на попередній.`

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
        'Улюблені страви користувача (значення на 100 г) — можеш включити 2–4 з них для звички, але не більше; решта меню має бути новою й різноманітною:',
        ...input.candidates.map(
          (c) =>
            `- ${c.name}: ${Math.round(c.per100.kcal)} ккал, Б ${c.per100.protein}, Ж ${c.per100.fat}, В ${c.per100.carb}`,
        ),
      ].join('\n')
    : 'У користувача ще немає збережених страв — склади меню з поширених збалансованих страв.'

  return [
    'Склади РІЗНОМАНІТНЕ меню на 7 днів (dayIndex 0..6).',
    targetLine,
    goalLine,
    candidateLine,
    `Зроби цей тиждень несхожим на типовий; варіант #${Math.floor(Math.random() * 100000)}.`,
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

// ── Перегенерація одного дня ─────────────────────────────────────────────────

/** Системна інструкція для генерації одного дня меню. */
export const MENU_DAY_SYSTEM_PROMPT = `Ти — нутриціолог. Склади збалансоване меню на ОДИН день.
Повертай ЛИШЕ структуровані дані у заданій схемі, без пояснень і тексту поза схемою.

Правила:
- Сніданок (BREAKFAST), обід (LUNCH), вечеря (DINNER) і за потреби перекус (SNACK).
- name: коротка назва страви українською.
- portionGrams: маса порції у грамах (> 0).
- kcal, protein, fat, carb: значення для ВСІЄЇ порції (не на 100 г). Грами для protein/fat/carb.
- Сумарна калорійність дня має бути близькою до цільової норми (±10%).
- ГОЛОВНЕ — різноманіття й користь: різні джерела білка та гарніри.
- Знайомі страви користувача можна зрідка включати, але не роби на них акцент — переважно пропонуй нові, цікаві корисні страви.`

/** Будує користувацький промпт для перегенерації одного дня. */
export function menuDayUserPrompt(input: MenuDayGenerationInput): string {
  const t = input.targets

  const targetLine =
    t.dailyKcal != null
      ? `Добові цільові норми: ~${t.dailyKcal} ккал, білки ~${t.proteinGrams ?? '?'} г, жири ~${t.fatGrams ?? '?'} г, вуглеводи ~${t.carbGrams ?? '?'} г.`
      : 'Добові норми не задані — орієнтуйся на збалансований раціон ~2000 ккал.'

  const goalLine = t.goal ? `Ціль користувача: ${t.goal}.` : ''
  const dayLine = input.dayLabel ? `День тижня: ${input.dayLabel}.` : ''

  const candidateLine = input.candidates.length
    ? [
        'Улюблені страви користувача (значення на 100 г) — можеш включити 1–2 з них, але переважно пропонуй нові різноманітні страви:',
        ...input.candidates.map(
          (c) =>
            `- ${c.name}: ${Math.round(c.per100.kcal)} ккал, Б ${c.per100.protein}, Ж ${c.per100.fat}, В ${c.per100.carb}`,
        ),
      ].join('\n')
    : 'У користувача ще немає збережених страв — склади день із поширених збалансованих страв.'

  const avoidLine = input.avoid?.length
    ? `Уникай повторення страв, що вже є в інші дні тижня: ${input.avoid.join(', ')}.`
    : ''

  return [
    'Склади РІЗНОМАНІТНЕ меню на один день з корисних страв.',
    dayLine,
    targetLine,
    goalLine,
    candidateLine,
    avoidLine,
    `Дай свіжий варіант; варіант #${Math.floor(Math.random() * 100000)}.`,
  ]
    .filter(Boolean)
    .join('\n\n')
}

/** Назва структури/інструмента для одного дня. */
export const MENU_DAY_SCHEMA_NAME = 'menu_day'

/** JSON Schema одного дня для OpenAI strict / Anthropic tool input. */
export const MENU_DAY_JSON_SCHEMA = {
  type: 'object',
  properties: {
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
  required: ['meals'],
  additionalProperties: false,
} as const

/** Gemini responseSchema одного дня (без additionalProperties). */
export const MENU_DAY_GEMINI_SCHEMA = {
  type: 'object',
  properties: {
    meals: {
      type: 'array',
      items: {
        type: 'object',
        properties: MEAL_PROPERTIES,
        required: MEAL_REQUIRED,
      },
    },
  },
  required: ['meals'],
} as const

// ── Деталі страви (інгредієнти / кроки / поради) ─────────────────────────────

/** Системна інструкція для генерації деталей страви. */
export const DISH_DETAILS_SYSTEM_PROMPT = `Ти — кухар-нутриціолог. За назвою страви та її порцією поверни склад і спосіб приготування.
Повертай ЛИШЕ структуровані дані у заданій схемі, без пояснень поза схемою.

Правила:
- ingredients: список інгредієнтів із приблизною кількістю саме на вказану порцію (name — назва, amount — кількість, напр. «150 г», «1 шт», «за смаком»).
- steps: короткі кроки приготування (кожен крок — окремий рядок). Якщо страва не потребує готування — залиш порожній список.
- tips: одна коротка практична порада (або порожній рядок).
- Усе українською.`

/** Будує користувацький промпт для деталей страви. */
export function dishDetailsUserPrompt(input: DishDetailsInput): string {
  return `Страва: "${input.name}". Порція: ${Math.round(input.portionGrams)} г, орієнтовно ${Math.round(input.kcal)} ккал (Б ${input.protein} / Ж ${input.fat} / В ${input.carb}). Дай інгредієнти на цю порцію, стислі кроки приготування та одну коротку пораду.`
}

/** Назва структури/інструмента для деталей страви. */
export const DISH_DETAILS_SCHEMA_NAME = 'dish_details'

const INGREDIENT_OBJECT = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Назва інгредієнта' },
    amount: { type: 'string', description: 'Приблизна кількість на порцію' },
  },
  required: ['name', 'amount'],
  additionalProperties: false,
} as const

/** JSON Schema деталей страви для OpenAI strict / Anthropic tool input. */
export const DISH_DETAILS_JSON_SCHEMA = {
  type: 'object',
  properties: {
    ingredients: { type: 'array', items: INGREDIENT_OBJECT },
    steps: { type: 'array', items: { type: 'string' } },
    tips: { type: 'string' },
  },
  required: ['ingredients', 'steps', 'tips'],
  additionalProperties: false,
} as const

/** Gemini responseSchema деталей страви (без additionalProperties). */
export const DISH_DETAILS_GEMINI_SCHEMA = {
  type: 'object',
  properties: {
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          amount: { type: 'string' },
        },
        required: ['name', 'amount'],
      },
    },
    steps: { type: 'array', items: { type: 'string' } },
    tips: { type: 'string' },
  },
  required: ['ingredients', 'steps', 'tips'],
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
