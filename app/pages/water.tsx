import { defineComponent, reactive, ref } from 'vue'
import { useWater, WATER_DAILY_GOAL_ML, type WaterItem } from '~/composables/useWater'
import { todayIso } from '~/composables/useDiary'

const inputClass =
  'mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200'
const labelClass = 'block text-sm font-medium text-gray-700'

// Денна ціль по воді (мл) для індикатора прогресу.
const DAILY_GOAL_ML = WATER_DAILY_GOAL_ML

// Швидкі кнопки додавання типових обсягів.
const QUICK_VOLUMES = [200, 250, 300, 500]

function parseIntOrNull(value: string): number | null {
  const n = Number(value.trim().replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null
}

function shiftIso(iso: string, deltaDays: number): string {
  const d = new Date(`${iso}T12:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + deltaDays)
  return d.toISOString().slice(0, 10)
}

function timeLabel(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })
}

function dateLabel(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatMl(ml: number): string {
  if (ml >= 1000) {
    const liters = ml / 1000
    return `${liters % 1 === 0 ? liters.toFixed(0) : liters.toFixed(2)} л`
  }
  return `${ml} мл`
}

interface WaterForm {
  volumeMl: string
}

export default defineComponent({
  name: 'WaterPage',
  setup() {
    definePageMeta({ middleware: 'auth' })

    const { date, entries, totalMl, pending, saveWater, deleteWater } = useWater()

    const form = reactive<WaterForm>({ volumeMl: '' })
    const saving = ref(false)
    const saveError = ref<string | null>(null)
    const deletingId = ref<string | null>(null)

    async function addVolume(volumeMl: number) {
      if (!Number.isFinite(volumeMl) || volumeMl <= 0) {
        saveError.value = 'Вкажіть коректний обсяг'
        return
      }
      saving.value = true
      saveError.value = null
      try {
        await saveWater({ volumeMl })
      } catch (err: unknown) {
        saveError.value = extractErrorMessage(err) ?? 'Не вдалося зберегти запис'
      } finally {
        saving.value = false
      }
    }

    async function onSaveCustom() {
      const volumeMl = parseIntOrNull(form.volumeMl)
      if (volumeMl == null) {
        saveError.value = 'Вкажіть обсяг у мілілітрах'
        return
      }
      await addVolume(volumeMl)
      if (!saveError.value) form.volumeMl = ''
    }

    async function onDelete(id: string) {
      deletingId.value = id
      try {
        await deleteWater(id)
      } finally {
        deletingId.value = null
      }
    }

    function entryMeta(e: WaterItem): string {
      // Дата — з обраного дня (measuredAt), реальний час — з моменту створення (createdAt).
      return `${dateLabel(e.measuredAt)}, ${timeLabel(e.createdAt)}`
    }

    return () => {
      const total = totalMl.value
      const percent = Math.min(100, Math.round((total / DAILY_GOAL_ML) * 100))
      const remaining = Math.max(0, DAILY_GOAL_ML - total)

      return (
        <section class="space-y-6">
          {/* Заголовок + навігація по датах */}
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h1 class="text-2xl font-bold text-gray-900">Вода</h1>
            <div class="flex items-center gap-2">
              <button
                type="button"
                onClick={() => (date.value = shiftIso(date.value, -1))}
                class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                aria-label="Попередній день"
              >
                ←
              </button>
              <input
                type="date"
                max={todayIso()}
                value={date.value}
                onInput={(e) => (date.value = (e.target as HTMLInputElement).value || todayIso())}
                class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
              />
              <button
                type="button"
                onClick={() => (date.value = shiftIso(date.value, 1))}
                disabled={date.value >= todayIso()}
                class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                aria-label="Наступний день"
              >
                →
              </button>
              <button
                type="button"
                onClick={() => (date.value = todayIso())}
                class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Сьогодні
              </button>
            </div>
          </div>

          {/* Підсумок дня */}
          <div class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
            <div class="flex items-baseline justify-between">
              <h2 class="text-lg font-semibold text-gray-900">Випито за день</h2>
              <span class="text-2xl font-bold text-brand-600">
                {formatMl(total)}{' '}
                <span class="text-base font-medium text-gray-500">/ {formatMl(DAILY_GOAL_ML)}</span>
              </span>
            </div>

            <div class="mt-4 h-3 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                class="h-full rounded-full bg-brand-500 transition-all"
                style={{ width: `${percent}%` }}
              />
            </div>
            <p class="mt-2 text-xs text-gray-500">
              {remaining > 0
                ? `До цілі залишилось ${formatMl(remaining)}.`
                : 'Денну ціль досягнуто! 🎉'}
            </p>
          </div>

          {/* Додавання */}
          <div class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
            <h2 class="text-lg font-semibold text-gray-900">Додати воду</h2>

            <div class="mt-4 flex flex-wrap gap-2">
              {QUICK_VOLUMES.map((vol) => (
                <button
                  key={vol}
                  type="button"
                  onClick={() => addVolume(vol)}
                  disabled={saving.value}
                  class="rounded-lg border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  +{formatMl(vol)}
                </button>
              ))}
            </div>

            <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <div>
                <label class={labelClass} for="water-volume">Свій обсяг, мл</label>
                <input
                  id="water-volume"
                  type="number"
                  min={1}
                  step="1"
                  value={form.volumeMl}
                  onInput={(e) => (form.volumeMl = (e.target as HTMLInputElement).value)}
                  onKeydown={(e) => e.key === 'Enter' && onSaveCustom()}
                  class={inputClass}
                  placeholder="напр. 350"
                />
              </div>

              <button
                type="button"
                onClick={onSaveCustom}
                disabled={saving.value}
                class="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving.value ? 'Зберігаємо…' : 'Додати'}
              </button>
            </div>

            {saveError.value && <p class="mt-3 text-sm text-red-600">{saveError.value}</p>}
          </div>

          {/* Записи дня */}
          <div class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
            <div class="flex items-baseline justify-between">
              <h2 class="text-lg font-semibold text-gray-900">Записи</h2>
              <span class="text-sm text-gray-500">
                Разом: <strong class="text-gray-800">{formatMl(total)}</strong>
              </span>
            </div>

            {pending.value && entries.value.length === 0 ? (
              <p class="mt-4 text-sm text-gray-400">Завантаження…</p>
            ) : entries.value.length === 0 ? (
              <p class="mt-4 rounded-lg bg-gray-50 px-3 py-6 text-center text-sm text-gray-500">
                Ще немає записів за цей день.
              </p>
            ) : (
              <ul class="mt-4 divide-y divide-gray-100">
                {entries.value.map((e) => (
                  <li key={e.id} class="flex items-center gap-3 py-3">
                    <div class="min-w-0 flex-1">
                      <span class="font-medium text-gray-900">{formatMl(e.volumeMl)}</span>
                      <div class="mt-0.5 text-xs text-gray-500">{entryMeta(e)}</div>
                    </div>
                    <div class="shrink-0 text-right">
                      <button
                        type="button"
                        onClick={() => onDelete(e.id)}
                        disabled={deletingId.value === e.id}
                        class="text-xs text-red-500 hover:text-red-600 disabled:opacity-50"
                      >
                        {deletingId.value === e.id ? 'Видаляємо…' : 'Видалити'}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )
    }
  },
})
