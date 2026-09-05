import { z } from 'zod'
import { DATE_RE } from './foodSchemas'

// Схеми валідації для генерації та застосування меню на тиждень.

export const menuAiProviderSchema = z.enum(['OPENAI', 'ANTHROPIC', 'GEMINI'])

/** Запит на генерацію меню: опційний старт тижня та провайдер. */
export const menuGenerateSchema = z
  .object({
    startDate: z.string().regex(DATE_RE, 'Некоректна дата (очікується YYYY-MM-DD)').optional(),
    provider: menuAiProviderSchema.optional(),
  })
  .default({})

export type MenuGenerateInput = z.infer<typeof menuGenerateSchema>

/** Застосування меню в щоденник: день цілком (dayIndex) або одна страва (itemId). */
export const menuApplySchema = z
  .object({
    planId: z.string().min(1, 'Не вказано план'),
    // Дата, на яку додаємо записи у щоденник.
    date: z.string().regex(DATE_RE, 'Некоректна дата (очікується YYYY-MM-DD)'),
    dayIndex: z.number().int().min(0).max(6).optional(),
    itemId: z.string().min(1).optional(),
  })
  .refine((d) => d.dayIndex !== undefined || d.itemId !== undefined, {
    message: 'Вкажіть dayIndex або itemId',
    path: ['dayIndex'],
  })

export type MenuApplyInput = z.infer<typeof menuApplySchema>

/** Перегенерація одного дня наявного плану. */
export const menuRegenerateDaySchema = z.object({
  planId: z.string().min(1, 'Не вказано план'),
  dayIndex: z.number().int().min(0).max(6),
  provider: menuAiProviderSchema.optional(),
})

export type MenuRegenerateDayInput = z.infer<typeof menuRegenerateDaySchema>

/** Запит деталей страви меню. */
export const menuItemDetailsSchema = z.object({
  itemId: z.string().min(1, 'Не вказано страву'),
  provider: menuAiProviderSchema.optional(),
})

export type MenuItemDetailsInput = z.infer<typeof menuItemDetailsSchema>

/**
 * Запит деталей страви на сторінці меню: або за id довідника (`foodItemId`),
 * або за вільною назвою (`name`) — тоді рецепт генерує AI.
 */
export const dishDetailsLookupSchema = z
  .object({
    foodItemId: z.string().min(1).optional(),
    name: z.string().trim().min(2, 'Надто коротка назва').max(200, 'Задовга назва').optional(),
    provider: menuAiProviderSchema.optional(),
  })
  .refine((d) => Boolean(d.foodItemId) || Boolean(d.name), {
    message: 'Вкажіть foodItemId або name',
    path: ['name'],
  })

export type DishDetailsLookupInput = z.infer<typeof dishDetailsLookupSchema>
