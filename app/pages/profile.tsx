import { defineComponent, reactive, ref, watch, computed } from 'vue'
import { WeightChart } from '#components'
import {
  useProfile,
  type ProfileForm,
  type Sex,
  type ActivityLevel,
  type Goal,
} from '~/composables/useProfile'

const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'MALE', label: 'Чоловіча' },
  { value: 'FEMALE', label: 'Жіноча' },
  { value: 'OTHER', label: 'Інша' },
]

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string }[] = [
  { value: 'SEDENTARY', label: 'Сидячий спосіб життя' },
  { value: 'LIGHT', label: 'Легка активність (1–3 трен./тиж.)' },
  { value: 'MODERATE', label: 'Помірна (3–5 трен./тиж.)' },
  { value: 'ACTIVE', label: 'Висока (6–7 трен./тиж.)' },
  { value: 'VERY_ACTIVE', label: 'Дуже висока / фізична робота' },
]

const GOAL_OPTIONS: { value: Goal; label: string }[] = [
  { value: 'LOSE', label: 'Схуднення' },
  { value: 'MAINTAIN', label: 'Підтримка ваги' },
  { value: 'GAIN', label: 'Набір маси' },
]

function parseNum(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const n = Number(trimmed.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

const inputClass =
  'mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200'
const labelClass = 'block text-sm font-medium text-gray-700'

export default defineComponent({
  name: 'ProfilePage',
  setup() {
    definePageMeta({ middleware: 'auth' })

    const { profile, weightHistory, pending, save, addWeight } = useProfile()

    const form = reactive<ProfileForm>({
      name: '',
      sex: null,
      birthDate: null,
      age: null,
      heightCm: null,
      weightKg: null,
      activityLevel: 'SEDENTARY',
      goal: 'MAINTAIN',
    })

    watch(
      profile,
      (p) => {
        if (!p) return
        form.name = p.name ?? ''
        form.sex = p.sex
        form.birthDate = p.birthDate
        form.age = p.age
        form.heightCm = p.heightCm
        form.weightKg = p.weightKg
        form.activityLevel = p.activityLevel
        form.goal = p.goal
      },
      { immediate: true },
    )

    const saving = ref(false)
    const saved = ref(false)
    const error = ref<string | null>(null)

    const hasNorms = computed(
      () => profile.value?.dailyKcal != null && profile.value.dailyKcal > 0,
    )

    async function onSubmit(e: Event) {
      e.preventDefault()
      saving.value = true
      saved.value = false
      error.value = null
      try {
        await save({
          name: form.name?.trim() || null,
          sex: form.sex,
          birthDate: form.birthDate || null,
          age: form.age,
          heightCm: form.heightCm,
          weightKg: form.weightKg,
          activityLevel: form.activityLevel,
          goal: form.goal,
        })
        saved.value = true
      } catch (err: unknown) {
        error.value = extractErrorMessage(err) ?? 'Не вдалося зберегти профіль'
      } finally {
        saving.value = false
      }
    }

    const newWeight = ref<number | null>(null)
    const newDate = ref<string>(todayIso())
    const addingWeight = ref(false)
    const weightError = ref<string | null>(null)

    async function onAddWeight(e: Event) {
      e.preventDefault()
      if (newWeight.value == null) {
        weightError.value = 'Вкажіть вагу'
        return
      }
      addingWeight.value = true
      weightError.value = null
      try {
        await addWeight(newWeight.value, newDate.value)
        newWeight.value = null
        newDate.value = todayIso()
      } catch (err: unknown) {
        weightError.value = extractErrorMessage(err) ?? 'Не вдалося додати зважування'
      } finally {
        addingWeight.value = false
      }
    }

    const reversedHistory = computed(() => [...weightHistory.value].reverse())

    function macroCard(label: string, value: number | null | undefined, unit: string, tint: string) {
      return (
        <div class={`rounded-xl p-4 ${tint}`}>
          <div class="text-xs font-medium uppercase tracking-wide opacity-70">{label}</div>
          <div class="mt-1 text-2xl font-bold">
            {value ?? '—'}
            <span class="ml-1 text-sm font-normal opacity-70">{unit}</span>
          </div>
        </div>
      )
    }

    return () => (
      <section class="space-y-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Профіль</h1>
          <p class="mt-1 text-sm text-gray-500">
            Вкажіть дані — розрахуємо добові норми калорій і БЖВ за формулою Міффліна-Сан Жеора.
          </p>
        </div>

        {/* Норми */}
        <div class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
          <h2 class="text-lg font-semibold text-gray-900">Добові норми</h2>
          {hasNorms.value ? (
            <div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {macroCard('Калорії', profile.value?.dailyKcal, 'ккал', 'bg-brand-50 text-brand-800')}
              {macroCard('Білки', profile.value?.proteinGrams, 'г', 'bg-sky-50 text-sky-800')}
              {macroCard('Жири', profile.value?.fatGrams, 'г', 'bg-amber-50 text-amber-800')}
              {macroCard('Вуглеводи', profile.value?.carbGrams, 'г', 'bg-rose-50 text-rose-800')}
            </div>
          ) : (
            <p class="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-500">
              Заповніть зріст, вагу та дату народження (або вік), щоб побачити розрахунок норм.
            </p>
          )}
        </div>

        {/* Форма профілю */}
        <form class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100" onSubmit={onSubmit}>
          <h2 class="text-lg font-semibold text-gray-900">Особисті дані</h2>

          {error.value && (
            <div class="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-100">
              {error.value}
            </div>
          )}
          {saved.value && !error.value && (
            <div class="mt-4 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800 ring-1 ring-brand-100">
              Профіль збережено.
            </div>
          )}

          <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div class="sm:col-span-2">
              <label class={labelClass} for="name">Імʼя</label>
              <input
                id="name"
                type="text"
                value={form.name ?? ''}
                onInput={(e) => (form.name = (e.target as HTMLInputElement).value)}
                class={inputClass}
                placeholder="Як до вас звертатися"
              />
            </div>

            <div>
              <label class={labelClass} for="sex">Стать</label>
              <select
                id="sex"
                value={form.sex ?? ''}
                onChange={(e) => (form.sex = ((e.target as HTMLSelectElement).value || null) as Sex | null)}
                class={inputClass}
              >
                <option value="">Не вказано</option>
                {SEX_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label class={labelClass} for="birthDate">Дата народження</label>
              <input
                id="birthDate"
                type="date"
                max={todayIso()}
                value={form.birthDate ?? ''}
                onInput={(e) => (form.birthDate = (e.target as HTMLInputElement).value || null)}
                class={inputClass}
              />
            </div>

            <div>
              <label class={labelClass} for="height">Зріст, см</label>
              <input
                id="height"
                type="number"
                min={50}
                max={272}
                step="0.1"
                value={form.heightCm ?? ''}
                onInput={(e) => (form.heightCm = parseNum((e.target as HTMLInputElement).value))}
                class={inputClass}
                placeholder="напр. 175"
              />
            </div>

            <div>
              <label class={labelClass} for="weight">Поточна вага, кг</label>
              <input
                id="weight"
                type="number"
                min={20}
                max={500}
                step="0.1"
                value={form.weightKg ?? ''}
                onInput={(e) => (form.weightKg = parseNum((e.target as HTMLInputElement).value))}
                class={inputClass}
                placeholder="напр. 70"
              />
            </div>

            <div>
              <label class={labelClass} for="activity">Рівень активності</label>
              <select
                id="activity"
                value={form.activityLevel}
                onChange={(e) => (form.activityLevel = (e.target as HTMLSelectElement).value as ActivityLevel)}
                class={inputClass}
              >
                {ACTIVITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label class={labelClass} for="goal">Ціль</label>
              <select
                id="goal"
                value={form.goal}
                onChange={(e) => (form.goal = (e.target as HTMLSelectElement).value as Goal)}
                class={inputClass}
              >
                {GOAL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving.value || pending.value}
            class="mt-6 w-full rounded-lg bg-brand-600 px-4 py-2 font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {saving.value ? 'Зберігаємо…' : 'Зберегти профіль'}
          </button>
        </form>

        {/* Історія зважувань */}
        <div class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
          <div class="flex items-baseline justify-between">
            <h2 class="text-lg font-semibold text-gray-900">Історія ваги</h2>
            {profile.value?.weightKg != null && (
              <span class="text-sm text-gray-500">
                Поточна: <strong class="text-gray-800">{profile.value.weightKg} кг</strong>
              </span>
            )}
          </div>

          <div class="mt-4">
            <WeightChart points={weightHistory.value} />
          </div>

          <form class="mt-5 flex flex-wrap items-end gap-3" onSubmit={onAddWeight}>
            <div>
              <label class={labelClass} for="newWeight">Нове зважування, кг</label>
              <input
                id="newWeight"
                type="number"
                min={20}
                max={500}
                step="0.1"
                value={newWeight.value ?? ''}
                onInput={(e) => (newWeight.value = parseNum((e.target as HTMLInputElement).value))}
                class={`${inputClass} w-40`}
                placeholder="напр. 69.5"
              />
            </div>
            <div>
              <label class={labelClass} for="newDate">Дата</label>
              <input
                id="newDate"
                type="date"
                max={todayIso()}
                value={newDate.value}
                onInput={(e) => (newDate.value = (e.target as HTMLInputElement).value)}
                class={`${inputClass} w-44`}
              />
            </div>
            <button
              type="submit"
              disabled={addingWeight.value}
              class="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {addingWeight.value ? 'Додаємо…' : 'Додати'}
            </button>
          </form>
          {weightError.value && (
            <p class="mt-2 text-sm text-red-600">{weightError.value}</p>
          )}

          {reversedHistory.value.length > 0 && (
            <ul class="mt-5 divide-y divide-gray-100 text-sm">
              {reversedHistory.value.map((entry) => (
                <li key={entry.id} class="flex items-center justify-between py-2">
                  <span class="text-gray-500">
                    {new Date(entry.measuredAt).toLocaleDateString('uk-UA', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                  <span class="font-medium text-gray-800">{entry.weightKg} кг</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    )
  },
})
