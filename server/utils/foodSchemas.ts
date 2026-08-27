import { z } from 'zod'

// Схеми валідації для розпізнавання їжі та записів прийому їжі (MealEntry).

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export const mealSlotSchema = z.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'])
export const mealSourceSchema = z.enum(['AI_PHOTO', 'AI_TEXT', 'MANUAL'])
export const aiProviderSchema = z.enum(['OPENAI', 'ANTHROPIC', 'GEMINI'])

/** Запит на розпізнавання: за текстом або фото (base64 без data-URL-префіксу). */
export const recognizeSchema = z
  .object({
    kind: z.enum(['TEXT', 'IMAGE']),
    text: z.string().trim().min(2, 'Опис надто короткий').max(500, 'Задовгий опис').optional(),
    // ~15 МБ ліміт на base64 (фото стискається на клієнті перед відправкою).
    imageBase64: z.string().min(1).max(15_000_000, 'Зображення завелике').optional(),
    mimeType: z.string().max(100).optional(),
    provider: aiProviderSchema.optional(),
  })
  .refine((d) => (d.kind === 'TEXT' ? !!d.text : !!d.imageBase64), {
    message: 'Для TEXT потрібен text, для IMAGE — imageBase64',
    path: ['kind'],
  })

export type RecognizeInput = z.infer<typeof recognizeSchema>

/** Підтвердження/редагування розпізнаного (або ручне додавання) → MealEntry. */
export const mealCreateSchema = z.object({
  date: z.string().regex(DATE_RE, 'Некоректна дата (очікується YYYY-MM-DD)').optional(),
  slot: mealSlotSchema.nullish(),
  name: z.string().trim().min(1, 'Вкажіть назву').max(200, 'Задовга назва'),
  portionGrams: z.number().positive('Порція має бути > 0').max(5000, 'Нереалістична порція'),
  kcal: z.number().min(0).max(20000),
  protein: z.number().min(0).max(2000),
  fat: z.number().min(0).max(2000),
  carb: z.number().min(0).max(2000),
  source: mealSourceSchema.default('MANUAL'),
  confidence: z.number().min(0).max(1).nullish(),
  // Якщо задано — привʼязуємось до наявного запису довідника (без перезапису).
  foodItemId: z.string().min(1).nullish(),
  // Сирий JSON AI-відповіді (для аудиту).
  rawAiJson: z.unknown().optional(),
})

export type MealCreateInput = z.infer<typeof mealCreateSchema>

/** Редагування наявного запису MealEntry (дата/день не змінюються). */
export const mealUpdateSchema = z.object({
  slot: mealSlotSchema.nullish(),
  name: z.string().trim().min(1, 'Вкажіть назву').max(200, 'Задовга назва'),
  portionGrams: z.number().positive('Порція має бути > 0').max(5000, 'Нереалістична порція'),
  kcal: z.number().min(0).max(20000),
  protein: z.number().min(0).max(2000),
  fat: z.number().min(0).max(2000),
  carb: z.number().min(0).max(2000),
  source: mealSourceSchema.optional(),
  confidence: z.number().min(0).max(1).nullish(),
  foodItemId: z.string().min(1).nullish(),
})

export type MealUpdateInput = z.infer<typeof mealUpdateSchema>

/** Копіювання записів з одного дня на інший. */
export const mealCopySchema = z.object({
  fromDate: z.string().regex(DATE_RE, 'Некоректна дата (очікується YYYY-MM-DD)'),
  toDate: z.string().regex(DATE_RE, 'Некоректна дата (очікується YYYY-MM-DD)'),
})

export type MealCopyInput = z.infer<typeof mealCopySchema>
