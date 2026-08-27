import { computed, ref } from 'vue'
import { todayIso } from '~/utils/day'

// Клієнтський composable для щоденника: записи дня, норми, розпізнавання та збереження.

export type MealSlot = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK'
export type MealSource = 'AI_PHOTO' | 'AI_TEXT' | 'MANUAL'
// Локально (без export), щоб не колідувати з AiProvider із useAiSettings при авто-імпорті.
type AiProvider = 'OPENAI' | 'ANTHROPIC' | 'GEMINI'

export interface DailyTotals {
  totalKcal: number
  totalProtein: number
  totalFat: number
  totalCarb: number
}

export interface MealItem {
  id: string
  date: string
  slot: MealSlot | null
  name: string
  portionGrams: number
  kcal: number
  protein: number
  fat: number
  carb: number
  source: MealSource
  confidence: number | null
  createdAt: string
}

export interface RecognizeDraft {
  name: string
  portionGrams: number
  kcal: number
  protein: number
  fat: number
  carb: number
  confidence: number
  per100: { kcal: number; protein: number; fat: number; carb: number }
  foodItemId: string | null
  suggestedSource: MealSource
}

export interface RecognizeResponse {
  cacheHit: boolean
  provider: AiProvider | null
  model: string | null
  usingFallback: boolean
  draft: RecognizeDraft
}

/** Тіло для збереження запису (POST /api/meals). */
export interface MealCreatePayload {
  date?: string
  slot?: MealSlot | null
  name: string
  portionGrams: number
  kcal: number
  protein: number
  fat: number
  carb: number
  source: MealSource
  confidence?: number | null
  foodItemId?: string | null
  rawAiJson?: unknown
}

/** Тіло для редагування запису (PATCH /api/meals/:id). */
export interface MealUpdatePayload {
  slot?: MealSlot | null
  name: string
  portionGrams: number
  kcal: number
  protein: number
  fat: number
  carb: number
  source?: MealSource
  confidence?: number | null
  foodItemId?: string | null
}

/** Норми з профілю (для прогрес-барів). */
export interface Norms {
  dailyKcal: number | null
  proteinGrams: number | null
  fatGrams: number | null
  carbGrams: number | null
}

/** Страва з особистої бази (вже була у прийомах їжі). */
export interface MyDish {
  foodItemId: string
  name: string
  per100: { kcal: number; protein: number; fat: number; carb: number }
  timesUsed: number
  lastUsedAt: string | null
  lastPortionGrams: number
  favorite?: boolean
  similarity?: number | null
  match?: 'exact' | 'lexical' | 'semantic'
}

/** Збіг пошуку в довіднику (автопідказки). */
export interface FoodSearchHit {
  id: string
  name: string
  kcalPer100: number
  proteinPer100: number
  fatPer100: number
  carbPer100: number
  similarity: number | null
  match: 'exact' | 'lexical' | 'semantic'
}

export function useDiary() {
  const requestFetch = useRequestFetch()
  const date = ref<string>(todayIso())

  const {
    data: mealsData,
    pending: mealsPending,
    refresh: refreshMeals,
  } = useAsyncData(
    'diary-meals',
    () =>
      requestFetch<{ date: string; entries: MealItem[]; totals: DailyTotals }>('/api/meals', {
        query: { date: date.value },
      }),
    { watch: [date] },
  )

  // Норми беремо з профілю (ключ 'profile' дедуплікується з іншими сторінками).
  const { data: profileData } = useAsyncData('profile', () =>
    requestFetch<{ profile: (Norms & Record<string, unknown>) | null }>('/api/profile'),
  )

  const meals = computed<MealItem[]>(() => mealsData.value?.entries ?? [])
  const totals = computed<DailyTotals>(
    () =>
      mealsData.value?.totals ?? {
        totalKcal: 0,
        totalProtein: 0,
        totalFat: 0,
        totalCarb: 0,
      },
  )
  const norms = computed<Norms>(() => ({
    dailyKcal: profileData.value?.profile?.dailyKcal ?? null,
    proteinGrams: profileData.value?.profile?.proteinGrams ?? null,
    fatGrams: profileData.value?.profile?.fatGrams ?? null,
    carbGrams: profileData.value?.profile?.carbGrams ?? null,
  }))
  const pending = computed(() => mealsPending.value)

  /** Розпізнавання за текстовим описом. */
  function recognizeText(text: string, provider?: AiProvider): Promise<RecognizeResponse> {
    return $fetch<RecognizeResponse>('/api/food/recognize', {
      method: 'POST',
      body: { kind: 'TEXT', text, provider },
    })
  }

  /** Розпізнавання за фото (base64 без префіксу). */
  function recognizeImage(
    imageBase64: string,
    mimeType: string,
    provider?: AiProvider,
  ): Promise<RecognizeResponse> {
    return $fetch<RecognizeResponse>('/api/food/recognize', {
      method: 'POST',
      body: { kind: 'IMAGE', imageBase64, mimeType, provider },
    })
  }

  /** Зберігає запис і оновлює список/суми. */
  async function saveMeal(payload: MealCreatePayload): Promise<void> {
    await $fetch('/api/meals', { method: 'POST', body: { ...payload, date: payload.date ?? date.value } })
    await refreshMeals()
  }

  /** Оновлює наявний запис і оновлює список/суми. */
  async function updateMeal(id: string, payload: MealUpdatePayload): Promise<void> {
    await $fetch(`/api/meals/${id}`, { method: 'PATCH', body: payload })
    await refreshMeals()
  }

  /** Видаляє запис і оновлює список/суми. */
  async function deleteMeal(id: string): Promise<void> {
    await $fetch(`/api/meals/${id}`, { method: 'DELETE' })
    await refreshMeals()
  }

  /** Особиста база страв, що вже були у прийомах їжі. Опційний `q` — гібридний пошук. */
  function fetchMyDishes(q?: string): Promise<{ items: MyDish[] }> {
    const query = q && q.trim().length >= 2 ? { q: q.trim() } : undefined
    return $fetch<{ items: MyDish[] }>('/api/food-items/my', { query })
  }

  /** Пошук у довіднику (лексика + семантика) для автопідказок. */
  function searchFood(q: string, limit = 8): Promise<{ items: FoodSearchHit[] }> {
    return $fetch<{ items: FoodSearchHit[] }>('/api/food-items/search', {
      query: { q, limit },
    })
  }

  async function copyMeals(fromDate: string, toDate: string): Promise<{ copied: number }> {
    const res = await $fetch<{ copied: number }>('/api/meals/copy', {
      method: 'POST',
      body: { fromDate, toDate },
    })
    await refreshMeals()
    return res
  }

  async function setFavorite(foodItemId: string, favorite: boolean): Promise<void> {
    if (favorite) {
      await $fetch('/api/food-items/favorites', { method: 'POST', body: { foodItemId } })
    } else {
      await $fetch(`/api/food-items/favorites/${foodItemId}`, { method: 'DELETE' })
    }
  }

  return {
    date,
    meals,
    totals,
    norms,
    pending,
    recognizeText,
    recognizeImage,
    saveMeal,
    updateMeal,
    deleteMeal,
    refreshMeals,
    fetchMyDishes,
    searchFood,
    copyMeals,
    setFavorite,
  }
}
