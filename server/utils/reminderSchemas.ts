import { z } from 'zod'

// Схеми валідації для нагадувань (Reminder).

export const REMINDER_KINDS = ['MEAL', 'WATER', 'WEIGH_IN', 'CUSTOM'] as const
export type ReminderKindInput = (typeof REMINDER_KINDS)[number]

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

const reminderBaseSchema = z.object({
  kind: z.enum(REMINDER_KINDS),
  message: z.string().trim().max(200, 'Максимум 200 символів').nullish(),
  timeOfDay: z.string().regex(TIME_RE, 'Час у форматі ГГ:ХХ'),
  daysOfWeek: z
    .array(z.number().int('День тижня — ціле число').min(0).max(6))
    .max(7, 'Забагато днів')
    .default([]),
  enabled: z.boolean().default(true),
})

/** Створення нагадування. */
export const reminderCreateSchema = reminderBaseSchema

export type ReminderCreateInput = z.infer<typeof reminderCreateSchema>

/** Часткове оновлення нагадування (усі поля опційні). */
export const reminderUpdateSchema = reminderBaseSchema.partial()

export type ReminderUpdateInput = z.infer<typeof reminderUpdateSchema>
