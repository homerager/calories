import { computed } from 'vue'

// Клієнтський composable для персональних AI-налаштувань і власних ключів.
// Типи локальні (рядкові літерали), щоб не тягнути серверні залежності.

export type AiProvider = 'OPENAI' | 'ANTHROPIC' | 'GEMINI'

export interface ProviderAvailability {
  hasUserKey: boolean
  hasServiceKey: boolean
}

export interface FreeQuotaStatus {
  limit: number
  used: number
  remaining: number
  periodStart: string
  resetAt: string
}

/** Відповідь GET /api/ai-settings. */
export interface AiSettingsData {
  preferredProvider: AiProvider | null
  models: Record<AiProvider, string | null>
  effectiveModels: Record<AiProvider, string>
  defaultProvider: AiProvider | null
  providers: Record<AiProvider, ProviderAvailability>
  freeQuota: FreeQuotaStatus
}

/** Тіло POST /api/ai-settings. */
export interface AiSettingsUpdate {
  preferredProvider: AiProvider | null
  openaiModel: string | null
  anthropicModel: string | null
  geminiModel: string | null
}

/** Елемент списку власних ключів (замаскований). */
export interface AiKeyInfo {
  provider: AiProvider
  maskedKey: string
  createdAt: string
  updatedAt: string
}

export const AI_PROVIDERS: AiProvider[] = ['OPENAI', 'ANTHROPIC', 'GEMINI']

export const PROVIDER_LABELS: Record<AiProvider, string> = {
  OPENAI: 'OpenAI',
  ANTHROPIC: 'Anthropic (Claude)',
  GEMINI: 'Google Gemini',
}

export function useAiSettings() {
  // useRequestFetch форвардить cookie сесії під час SSR.
  const requestFetch = useRequestFetch()

  const {
    data: settingsData,
    pending: settingsPending,
    refresh: refreshSettings,
  } = useAsyncData('ai-settings', () =>
    requestFetch<{ settings: AiSettingsData }>('/api/ai-settings'),
  )

  const {
    data: keysData,
    pending: keysPending,
    refresh: refreshKeys,
  } = useAsyncData('ai-keys', () => requestFetch<{ keys: AiKeyInfo[] }>('/api/ai-keys'))

  const settings = computed<AiSettingsData | null>(() => settingsData.value?.settings ?? null)
  const keys = computed<AiKeyInfo[]>(() => keysData.value?.keys ?? [])
  const pending = computed(() => settingsPending.value || keysPending.value)

  /** Зберігає налаштування (провайдер + моделі) і оновлює стан. */
  async function saveSettings(payload: AiSettingsUpdate): Promise<AiSettingsData> {
    const res = await $fetch<{ settings: AiSettingsData }>('/api/ai-settings', {
      method: 'POST',
      body: payload,
    })
    settingsData.value = res
    return res.settings
  }

  /** Додає/оновлює власний ключ провайдера й оновлює списки. */
  async function saveKey(provider: AiProvider, apiKey: string): Promise<void> {
    const res = await $fetch<{ keys: AiKeyInfo[] }>('/api/ai-keys', {
      method: 'POST',
      body: { provider, apiKey },
    })
    keysData.value = res
    await refreshSettings()
  }

  /** Видаляє ключ провайдера й оновлює списки. */
  async function deleteKey(provider: AiProvider): Promise<void> {
    const res = await $fetch<{ keys: AiKeyInfo[] }>('/api/ai-keys', {
      method: 'DELETE',
      query: { provider },
    })
    keysData.value = res
    await refreshSettings()
  }

  return {
    settings,
    keys,
    pending,
    saveSettings,
    saveKey,
    deleteKey,
    refreshSettings,
    refreshKeys,
  }
}
