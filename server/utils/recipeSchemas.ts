import { z } from 'zod'
import { dishDetailsSchema } from '../ai/types'
import { mealSlotSchema } from './foodSchemas'

export { dishDetailsSchema }

/** Зберегти страву в глобальний каталог (з пункту меню або з деталей). */
export const recipeCreateSchema = z
  .object({
    menuItemId: z.string().min(1).optional(),
    foodItemId: z.string().min(1).optional(),
    name: z.string().trim().min(1, 'Вкажіть назву').max(200, 'Задовга назва').optional(),
    slot: mealSlotSchema.optional(),
    portionGrams: z.number().positive('Порція має бути > 0').max(5000).optional(),
    kcal: z.number().min(0).max(20000).optional(),
    protein: z.number().min(0).max(2000).optional(),
    fat: z.number().min(0).max(2000).optional(),
    carb: z.number().min(0).max(2000).optional(),
    details: dishDetailsSchema.optional(),
  })
  .refine((d) => Boolean(d.menuItemId) || Boolean(d.details) || Boolean(d.name), {
    message: 'Вкажіть menuItemId, name або details',
    path: ['name'],
  })

export type RecipeCreateInput = z.infer<typeof recipeCreateSchema>

export const recipeUpdateSchema = z.object({
  name: z.string().trim().min(1, 'Вкажіть назву').max(200, 'Задовга назва').optional(),
  slot: mealSlotSchema.nullish(),
  portionGrams: z.number().positive('Порція має бути > 0').max(5000).optional(),
  kcal: z.number().min(0).max(20000).optional(),
  protein: z.number().min(0).max(2000).optional(),
  fat: z.number().min(0).max(2000).optional(),
  carb: z.number().min(0).max(2000).optional(),
  details: dishDetailsSchema.optional(),
})

export type RecipeUpdateInput = z.infer<typeof recipeUpdateSchema>
