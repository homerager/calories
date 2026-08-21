import { defineComponent, computed, ref } from 'vue'
import { EmptyState, NuxtLink } from '#components'
import { useDiary, type MealSlot } from '~/composables/useDiary'
import { useExercise } from '~/composables/useExercise'
import { useWater } from '~/composables/useWater'
import { useToast } from '~/composables/useToast'
import { btnPrimaryClass, btnSecondaryClass } from '~/utils/ui'

const SLOT_LABELS: Record<MealSlot, string> = {
  BREAKFAST: 'Сніданок',
  LUNCH: 'Обід',
  DINNER: 'Вечеря',
  SNACK: 'Перекус',
}

const QUICK_WATER_ML = [250, 500]

function todayLabel(): string {
  return new Date().toLocaleDateString('uk-UA', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  })
}

export default defineComponent({
  name: 'IndexPage',
  setup() {
    definePageMeta({ middleware: 'auth' })

    const { user } = useUserSession()
    const { meals, totals, norms } = useDiary()
    const { totalKcalBurned } = useExercise()
    const { totalMl, goalMl, addWater } = useWater()
    const toast = useToast()

    const greetingName = computed(() => user.value?.email?.split('@')[0] ?? '')

    const netKcal = computed(() => Math.round(totals.value.totalKcal - totalKcalBurned.value))
    const kcalNorm = computed(() => norms.value.dailyKcal)
    const kcalRemaining = computed(() =>
      kcalNorm.value != null ? Math.round(kcalNorm.value - totals.value.totalKcal) : null,
    )
    // Залишок з урахуванням активності: спалені калорії «повертаються» в бюджет.
    const kcalRemainingWithActivity = computed(() =>
      kcalNorm.value != null
        ? Math.round(kcalNorm.value - totals.value.totalKcal + totalKcalBurned.value)
        : null,
    )

    // Останні записи (найновіші згори).
    const recentMeals = computed(() => [...meals.value].reverse().slice(0, 5))

    const addingWater = ref(false)
    async function onAddWater(ml: number) {
      addingWater.value = true
      try {
        await addWater(ml)
      } catch (err: unknown) {
        toast.error(extractErrorMessage(err) ?? 'Не вдалося додати воду')
      } finally {
        addingWater.value = false
      }
    }

    function progressBar(label: string, value: number, norm: number | null, unit: string, tint: string) {
      const pct = norm && norm > 0 ? Math.min(100, Math.round((value / norm) * 100)) : 0
      const over = norm != null && norm > 0 && value > norm
      return (
        <div>
          <div class="flex items-baseline justify-between text-sm">
            <span class="font-medium text-gray-700">{label}</span>
            <span class="text-gray-500">
              <strong class={over ? 'text-red-600' : 'text-gray-800'}>{Math.round(value)}</strong>
              {norm != null ? ` / ${norm}` : ''} {unit}
            </span>
          </div>
          <div class="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              class={`h-full rounded-full transition-all ${over ? 'bg-red-400' : tint}`}
              style={{ width: `${norm && norm > 0 ? pct : value > 0 ? 100 : 0}%` }}
            />
          </div>
        </div>
      )
    }

    return () => (
      <section class="space-y-6">
        {/* Привітання */}
        <div class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
          <p class="text-sm capitalize text-gray-400">{todayLabel()}</p>
          <h1 class="mt-1 text-2xl font-bold text-gray-900">
            Вітаємо{greetingName.value ? `, ${greetingName.value}` : ''}!
          </h1>
          <p class="mt-1 text-gray-600">Ось короткий підсумок вашого дня.</p>
        </div>

        {/* Калорії дня */}
        <div class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
          <div class="flex items-baseline justify-between">
            <h2 class="text-lg font-semibold text-gray-900">Калорії сьогодні</h2>
            {kcalRemaining.value != null && (
              <span class="text-sm text-gray-500">
                {kcalRemaining.value >= 0 ? 'Залишок' : 'Перевищення'}:{' '}
                <strong class={kcalRemaining.value >= 0 ? 'text-brand-700' : 'text-red-600'}>
                  {Math.abs(kcalRemaining.value)} ккал
                </strong>
              </span>
            )}
          </div>

          <div class="mt-4 space-y-3">
            {progressBar('Калорії', totals.value.totalKcal, kcalNorm.value, 'ккал', 'bg-brand-500')}
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {progressBar('Білки', totals.value.totalProtein, norms.value.proteinGrams, 'г', 'bg-sky-400')}
              {progressBar('Жири', totals.value.totalFat, norms.value.fatGrams, 'г', 'bg-amber-400')}
              {progressBar('Вуглеводи', totals.value.totalCarb, norms.value.carbGrams, 'г', 'bg-rose-400')}
            </div>
          </div>

          <div class="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-gray-100 pt-4 text-sm">
            <span class="text-gray-500">
              Спалено:{' '}
              <strong class="text-emerald-600">−{Math.round(totalKcalBurned.value)} ккал</strong>
            </span>
            <span class="text-gray-500">
              Нетто (спожито − спалено): <strong class="text-gray-800">{netKcal.value} ккал</strong>
            </span>
            {kcalRemainingWithActivity.value != null && (
              <span class="text-gray-500">
                {kcalRemainingWithActivity.value >= 0
                  ? 'Залишок з активністю'
                  : 'Перевищення з активністю'}
                :{' '}
                <strong
                  class={kcalRemainingWithActivity.value >= 0 ? 'text-brand-700' : 'text-red-600'}
                >
                  {Math.abs(kcalRemainingWithActivity.value)} ккал
                </strong>
              </span>
            )}
          </div>

          {kcalNorm.value == null && (
            <p class="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
              Заповніть{' '}
              <NuxtLink to="/profile" class="font-medium text-brand-600 underline">
                профіль
              </NuxtLink>
              , щоб бачити цільові норми.
            </p>
          )}
        </div>

        {/* Вода + швидкі дії */}
        <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
            <div class="flex items-baseline justify-between">
              <h2 class="text-lg font-semibold text-gray-900">Вода</h2>
              <span class="text-sm text-gray-500">
                <strong class="text-sky-600">{totalMl.value}</strong> / {goalMl.value} мл
              </span>
            </div>
            <div class="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                class="h-full rounded-full bg-sky-400 transition-all"
                style={{
                  width: `${goalMl.value > 0 ? Math.min(100, Math.round((totalMl.value / goalMl.value) * 100)) : 0}%`,
                }}
              />
            </div>
            <div class="mt-4 flex flex-wrap gap-2">
              {QUICK_WATER_ML.map((ml) => (
                <button
                  key={ml}
                  type="button"
                  onClick={() => onAddWater(ml)}
                  disabled={addingWater.value}
                  class="rounded-lg bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-700 transition hover:bg-sky-100 disabled:opacity-60"
                >
                  +{ml} мл
                </button>
              ))}
              <NuxtLink
                to="/water"
                class="ml-auto self-center text-sm font-medium text-brand-600 hover:text-brand-700"
              >
                Докладніше →
              </NuxtLink>
            </div>
          </div>

          <div class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
            <h2 class="text-lg font-semibold text-gray-900">Швидкі дії</h2>
            <div class="mt-4 grid grid-cols-2 gap-2 text-sm">
              <NuxtLink
                to="/diary"
                class={`${btnPrimaryClass} px-3 py-2 text-center text-sm`}
              >
                Додати їжу
              </NuxtLink>
              <NuxtLink
                to="/exercise"
                class={`${btnSecondaryClass} px-3 py-2 text-center text-sm`}
              >
                Активність
              </NuxtLink>
              <NuxtLink
                to="/menu"
                class={`${btnSecondaryClass} px-3 py-2 text-center text-sm`}
              >
                Меню
              </NuxtLink>
              <NuxtLink
                to="/stats"
                class={`${btnSecondaryClass} px-3 py-2 text-center text-sm`}
              >
                Статистика
              </NuxtLink>
            </div>
          </div>
        </div>

        {/* Останні записи */}
        <div class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
          <div class="flex items-baseline justify-between">
            <h2 class="text-lg font-semibold text-gray-900">Останні записи</h2>
            <NuxtLink to="/diary" class="text-sm font-medium text-brand-600 hover:text-brand-700">
              Усі →
            </NuxtLink>
          </div>

          {recentMeals.value.length === 0 ? (
            <EmptyState message="Ще немає записів за сьогодні.">
              <p class="mt-2">
                <NuxtLink to="/diary" class="font-medium text-brand-700 underline">
                  Додати перший
                </NuxtLink>
              </p>
            </EmptyState>
          ) : (
            <ul class="mt-4 divide-y divide-gray-100">
              {recentMeals.value.map((m) => (
                <li key={m.id} class="flex items-center gap-3 py-2.5">
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2">
                      <span class="block truncate font-medium text-gray-900">{m.name}</span>
                      {m.slot && (
                        <span class="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">
                          {SLOT_LABELS[m.slot]}
                        </span>
                      )}
                    </div>
                    <div class="mt-0.5 text-xs text-gray-500">{m.portionGrams} г</div>
                  </div>
                  <div class="shrink-0 font-semibold text-gray-900">{Math.round(m.kcal)} ккал</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    )
  },
})
