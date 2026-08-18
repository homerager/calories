import { computed, ref } from 'vue'

// Клієнтський composable для сторінки статистики: діапазон день/тиждень/місяць,
// добові точки, суми, середні та норми (для прогресу відносно норм).

export type StatsRange = 'day' | 'week' | 'month'

export interface StatsDay {
  date: string
  kcal: number
  protein: number
  fat: number
  carb: number
}

export interface StatsMacros {
  kcal: number
  protein: number
  fat: number
  carb: number
}

export interface StatsNorms {
  dailyKcal: number | null
  proteinGrams: number | null
  fatGrams: number | null
  carbGrams: number | null
}

export interface StatsResponse {
  range: StatsRange
  from: string
  to: string
  totalDays: number
  loggedDays: number
  norms: StatsNorms
  days: StatsDay[]
  totals: StatsMacros
  averages: StatsMacros
}

const EMPTY_MACROS: StatsMacros = { kcal: 0, protein: 0, fat: 0, carb: 0 }
const EMPTY_NORMS: StatsNorms = {
  dailyKcal: null,
  proteinGrams: null,
  fatGrams: null,
  carbGrams: null,
}

export function useStats() {
  const requestFetch = useRequestFetch()
  const range = ref<StatsRange>('week')

  const { data, pending, refresh } = useAsyncData(
    'stats',
    () => requestFetch<StatsResponse>('/api/stats', { query: { range: range.value } }),
    { watch: [range] },
  )

  const days = computed<StatsDay[]>(() => data.value?.days ?? [])
  const totals = computed<StatsMacros>(() => data.value?.totals ?? EMPTY_MACROS)
  const averages = computed<StatsMacros>(() => data.value?.averages ?? EMPTY_MACROS)
  const norms = computed<StatsNorms>(() => data.value?.norms ?? EMPTY_NORMS)
  const loggedDays = computed(() => data.value?.loggedDays ?? 0)
  const totalDays = computed(() => data.value?.totalDays ?? 0)

  return {
    range,
    days,
    totals,
    averages,
    norms,
    loggedDays,
    totalDays,
    pending,
    refresh,
  }
}
