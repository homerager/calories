import { z } from 'zod'

// Схеми валідації для профілю та зважувань.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export const sexSchema = z.enum(['MALE', 'FEMALE', 'OTHER'])
export const activityLevelSchema = z.enum([
  'SEDENTARY',
  'LIGHT',
  'MODERATE',
  'ACTIVE',
  'VERY_ACTIVE',
])
export const goalSchema = z.enum(['LOSE', 'MAINTAIN', 'GAIN'])

/** Оновлення профілю. Чутливі виміри (зріст/вага) приходять відкрито, шифруються на сервері. */
export const profileUpdateSchema = z.object({
  name: z.string().trim().max(100, 'Задовге імʼя').nullish(),
  sex: sexSchema.nullish(),
  birthDate: z
    .string()
    .regex(DATE_RE, 'Некоректна дата народження (очікується YYYY-MM-DD)')
    .nullish(),
  age: z.number().int().min(0, 'Некоректний вік').max(120, 'Некоректний вік').nullish(),
  heightCm: z.number().min(50, 'Некоректний зріст').max(272, 'Некоректний зріст').nullish(),
  weightKg: z.number().min(20, 'Некоректна вага').max(500, 'Некоректна вага').nullish(),
  targetWeightKg: z.number().min(20, 'Некоректна цільова вага').max(500, 'Некоректна цільова вага').nullish(),
  activityLevel: activityLevelSchema,
  goal: goalSchema,
})

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>

/** Додавання запису зважування. */
export const weightLogSchema = z.object({
  weightKg: z.number().min(20, 'Некоректна вага').max(500, 'Некоректна вага'),
  measuredAt: z
    .string()
    .regex(DATE_RE, 'Некоректна дата (очікується YYYY-MM-DD)')
    .nullish(),
})

export type WeightLogInput = z.infer<typeof weightLogSchema>
