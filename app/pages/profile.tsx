import { defineComponent, reactive, ref, watch, computed } from 'vue'
import { WeightChart } from '#components'
import { useProfile, type ProfileForm } from '~/composables/useProfile'
import { useToast } from '~/composables/useToast'
import { btnPrimaryClass, inputClass, labelClass } from '~/utils/ui'
import { SEX_OPTIONS, ACTIVITY_OPTIONS, GOAL_OPTIONS, parseNum } from '~/utils/profileOptions'

export default defineComponent({
  name: 'ProfilePage',
  setup() {
    definePageMeta({ middleware: 'auth' })

    const { profile, weightHistory, pending, save, addWeight } = useProfile()
    const toast = useToast()

    const form = reactive<ProfileForm>({
      name: '',
      sex: null,
      birthDate: null,
      age: null,
      heightCm: null,
      weightKg: null,
      targetWeightKg: null,
      chestCm: null,
      waistCm: null,
      hipsCm: null,
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
        form.targetWeightKg = p.targetWeightKg
        form.chestCm = p.chestCm
        form.waistCm = p.waistCm
        form.hipsCm = p.hipsCm
        form.activityLevel = p.activityLevel
        form.goal = p.goal
      },
      { immediate: true },
    )

    const saving = ref(false)

    const hasNorms = computed(
      () => profile.value?.dailyKcal != null && profile.value.dailyKcal > 0,
    )

    async function onSubmit(e: Event) {
      e.preventDefault()
      saving.value = true
      try {
        await save({
          name: form.name?.trim() || null,
          sex: form.sex,
          birthDate: form.birthDate || null,
          age: form.age,
          heightCm: form.heightCm,
          weightKg: form.weightKg,
          targetWeightKg: form.targetWeightKg,
          chestCm: form.chestCm,
          waistCm: form.waistCm,
          hipsCm: form.hipsCm,
          activityLevel: form.activityLevel,
          goal: form.goal,
        })
        toast.success('Профіль збережено')
      } catch (err: unknown) {
        toast.error(extractErrorMessage(err) ?? 'Не вдалося зберегти профіль')
      } finally {
        saving.value = false
      }
    }

    const newWeight = ref<number | null>(null)
    const newDate = ref<string>(todayIso())
    const addingWeight = ref(false)

    async function onAddWeight(e: Event) {
      e.preventDefault()
      if (newWeight.value == null) {
        toast.error('Вкажіть вагу')
        return
      }
      addingWeight.value = true
      try {
        await addWeight(newWeight.value, newDate.value)
        newWeight.value = null
        newDate.value = todayIso()
        toast.success('Зважування додано')
      } catch (err: unknown) {
        toast.error(extractErrorMessage(err) ?? 'Не вдалося додати зважування')
      } finally {
        addingWeight.value = false
      }
    }

    const reversedHistory = computed(() => [...weightHistory.value].reverse())

    const weightToGoal = computed(() => {
      const current = profile.value?.weightKg
      const target = profile.value?.targetWeightKg
      if (current == null || target == null) return null
      return Math.round((current - target) * 10) / 10
    })

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
        <div class="rounded-2xl bg-card p-6 shadow-sm ring-1 ring-gray-100">
          <h2 class="text-lg font-semibold text-gray-900">Добові норми</h2>
          {hasNorms.value ? (
            <div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {macroCard('Калорії', profile.value?.dailyKcal, 'ккал', 'bg-brand-50 text-brand-800')}
              {macroCard('Білки', profile.value?.proteinGrams, 'г', 'bg-sky-50 text-sky-800')}
              {macroCard('Жири', profile.value?.fatGrams, 'г', 'bg-amber-50 text-amber-800')}
              {macroCard('Вуглеводи', profile.value?.carbGrams, 'г', 'bg-rose-50 text-rose-800')}
            </div>
          ) : (
            <p class="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">
              Заповніть зріст, вагу та дату народження (або вік), щоб побачити розрахунок норм.
            </p>
          )}
        </div>

        {/* Форма профілю */}
        <form class="rounded-2xl bg-card p-6 shadow-sm ring-1 ring-gray-100" onSubmit={onSubmit}>
          <h2 class="text-lg font-semibold text-gray-900">Особисті дані</h2>

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
              <label class={labelClass} for="targetWeight">Цільова вага, кг</label>
              <input
                id="targetWeight"
                type="number"
                min={20}
                max={500}
                step="0.1"
                value={form.targetWeightKg ?? ''}
                onInput={(e) => (form.targetWeightKg = parseNum((e.target as HTMLInputElement).value))}
                class={inputClass}
                placeholder="напр. 65"
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

          <h2 class="mt-6 border-t border-gray-100 pt-6 text-lg font-semibold text-gray-900">
            Виміри тіла
          </h2>
          <p class="mt-1 text-sm text-gray-500">Необовʼязково. Допомагає стежити за зміною форми тіла.</p>

          <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label class={labelClass} for="chest">Груди, см</label>
              <input
                id="chest"
                type="number"
                min={30}
                max={300}
                step="0.1"
                value={form.chestCm ?? ''}
                onInput={(e) => (form.chestCm = parseNum((e.target as HTMLInputElement).value))}
                class={inputClass}
                placeholder="напр. 96"
              />
            </div>

            <div>
              <label class={labelClass} for="waist">Талія, см</label>
              <input
                id="waist"
                type="number"
                min={30}
                max={300}
                step="0.1"
                value={form.waistCm ?? ''}
                onInput={(e) => (form.waistCm = parseNum((e.target as HTMLInputElement).value))}
                class={inputClass}
                placeholder="напр. 78"
              />
            </div>

            <div>
              <label class={labelClass} for="hips">Стегна, см</label>
              <input
                id="hips"
                type="number"
                min={30}
                max={300}
                step="0.1"
                value={form.hipsCm ?? ''}
                onInput={(e) => (form.hipsCm = parseNum((e.target as HTMLInputElement).value))}
                class={inputClass}
                placeholder="напр. 100"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving.value || pending.value}
            aria-busy={saving.value}
            class={`${btnPrimaryClass} mt-6 w-full sm:w-auto`}
          >
            {saving.value ? 'Зберігаємо…' : 'Зберегти профіль'}
          </button>
        </form>

        {/* Історія зважувань */}
        <div class="rounded-2xl bg-card p-6 shadow-sm ring-1 ring-gray-100">
          <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 class="text-lg font-semibold text-gray-900">Історія ваги</h2>
            <div class="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm text-gray-500">
              {profile.value?.weightKg != null && (
                <span>
                  Поточна: <strong class="text-gray-800">{profile.value.weightKg} кг</strong>
                </span>
              )}
              {profile.value?.targetWeightKg != null && (
                <span>
                  Ціль: <strong class="text-gray-800">{profile.value.targetWeightKg} кг</strong>
                </span>
              )}
              {weightToGoal.value != null && weightToGoal.value !== 0 && (
                <span>
                  До цілі:{' '}
                  <strong class="text-brand-700">
                    {Math.abs(weightToGoal.value)} кг {weightToGoal.value > 0 ? 'зменшити' : 'набрати'}
                  </strong>
                </span>
              )}
              {weightToGoal.value === 0 && (
                <span class="font-medium text-brand-700">Ціль досягнута</span>
              )}
            </div>
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
              aria-busy={addingWeight.value}
              class={btnPrimaryClass}
            >
              {addingWeight.value ? 'Додаємо…' : 'Додати'}
            </button>
          </form>

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
