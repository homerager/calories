import { computed, defineComponent, reactive, ref } from 'vue'
import { useExercise, type ExerciseItem } from '~/composables/useExercise'
import { useProfile } from '~/composables/useProfile'
import { todayIso } from '~/composables/useDiary'

// Оцінка калорій за кроками (дзеркало server/utils/steps.ts):
// ~0.04 ккал/крок для 70 кг, лінійно від ваги. За відсутності ваги — 70 кг.
const DEFAULT_WEIGHT_KG = 70
const KCAL_PER_STEP_PER_KG = 0.04 / DEFAULT_WEIGHT_KG

function kcalFromSteps(steps: number, weightKg?: number | null): number {
  if (!Number.isFinite(steps) || steps <= 0) return 0
  const weight = weightKg && weightKg > 0 ? weightKg : DEFAULT_WEIGHT_KG
  return Math.round(steps * weight * KCAL_PER_STEP_PER_KG)
}

const inputClass =
  'mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200'
const labelClass = 'block text-sm font-medium text-gray-700'

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

interface ExerciseForm {
  name: string
  durationMin: string
  steps: string
  kcalBurned: string
}

export default defineComponent({
  name: 'ExercisePage',
  setup() {
    definePageMeta({ middleware: 'auth' })

    const { date, entries, totalKcalBurned, pending, saveExercise, deleteExercise } = useExercise()
    const { profile } = useProfile()

    const form = reactive<ExerciseForm>({ name: '', durationMin: '', steps: '', kcalBurned: '' })
    const saving = ref(false)
    const saveError = ref<string | null>(null)
    const deletingId = ref<string | null>(null)

    // Оцінка калорій за введеними кроками (для підказки у формі).
    const stepsKcalEstimate = computed<number | null>(() => {
      const steps = parseIntOrNull(form.steps)
      if (steps == null) return null
      return kcalFromSteps(steps, profile.value?.weightKg)
    })

    async function onSave() {
      const name = form.name.trim()
      if (!name) {
        saveError.value = 'Вкажіть назву активності'
        return
      }
      saving.value = true
      saveError.value = null
      try {
        await saveExercise({
          name,
          durationMin: parseIntOrNull(form.durationMin),
          steps: parseIntOrNull(form.steps),
          kcalBurned: parseIntOrNull(form.kcalBurned),
        })
        form.name = ''
        form.durationMin = ''
        form.steps = ''
        form.kcalBurned = ''
      } catch (err: unknown) {
        saveError.value = extractErrorMessage(err) ?? 'Не вдалося зберегти запис'
      } finally {
        saving.value = false
      }
    }

    async function onDelete(id: string) {
      deletingId.value = id
      try {
        await deleteExercise(id)
      } finally {
        deletingId.value = null
      }
    }

    function entryMeta(e: ExerciseItem): string {
      // Дата — з обраного дня (performedAt), реальний час — з моменту створення (createdAt).
      const parts: string[] = [`${dateLabel(e.performedAt)}, ${timeLabel(e.createdAt)}`]
      if (e.durationMin != null) parts.push(`${e.durationMin} хв`)
      if (e.steps != null) parts.push(`${e.steps.toLocaleString('uk-UA')} кроків`)
      return parts.join(' · ')
    }

    return () => (
      <section class="space-y-6">
        {/* Заголовок + навігація по датах */}
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h1 class="text-2xl font-bold text-gray-900">Активність</h1>
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
            <h2 class="text-lg font-semibold text-gray-900">Спалено за день</h2>
            <span class="text-2xl font-bold text-brand-600">
              {Math.round(totalKcalBurned.value)} <span class="text-base font-medium text-gray-500">ккал</span>
            </span>
          </div>
          <p class="mt-2 text-xs text-gray-500">
            Дані вводяться вручну. Для ходьби можна вказати кроки — калорії порахуються автоматично за вагою профілю.
            Пізніше сюди можна буде імпортувати активність із Mi Fitness/Zepp.
          </p>
        </div>

        {/* Додавання */}
        <div class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
          <h2 class="text-lg font-semibold text-gray-900">Додати активність</h2>

          <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div class="sm:col-span-2">
              <label class={labelClass} for="ex-name">Назва</label>
              <input
                id="ex-name"
                type="text"
                value={form.name}
                onInput={(e) => (form.name = (e.target as HTMLInputElement).value)}
                onKeydown={(e) => e.key === 'Enter' && onSave()}
                class={inputClass}
                placeholder="напр. Біг, Ходьба, Силове тренування"
              />
            </div>

            <div>
              <label class={labelClass} for="ex-duration">Тривалість, хв</label>
              <input
                id="ex-duration"
                type="number"
                min={1}
                step="1"
                value={form.durationMin}
                onInput={(e) => (form.durationMin = (e.target as HTMLInputElement).value)}
                class={inputClass}
                placeholder="напр. 30"
              />
            </div>

            <div>
              <label class={labelClass} for="ex-steps">Кроки</label>
              <input
                id="ex-steps"
                type="number"
                min={1}
                step="1"
                value={form.steps}
                onInput={(e) => (form.steps = (e.target as HTMLInputElement).value)}
                class={inputClass}
                placeholder="напр. 8000"
              />
            </div>

            <div>
              <label class={labelClass} for="ex-kcal">Спалено, ккал</label>
              <input
                id="ex-kcal"
                type="number"
                min={0}
                step="1"
                value={form.kcalBurned}
                onInput={(e) => (form.kcalBurned = (e.target as HTMLInputElement).value)}
                class={inputClass}
                placeholder={
                  stepsKcalEstimate.value != null ? `≈ ${stepsKcalEstimate.value} (з кроків)` : 'напр. 250'
                }
              />
              {stepsKcalEstimate.value != null && parseIntOrNull(form.kcalBurned) == null && (
                <p class="mt-1 text-xs text-gray-500">
                  Порахуємо автоматично з кроків: ≈ {stepsKcalEstimate.value} ккал
                  {profile.value?.weightKg == null && ' (за вагою 70 кг — вкажіть свою у профілі для точності)'}
                </p>
              )}
            </div>
          </div>

          {saveError.value && <p class="mt-3 text-sm text-red-600">{saveError.value}</p>}

          <div class="mt-4">
            <button
              type="button"
              onClick={onSave}
              disabled={saving.value}
              class="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving.value ? 'Зберігаємо…' : 'Додати'}
            </button>
          </div>
        </div>

        {/* Записи дня */}
        <div class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
          <div class="flex items-baseline justify-between">
            <h2 class="text-lg font-semibold text-gray-900">Записи</h2>
            <span class="text-sm text-gray-500">
              Разом: <strong class="text-gray-800">{Math.round(totalKcalBurned.value)} ккал</strong>
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
                    <span class="truncate font-medium text-gray-900">{e.name}</span>
                    <div class="mt-0.5 text-xs text-gray-500">{entryMeta(e)}</div>
                  </div>
                  <div class="shrink-0 text-right">
                    <div class="font-semibold text-gray-900">
                      {e.kcalBurned != null ? `${e.kcalBurned} ккал` : '—'}
                    </div>
                    <button
                      type="button"
                      onClick={() => onDelete(e.id)}
                      disabled={deletingId.value === e.id}
                      class="mt-1 text-xs text-red-500 hover:text-red-600 disabled:opacity-50"
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
  },
})
