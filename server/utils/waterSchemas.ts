import { z } from 'zod'
import { DATE_RE } from './foodSchemas'

// Схеми валідації для журналу води (WaterLog).

/** Створення запису води. Обʼєм у мілілітрах. */
export const waterCreateSchema = z.object({
  volumeMl: z
    .number()
    .int('Обʼєм — ціле число мілілітрів')
    .min(1, 'Обʼєм має бути більшим за 0')
    .max(5000, 'Забагато за один раз'),
  date: z.string().regex(DATE_RE, 'Некоректна дата (очікується YYYY-MM-DD)').nullish(),
})

export type WaterCreateInput = z.infer<typeof waterCreateSchema>

/** Типова добова ціль по воді (мл), поки не винесено у профіль. */
export const DEFAULT_WATER_GOAL_ML = 2000
