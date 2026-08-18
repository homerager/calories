// Спільні промпти та описи JSON-схеми для structured output усіх провайдерів.
// Мета — гарантувати, що всі моделі повертають однаковий строгий JSON,
// який далі валідується `foodRecognitionSchema`.

/** Системна інструкція: роль, мова, вимоги до полів. */
export const SYSTEM_PROMPT = `Ти — нутриціолог-асистент. За описом або фото страви оціни її склад.
Повертай ЛИШЕ структуровані дані у заданій схемі, без пояснень і тексту поза схемою.

Правила:
- name: коротка назва страви українською.
- portionGrams: оцінена маса всієї порції у грамах (> 0).
- kcal, protein, fat, carb: значення для ВСІЄЇ порції (не на 100 г). Грами для protein/fat/carb.
- confidence: твоя впевненість у діапазоні 0..1.
- Якщо даних мало — дай найкращу обґрунтовану оцінку та знизь confidence.
- Не додавай коментарів, одиниць виміру чи додаткових полів.`

/** Інструкція для текстового запиту. */
export function textPrompt(description: string): string {
  return `Опис страви: "${description}". Оціни склад цієї страви.`
}

/** Інструкція для запиту з фото. */
export const IMAGE_PROMPT =
  'Розпізнай страву на фото та оціни її склад для показаної порції.'

/**
 * JSON Schema (підмножина, сумісна з OpenAI structured outputs та Gemini responseSchema).
 * `additionalProperties: false` потрібне для OpenAI strict-режиму.
 */
export const FOOD_JSON_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Коротка назва страви українською' },
    portionGrams: { type: 'number', description: 'Маса всієї порції, г' },
    kcal: { type: 'number', description: 'Калорійність усієї порції, ккал' },
    protein: { type: 'number', description: 'Білки всієї порції, г' },
    fat: { type: 'number', description: 'Жири всієї порції, г' },
    carb: { type: 'number', description: 'Вуглеводи всієї порції, г' },
    confidence: { type: 'number', description: 'Впевненість 0..1' },
  },
  required: ['name', 'portionGrams', 'kcal', 'protein', 'fat', 'carb', 'confidence'],
  additionalProperties: false,
} as const

/** Назва структури/інструмента, спільна для всіх провайдерів. */
export const SCHEMA_NAME = 'food_recognition'
