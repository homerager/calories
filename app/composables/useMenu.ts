import { computed } from 'vue'

// Клієнтський composable для меню на тиждень: поточний план, генерація, застосування.

export type MenuSlot = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK'
// Локально (без export), щоб не колідувати з AiProvider із інших composables при авто-імпорті.
type AiProvider = 'OPENAI' | 'ANTHROPIC' | 'GEMINI'

export interface MenuItem {
  id: string
  dayIndex: number
  slot: MenuSlot
  name: string
  portionGrams: number
  kcal: number
  protein: number
  fat: number
  carb: number
  foodItemId: string | null
}

export interface MenuPlan {
  id: string
  startDate: string
  createdAt: string
  items: MenuItem[]
}

export interface MenuNorms {
  dailyKcal: number | null
  proteinGrams: number | null
  fatGrams: number | null
  carbGrams: number | null
}

export interface GenerateResponse {
  plan: MenuPlan
  provider: AiProvider
  model: string
  usingFallback: boolean
}

export interface ApplyResponse {
  applied: number
  date: string
  totals: {
    totalKcal: number
    totalProtein: number
    totalFat: number
    totalCarb: number
  }
}

export function useMenu() {
  const requestFetch = useRequestFetch()

  const {
    data: menuData,
    pending,
    refresh,
  } = useAsyncData('menu-plan', () => requestFetch<{ plan: MenuPlan | null }>('/api/menu'))

  // Норми беремо з профілю (ключ 'profile' дедуплікується з іншими сторінками).
  const { data: profileData } = useAsyncData('profile', () =>
    requestFetch<{ profile: (MenuNorms & Record<string, unknown>) | null }>('/api/profile'),
  )

  const plan = computed<MenuPlan | null>(() => menuData.value?.plan ?? null)
  const norms = computed<MenuNorms>(() => ({
    dailyKcal: profileData.value?.profile?.dailyKcal ?? null,
    proteinGrams: profileData.value?.profile?.proteinGrams ?? null,
    fatGrams: profileData.value?.profile?.fatGrams ?? null,
    carbGrams: profileData.value?.profile?.carbGrams ?? null,
  }))

  /** Генерує нове меню й оновлює поточний план. */
  async function generate(provider?: AiProvider): Promise<GenerateResponse> {
    const res = await $fetch<GenerateResponse>('/api/menu/generate', {
      method: 'POST',
      body: { provider },
    })
    await refresh()
    return res
  }

  /** Додає всі страви дня у щоденник на відповідну дату. */
  function applyDay(planId: string, dayIndex: number, date: string): Promise<ApplyResponse> {
    return $fetch<ApplyResponse>('/api/menu/apply', {
      method: 'POST',
      body: { planId, dayIndex, date },
    })
  }

  /** Додає одну страву меню у щоденник. */
  function applyItem(planId: string, itemId: string, date: string): Promise<ApplyResponse> {
    return $fetch<ApplyResponse>('/api/menu/apply', {
      method: 'POST',
      body: { planId, itemId, date },
    })
  }

  return { plan, norms, pending, refresh, generate, applyDay, applyItem }
}
