import { computed, ref } from 'vue'
import { todayIso } from '~/utils/day'

// Клієнтський composable для журналу води: записи дня, сума випитого (мл),
// додавання та видалення записів (ручне введення).

export interface WaterItem {
  id: string
  volumeMl: number
  measuredAt: string
  createdAt: string
}

/** Тіло для збереження запису (POST /api/water). */
export interface WaterCreatePayload {
  date?: string
  volumeMl: number
}

interface WaterResponse {
  date: string
  entries: WaterItem[]
  totalMl: number
}

/** Денна ціль по воді (мл) для індикаторів прогресу. */
export const WATER_DAILY_GOAL_ML = 2000

export function useWater() {
  const requestFetch = useRequestFetch()
  const date = ref<string>(todayIso())

  const { data, pending, refresh } = useAsyncData(
    'water',
    () =>
      requestFetch<WaterResponse>('/api/water', {
        query: { date: date.value },
      }),
    { watch: [date] },
  )

  const entries = computed<WaterItem[]>(() => data.value?.entries ?? [])
  const totalMl = computed<number>(() => data.value?.totalMl ?? 0)
  const goalMl = computed<number>(() => WATER_DAILY_GOAL_ML)

  /** Додає запис і оновлює список/суму. */
  async function saveWater(payload: WaterCreatePayload): Promise<void> {
    await $fetch('/api/water', {
      method: 'POST',
      body: { ...payload, date: payload.date ?? date.value },
    })
    await refresh()
  }

  /** Швидке додавання обсягу (мл) для поточного дня. */
  async function addWater(volumeMl: number): Promise<void> {
    await saveWater({ volumeMl })
  }

  /** Видаляє запис і оновлює список/суму. */
  async function deleteWater(id: string): Promise<void> {
    await $fetch(`/api/water/${id}`, { method: 'DELETE' })
    await refresh()
  }

  return {
    date,
    entries,
    totalMl,
    goalMl,
    pending,
    saveWater,
    addWater,
    deleteWater,
    refresh,
  }
}
