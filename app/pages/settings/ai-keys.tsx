import { defineComponent, reactive, ref, watch, computed } from 'vue'
import {
  useAiSettings,
  AI_PROVIDERS,
  PROVIDER_LABELS,
  type AiProvider,
} from '~/composables/useAiSettings'
import { useToast } from '~/composables/useToast'
import { btnPrimaryClass, btnSecondaryClass, inputClass, labelClass } from '~/utils/ui'

// Підказки, де взяти ключ, і приклад формату (для placeholder).
const KEY_HINTS: Record<AiProvider, string> = {
  OPENAI: 'напр. sk-...',
  ANTHROPIC: 'напр. sk-ant-...',
  GEMINI: 'напр. AIza...',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('uk-UA', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

export default defineComponent({
  name: 'AiKeysSettingsPage',
  setup() {
    definePageMeta({ middleware: 'auth' })

    const { settings, keys, pending, saveSettings, saveKey, deleteKey } = useAiSettings()
    const toast = useToast()

    // Форма налаштувань (провайдер + моделі per-provider).
    const form = reactive<{
      preferredProvider: AiProvider | ''
      models: Record<AiProvider, string>
    }>({
      preferredProvider: '',
      models: { OPENAI: '', ANTHROPIC: '', GEMINI: '' },
    })

    watch(
      settings,
      (s) => {
        if (!s) return
        form.preferredProvider = s.preferredProvider ?? ''
        form.models.OPENAI = s.models.OPENAI ?? ''
        form.models.ANTHROPIC = s.models.ANTHROPIC ?? ''
        form.models.GEMINI = s.models.GEMINI ?? ''
      },
      { immediate: true },
    )

    const savingSettings = ref(false)

    async function onSaveSettings(e: Event) {
      e.preventDefault()
      savingSettings.value = true
      try {
        await saveSettings({
          preferredProvider: form.preferredProvider || null,
          openaiModel: form.models.OPENAI.trim() || null,
          anthropicModel: form.models.ANTHROPIC.trim() || null,
          geminiModel: form.models.GEMINI.trim() || null,
        })
        toast.success('Налаштування збережено')
      } catch (err: unknown) {
        toast.error(extractErrorMessage(err) ?? 'Не вдалося зберегти налаштування')
      } finally {
        savingSettings.value = false
      }
    }

    // Стан керування ключами (по провайдеру).
    const keyInput = reactive<Record<AiProvider, string>>({ OPENAI: '', ANTHROPIC: '', GEMINI: '' })
    const keyBusy = reactive<Record<AiProvider, boolean>>({
      OPENAI: false,
      ANTHROPIC: false,
      GEMINI: false,
    })

    const keyByProvider = computed<Record<AiProvider, string | null>>(() => {
      const map: Record<AiProvider, string | null> = { OPENAI: null, ANTHROPIC: null, GEMINI: null }
      for (const k of keys.value) map[k.provider] = k.maskedKey
      return map
    })

    async function onSaveKey(provider: AiProvider) {
      const value = keyInput[provider].trim()
      if (value.length < 20) {
        toast.error('Ключ виглядає надто коротким')
        return
      }
      keyBusy[provider] = true
      try {
        await saveKey(provider, value)
        keyInput[provider] = ''
        toast.success('Ключ збережено')
      } catch (err: unknown) {
        toast.error(extractErrorMessage(err) ?? 'Не вдалося зберегти ключ')
      } finally {
        keyBusy[provider] = false
      }
    }

    async function onDeleteKey(provider: AiProvider) {
      keyBusy[provider] = true
      try {
        await deleteKey(provider)
        toast.success('Ключ видалено')
      } catch (err: unknown) {
        toast.error(extractErrorMessage(err) ?? 'Не вдалося видалити ключ')
      } finally {
        keyBusy[provider] = false
      }
    }

    function quotaCard() {
      const q = settings.value?.freeQuota
      if (!q) return null
      const pct = q.limit > 0 ? Math.min(100, Math.round((q.used / q.limit) * 100)) : 0
      return (
        <div class="rounded-2xl bg-card p-6 shadow-sm ring-1 ring-gray-100">
          <h2 class="text-lg font-semibold text-gray-900">Безкоштовна квота</h2>
          <p class="mt-1 text-sm text-gray-500">
            Використовується, коли для обраного провайдера немає вашого ключа (сервісний fallback).
          </p>
          <div class="mt-4 flex items-baseline justify-between text-sm">
            <span class="text-gray-600">
              Використано <strong class="text-gray-900">{q.used}</strong> із {q.limit}
            </span>
            <span class="text-gray-500">оновлення {formatDate(q.resetAt)}</span>
          </div>
          <div class="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              class="h-full rounded-full bg-brand-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )
    }

    return () => (
      <section class="space-y-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Налаштування AI</h1>
          <p class="mt-1 text-sm text-gray-500">
            Оберіть провайдера й моделі та додайте власні API-ключі. Ключі зберігаються зашифровано
            й ніколи не показуються повністю.
          </p>
        </div>

        {/* Провайдер + моделі */}
        <form class="rounded-2xl bg-card p-6 shadow-sm ring-1 ring-gray-100" onSubmit={onSaveSettings}>
          <h2 class="text-lg font-semibold text-gray-900">Провайдер і моделі</h2>

          <div class="mt-4">
            <label class={labelClass} for="preferredProvider">
              Провайдер за замовчуванням
            </label>
            <select
              id="preferredProvider"
              value={form.preferredProvider}
              onChange={(e) =>
                (form.preferredProvider = (e.target as HTMLSelectElement).value as AiProvider | '')
              }
              class={inputClass}
            >
              <option value="">
                Авто{settings.value?.defaultProvider
                  ? ` (${PROVIDER_LABELS[settings.value.defaultProvider]})`
                  : ''}
              </option>
              {AI_PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {PROVIDER_LABELS[p]}
                </option>
              ))}
            </select>
            <p class="mt-1 text-xs text-gray-500">
              «Авто» використовує базового провайдера сервера, якщо ви не оберете конкретного.
            </p>
          </div>

          <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {AI_PROVIDERS.map((p) => (
              <div key={p}>
                <label class={labelClass} for={`model-${p}`}>
                  Модель · {PROVIDER_LABELS[p]}
                </label>
                <input
                  id={`model-${p}`}
                  type="text"
                  value={form.models[p]}
                  onInput={(e) => (form.models[p] = (e.target as HTMLInputElement).value)}
                  class={inputClass}
                  placeholder={settings.value?.effectiveModels[p] ?? ''}
                />
              </div>
            ))}
          </div>
          <p class="mt-1 text-xs text-gray-500">
            Залиште поле порожнім, щоб використовувати базову модель сервера (показана як підказка).
          </p>

          <button
            type="submit"
            disabled={savingSettings.value || pending.value}
            aria-busy={savingSettings.value}
            class={`${btnPrimaryClass} mt-6 w-full sm:w-auto`}
          >
            {savingSettings.value ? 'Зберігаємо…' : 'Зберегти налаштування'}
          </button>
        </form>

        {quotaCard()}

        {/* Власні ключі */}
        <div class="rounded-2xl bg-card p-6 shadow-sm ring-1 ring-gray-100">
          <h2 class="text-lg font-semibold text-gray-900">Власні API-ключі</h2>
          <p class="mt-1 text-sm text-gray-600">
            Додайте свій ключ, щоб запити йшли через ваш акаунт без обмежень безкоштовної квоти.
          </p>

          <div class="mt-4 space-y-4">
            {AI_PROVIDERS.map((p) => {
              const avail = settings.value?.providers[p]
              const masked = keyByProvider.value[p]
              return (
                <div key={p} class="rounded-xl border border-gray-200 p-4">
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <span class="font-medium text-gray-900">{PROVIDER_LABELS[p]}</span>
                    {masked ? (
                      <span class="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
                        Ваш ключ: {masked}
                      </span>
                    ) : avail?.hasServiceKey ? (
                      <span class="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                        Сервісний ключ
                      </span>
                    ) : (
                      <span class="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                        Ключ не налаштовано
                      </span>
                    )}
                  </div>

                  <div class="mt-3 flex flex-wrap items-end gap-3">
                    <div class="min-w-0 md:w-auto w-full md:flex-1">
                      <label class={labelClass} for={`key-${p}`}>
                        {masked ? 'Оновити ключ' : 'Додати ключ'}
                      </label>
                      <input
                        id={`key-${p}`}
                        type="password"
                        autocomplete="off"
                        value={keyInput[p]}
                        onInput={(e) => (keyInput[p] = (e.target as HTMLInputElement).value)}
                        class={inputClass}
                        placeholder={KEY_HINTS[p]}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => onSaveKey(p)}
                      disabled={keyBusy[p]}
                      aria-busy={keyBusy[p]}
                      class={btnPrimaryClass}
                    >
                      {keyBusy[p] ? 'Зберігаємо…' : 'Зберегти'}
                    </button>
                    {masked && (
                      <button
                        type="button"
                        onClick={() => onDeleteKey(p)}
                        disabled={keyBusy[p]}
                        class={btnSecondaryClass}
                      >
                        Видалити
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>
    )
  },
})
