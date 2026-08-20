import { z } from 'zod'
import { DATE_RE } from './foodSchemas'

// Схеми валідації для журналу активності (ExerciseLog).

/** Створення запису активності. Хоча б одне з durationMin/steps/kcalBurned бажане, але не обовʼязкове. */
export const exerciseCreateSchema = z.object({
  name: z.string().trim().min(1, 'Вкажіть назву активності').max(100, 'Задовга назва'),
  durationMin: z
    .number()
    .int('Тривалість — ціле число хвилин')
    .min(1, 'Тривалість має бути більшою за 0')
    .max(1440, 'Тривалість не може перевищувати добу')
    .nullish(),
  steps: z
    .number()
    .int('Кроки — ціле число')
    .min(1, 'Кількість кроків має бути більшою за 0')
    .max(200000, 'Забагато кроків')
    .nullish(),
  kcalBurned: z
    .number()
    .int('Калорії — ціле число')
    .min(0, 'Некоректні калорії')
    .max(20000, 'Забагато калорій')
    .nullish(),
  date: z.string().regex(DATE_RE, 'Некоректна дата (очікується YYYY-MM-DD)').nullish(),
})

export type ExerciseCreateInput = z.infer<typeof exerciseCreateSchema>
