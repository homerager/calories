import type { ReminderKind } from '../../prisma/generated/client/enums'

// Серіалізація запису Reminder у DTO для клієнта.

export interface ReminderRecord {
  id: string
  kind: ReminderKind
  message: string | null
  timeOfDay: string
  daysOfWeek: number[]
  enabled: boolean
  lastSentAt: Date | null
  createdAt: Date
}

export interface ReminderResponse {
  id: string
  kind: ReminderKind
  message: string | null
  timeOfDay: string
  daysOfWeek: number[]
  enabled: boolean
  lastSentAt: string | null
  createdAt: string
}

export function toReminderResponse(reminder: ReminderRecord): ReminderResponse {
  return {
    id: reminder.id,
    kind: reminder.kind,
    message: reminder.message,
    timeOfDay: reminder.timeOfDay,
    daysOfWeek: reminder.daysOfWeek,
    enabled: reminder.enabled,
    lastSentAt: reminder.lastSentAt ? reminder.lastSentAt.toISOString() : null,
    createdAt: reminder.createdAt.toISOString(),
  }
}
