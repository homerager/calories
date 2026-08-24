import { defineComponent, reactive, ref, computed } from 'vue'
import { ErrorBanner } from '#components'
import { useProfile, type ProfileForm } from '~/composables/useProfile'
import { useToast } from '~/composables/useToast'
import { SEX_OPTIONS, ACTIVITY_OPTIONS, GOAL_OPTIONS, parseNum } from '~/utils/profileOptions'
import { btnPrimaryClass, btnSecondaryClass, inputClass, labelClass } from '~/utils/ui'

// Майстер першого налаштування для нових користувачів: коротко проводить
// через ключові поля профілю, щоб одразу порахувати добові норми.

const STEPS = [
  { title: 'Розкажіть про себе', hint: 'Ці дані потрібні для розрахунку норм.' },
  { title: 'Зріст і вага', hint: 'Поточна вага та вага, до якої прямуєте.' },
  { title: 'Активність і ціль', hint: 'Останній крок — і побачите свої добові норми.' },
] as const

export default defineComponent({
  name: 'OnboardingPage',
  setup() {
    definePageMeta({ middleware: 'auth' })

    const { save } = useProfile()
    const toast = useToast()

    const step = ref(0)
    const saving = ref(false)
    const error = ref<string | null>(null)

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

    const isLastStep = computed(() => step.value === STEPS.length - 1)

    function goNext() {
      error.value = null
      if (step.value < STEPS.length - 1) step.value += 1
    }

    function goBack() {
      error.value = null
      if (step.value > 0) step.value -= 1
    }

    async function finish() {
      error.value = null
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
        toast.success('Профіль налаштовано')
        await navigateTo('/')
      } catch (err: unknown) {
        error.value = extractErrorMessage(err) ?? 'Не вдалося зберегти профіль'
      } finally {
        saving.value = false
      }
    }

    async function onSkip() {
      await navigateTo('/')
    }

    function onSubmit(e: Event) {
      e.preventDefault()
      if (isLastStep.value) {
        finish()
      } else {
        goNext()
      }
    }

    return () => (
      <section class="mx-auto max-w-lg">
        <div class="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-100">
          <div class="flex items-center justify-between">
            <h1 class="text-2xl font-bold text-gray-900">Налаштування профілю</h1>
            <span class="text-sm text-gray-500">
              Крок {step.value + 1} з {STEPS.length}
            </span>
          </div>

          <div class="mt-3 flex gap-1.5" aria-hidden="true">
            {STEPS.map((_, i) => (
              <div
                key={i}
                class={`h-1.5 flex-1 rounded-full ${i <= step.value ? 'bg-brand-600' : 'bg-gray-200'}`}
              />
            ))}
          </div>

          <p class="mt-4 text-sm text-gray-600">{STEPS[step.value]!.hint}</p>

          {error.value && (
            <div class="mt-4">
              <ErrorBanner message={error.value} />
            </div>
          )}

          <form class="mt-6 space-y-4" onSubmit={onSubmit}>
            {step.value === 0 && (
              <>
                <div>
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
                    onChange={(e) =>
                      (form.sex = ((e.target as HTMLSelectElement).value || null) as ProfileForm['sex'])
                    }
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
              </>
            )}

            {step.value === 1 && (
              <>
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
              </>
            )}

            {step.value === 2 && (
              <>
                <div>
                  <label class={labelClass} for="activity">Рівень активності</label>
                  <select
                    id="activity"
                    value={form.activityLevel}
                    onChange={(e) =>
                      (form.activityLevel = (e.target as HTMLSelectElement).value as ProfileForm['activityLevel'])
                    }
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
                    onChange={(e) => (form.goal = (e.target as HTMLSelectElement).value as ProfileForm['goal'])}
                    class={inputClass}
                  >
                    {GOAL_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div class="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={step.value === 0 ? onSkip : goBack}
                class={btnSecondaryClass}
              >
                {step.value === 0 ? 'Пропустити' : 'Назад'}
              </button>

              <button
                type="submit"
                disabled={saving.value}
                aria-busy={saving.value}
                class={btnPrimaryClass}
              >
                {saving.value ? 'Зберігаємо…' : isLastStep.value ? 'Завершити' : 'Далі'}
              </button>
            </div>
          </form>
        </div>
      </section>
    )
  },
})
