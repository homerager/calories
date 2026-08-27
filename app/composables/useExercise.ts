import { computed, ref } from 'vue'
import { todayIso } from '~/utils/day'

// Клієнтський composable для журналу активності: записи дня, сума спалених калорій,
// додавання та видалення записів (ручне введення).

export interface ExerciseItem {
  id: string
  name: string
  durationMin: number | null
  steps: number | null
  kcalBurned: number | null
  performedAt: string
  createdAt: string
}

/** Тіло для збереження запису (POST /api/exercises). */
export interface ExerciseCreatePayload {
  date?: string
  name: string
  durationMin?: number | null
  steps?: number | null
  kcalBurned?: number | null
}

interface ExercisesResponse {
  date: string
  entries: ExerciseItem[]
  totalKcalBurned: number
}

export function useExercise() {
  const requestFetch = useRequestFetch()
  const date = ref<string>(todayIso())

  const { data, pending, refresh } = useAsyncData(
    'exercises',
    () =>
      requestFetch<ExercisesResponse>('/api/exercises', {
        query: { date: date.value },
      }),
    { watch: [date] },
  )

  const entries = computed<ExerciseItem[]>(() => data.value?.entries ?? [])
  const totalKcalBurned = computed<number>(() => data.value?.totalKcalBurned ?? 0)

  /** Додає запис і оновлює список/суму. */
  async function saveExercise(payload: ExerciseCreatePayload): Promise<void> {
    await $fetch('/api/exercises', {
      method: 'POST',
      body: { ...payload, date: payload.date ?? date.value },
    })
    await refresh()
  }

  /** Видаляє запис і оновлює список/суму. */
  async function deleteExercise(id: string): Promise<void> {
    await $fetch(`/api/exercises/${id}`, { method: 'DELETE' })
    await refresh()
  }

  return {
    date,
    entries,
    totalKcalBurned,
    pending,
    saveExercise,
    deleteExercise,
    refresh,
  }
}
