import { computed } from 'vue'

// Клієнтський composable для роботи з профілем і історією зважувань.
// Типи навмисно локальні (рядкові літерали), щоб не тягнути серверні залежності.

export type Sex = 'MALE' | 'FEMALE' | 'OTHER'
export type ActivityLevel = 'SEDENTARY' | 'LIGHT' | 'MODERATE' | 'ACTIVE' | 'VERY_ACTIVE'
export type Goal = 'LOSE' | 'MAINTAIN' | 'GAIN'

/** Дані профілю, які надсилаємо на сервер. */
export interface ProfileForm {
  name: string | null
  sex: Sex | null
  birthDate: string | null
  age: number | null
  heightCm: number | null
  weightKg: number | null
  targetWeightKg: number | null
  activityLevel: ActivityLevel
  goal: Goal
}

/** Профіль із розрахованими нормами (відповідь сервера). */
export interface ProfileData extends ProfileForm {
  dailyKcal: number | null
  proteinGrams: number | null
  fatGrams: number | null
  carbGrams: number | null
}

export interface WeightPoint {
  id: string
  weightKg: number
  measuredAt: string
}

export function useProfile() {
  // useRequestFetch форвардить cookie сесії під час SSR (на відміну від голого $fetch).
  const requestFetch = useRequestFetch()

  const {
    data: profileData,
    pending: profilePending,
    refresh: refreshProfile,
  } = useAsyncData('profile', () => requestFetch<{ profile: ProfileData | null }>('/api/profile'))

  const {
    data: weightData,
    pending: weightPending,
    refresh: refreshWeight,
  } = useAsyncData('weight-history', () => requestFetch<{ entries: WeightPoint[] }>('/api/weight'))

  const profile = computed<ProfileData | null>(() => profileData.value?.profile ?? null)
  const weightHistory = computed<WeightPoint[]>(() => weightData.value?.entries ?? [])
  const pending = computed(() => profilePending.value || weightPending.value)

  /** Зберігає профіль і повертає оновлені дані з нормами. */
  async function save(payload: ProfileForm): Promise<ProfileData | null> {
    const res = await $fetch<{ profile: ProfileData }>('/api/profile', {
      method: 'PUT',
      body: payload,
    })
    profileData.value = res
    await refreshWeight()
    return res.profile
  }

  /** Додає зважування й оновлює профіль/історію. */
  async function addWeight(weightKg: number, measuredAt?: string | null): Promise<void> {
    await $fetch('/api/weight', {
      method: 'POST',
      body: { weightKg, measuredAt: measuredAt || undefined },
    })
    await Promise.all([refreshWeight(), refreshProfile()])
  }

  return {
    profile,
    weightHistory,
    pending,
    save,
    addWeight,
    refreshProfile,
    refreshWeight,
  }
}
