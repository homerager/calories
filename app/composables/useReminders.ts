import { computed } from 'vue'

// Клієнтський composable для нагадувань: список, створення, редагування, видалення.

export type ReminderKind = 'MEAL' | 'WATER' | 'WEIGH_IN' | 'CUSTOM'

export interface ReminderItem {
  id: string
  kind: ReminderKind
  message: string | null
  timeOfDay: string
  daysOfWeek: number[]
  enabled: boolean
  lastSentAt: string | null
  createdAt: string
}

export interface ReminderInput {
  kind: ReminderKind
  message?: string | null
  timeOfDay: string
  daysOfWeek: number[]
  enabled: boolean
}

export const REMINDER_KINDS: ReminderKind[] = ['MEAL', 'WATER', 'WEIGH_IN', 'CUSTOM']

export const REMINDER_KIND_LABELS: Record<ReminderKind, string> = {
  MEAL: 'Прийом їжі',
  WATER: 'Вода',
  WEIGH_IN: 'Зважування',
  CUSTOM: 'Інше',
}

export const WEEKDAY_LABELS = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']

export function useReminders() {
  const requestFetch = useRequestFetch()

  const { data, pending, refresh } = useAsyncData('reminders', () =>
    requestFetch<{ reminders: ReminderItem[] }>('/api/reminders'),
  )

  const reminders = computed<ReminderItem[]>(() => data.value?.reminders ?? [])

  /** Створює нагадування й оновлює список. */
  async function addReminder(payload: ReminderInput): Promise<void> {
    await $fetch('/api/reminders', { method: 'POST', body: payload })
    await refresh()
  }

  /** Часткове оновлення нагадування (напр. toggle enabled) й оновлення списку. */
  async function updateReminder(id: string, payload: Partial<ReminderInput>): Promise<void> {
    await $fetch(`/api/reminders/${id}`, { method: 'PATCH', body: payload })
    await refresh()
  }

  /** Видаляє нагадування й оновлює список. */
  async function deleteReminder(id: string): Promise<void> {
    await $fetch(`/api/reminders/${id}`, { method: 'DELETE' })
    await refresh()
  }

  return {
    reminders,
    pending,
    addReminder,
    updateReminder,
    deleteReminder,
    refresh,
  }
}
