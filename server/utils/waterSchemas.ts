import { z } from 'zod'
import { DATE_RE } from './foodSchemas'

// Схеми валідації для журналу води (WaterLog).

/** Створення запису води: обсяг у мілілітрах. */
export const waterCreateSchema = z.object({
  volumeMl: z
    .number()
    .int('Обсяг — ціле число мілілітрів')
    .min(1, 'Обсяг має бути більшим за 0')
    .max(10000, 'Забагато для одного запису'),
  date: z.string().regex(DATE_RE, 'Некоректна дата (очікується YYYY-MM-DD)').nullish(),
})

export type WaterCreateInput = z.infer<typeof waterCreateSchema>
