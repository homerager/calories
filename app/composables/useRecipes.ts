import { computed } from 'vue'

// Глобальний каталог страв (MenuDish), спільний для всіх користувачів.

export type RecipeSlot = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK'

export interface RecipeIngredient {
  name: string
  amount: string
}

export interface RecipeDetails {
  ingredients: RecipeIngredient[]
  steps: string[]
  tips: string
}

export interface RecipeListItem {
  id: string
  name: string
  slot: RecipeSlot | null
  portionGrams: number
  kcal: number
  protein: number
  fat: number
  carb: number
  foodItemId: string | null
  hasRecipe: boolean
  updatedAt: string
}

export interface RecipeItem extends RecipeListItem {
  details: RecipeDetails | null
}

export interface RecipeSavePayload {
  menuItemId?: string
  foodItemId?: string | null
  name: string
  slot?: RecipeSlot
  portionGrams: number
  kcal: number
  protein: number
  fat: number
  carb: number
  details: RecipeDetails
}

export interface RecipeUpdatePayload {
  name?: string
  slot?: RecipeSlot | null
  portionGrams?: number
  kcal?: number
  protein?: number
  fat?: number
  carb?: number
  details?: RecipeDetails
}

export async function saveRecipe(payload: RecipeSavePayload): Promise<RecipeItem> {
  const res = await $fetch<{ recipe: RecipeItem }>('/api/recipes', {
    method: 'POST',
    body: {
      menuItemId: payload.menuItemId,
      foodItemId: payload.foodItemId || undefined,
      name: payload.name,
      slot: payload.slot,
      portionGrams: payload.portionGrams,
      kcal: payload.kcal,
      protein: payload.protein,
      fat: payload.fat,
      carb: payload.carb,
      details: payload.details,
    },
  })
  await refreshNuxtData('recipes')
  return res.recipe
}

export function useRecipes() {
  const requestFetch = useRequestFetch()

  const { data, pending, refresh } = useAsyncData('recipes', () =>
    requestFetch<{ items: RecipeListItem[] }>('/api/recipes'),
  )

  const items = computed(() => data.value?.items ?? [])

  async function updateRecipe(id: string, payload: RecipeUpdatePayload): Promise<RecipeItem> {
    const res = await $fetch<{ recipe: RecipeItem }>(`/api/recipes/${id}`, {
      method: 'PATCH',
      body: payload,
    })
    await refresh()
    return res.recipe
  }

  function fetchRecipe(id: string): Promise<{ recipe: RecipeItem }> {
    return $fetch<{ recipe: RecipeItem }>(`/api/recipes/${id}`)
  }

  return {
    items,
    pending,
    refresh,
    updateRecipe,
    fetchRecipe,
  }
}
