import { defineComponent, computed } from 'vue'
import { CaloriesChart, LoadingState, WaterChart, WeightChart } from '#components'
import { useStats, type StatsRange } from '~/composables/useStats'
import { useProfile } from '~/composables/useProfile'
import { WATER_DAILY_GOAL_ML } from '~/composables/useWater'
import { shiftIso, todayIso } from '~/utils/day'
import { btnGhostClass, btnTabActiveClass, btnTabIdleClass, inputClassCompact } from '~/utils/ui'

const RANGE_OPTIONS: { value: StatsRange; label: string }[] = [
  { value: 'day', label: 'День' },
  { value: 'week', label: 'Тиждень' },
  { value: 'month', label: 'Місяць' },
]

function progressBar(
  label: string,
  value: number,
  norm: number | null,
  unit: string,
  tint: string,
) {
  const pct = norm && norm > 0 ? Math.min(100, Math.round((value / norm) * 100)) : 0
  const over = norm != null && norm > 0 && value > norm
  return (
    <div>
      <div class="flex items-baseline justify-between text-sm">
        <span class="font-medium text-gray-700">{label}</span>
        <span class="text-gray-500">
          <strong class={over ? 'text-red-600' : 'text-gray-800'}>{Math.round(value)}</strong>
          {norm != null ? ` / ${norm}` : ''} {unit}
          {norm != null && norm > 0 && <span class="ml-1 text-gray-400">({pct}%)</span>}
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

// Форматує орієнтовну зміну ваги: знак + кг (втрата зі знаком «−», набір «+»).
function formatWeightChange(kg: number): string {
  const rounded = Math.round(kg * 10) / 10
  if (rounded === 0) return '≈ 0 кг'
  const sign = rounded < 0 ? '−' : '+'
  return `${sign}${Math.abs(rounded).toFixed(1)} кг`
}

function statCard(label: string, value: string, sub?: string) {
  return (
    <div class="rounded-xl bg-gray-50 p-4">
      <div class="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</div>
      <div class="mt-1 text-2xl font-bold text-gray-900">{value}</div>
      {sub && <div class="mt-0.5 text-xs text-gray-400">{sub}</div>}
    </div>
  )
}

export default defineComponent({
  name: 'StatsPage',
  setup() {
    definePageMeta({ middleware: 'auth' })

    const {
      range,
      date,
      days,
      totals,
      averages,
      norms,
      loggedDays,
      totalDays,
      activeDays,
      burnedTotal,
      burnedAvg,
      netTotal,
      weightEstimate,
      weightActual,
      pending,
    } = useStats()

    const { profile, weightHistory } = useProfile()

    const isDay = computed(() => range.value === 'day')

    // Для дня показуємо фактичне споживання, для тижня/місяця — середнє за день.
    const macros = computed(() => (isDay.value ? totals.value : averages.value))
    const macrosLabel = computed(() => (isDay.value ? 'Спожито за день' : 'Середнє за день'))

    return () => (
      <section class="space-y-6">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h1 class="text-2xl font-bold text-gray-900">Статистика</h1>
          <div class="flex flex-wrap items-center gap-3">
            <div class="flex items-center gap-2">
              <button
                type="button"
                onClick={() => (date.value = shiftIso(date.value, -1))}
                class={btnGhostClass}
                aria-label="Попередній день"
              >
                ←
              </button>
              <input
                type="date"
                max={todayIso()}
                value={date.value}
                onInput={(e) => (date.value = (e.target as HTMLInputElement).value || todayIso())}
                aria-label="Дата"
                class={inputClassCompact}
              />
              <button
                type="button"
                onClick={() => (date.value = shiftIso(date.value, 1))}
                disabled={date.value >= todayIso()}
                class={`${btnGhostClass} disabled:opacity-40`}
                aria-label="Наступний день"
              >
                →
              </button>
              <button
                type="button"
                onClick={() => (date.value = todayIso())}
                class={btnGhostClass}
              >
                Сьогодні
              </button>
            </div>
            <div class="flex gap-2">
              {RANGE_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => (range.value = o.value)}
                  aria-pressed={range.value === o.value}
                  class={range.value === o.value ? btnTabActiveClass : btnTabIdleClass}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Прогрес відносно норм */}
        <div class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
          <div class="flex items-baseline justify-between">
            <h2 class="text-lg font-semibold text-gray-900">{macrosLabel.value}</h2>
            {!isDay.value && (
              <span class="text-sm text-gray-500">
                Днів із записами: <strong class="text-gray-800">{loggedDays.value}</strong> /{' '}
                {totalDays.value}
              </span>
            )}
          </div>

          <div class="mt-4 space-y-3">
            {progressBar('Калорії', macros.value.kcal, norms.value.dailyKcal, 'ккал', 'bg-brand-500')}
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {progressBar('Білки', macros.value.protein, norms.value.proteinGrams, 'г', 'bg-sky-400')}
              {progressBar('Жири', macros.value.fat, norms.value.fatGrams, 'г', 'bg-amber-400')}
              {progressBar('Вуглеводи', macros.value.carb, norms.value.carbGrams, 'г', 'bg-rose-400')}
            </div>
          </div>

          {/* Спалено / нетто-баланс */}
          <div class="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-gray-100 pt-4 text-sm">
            <span class="text-gray-500">
              Спалено{isDay.value ? '' : ' (сер./день)'}:{' '}
              <strong class="text-emerald-600">
                −{Math.round(isDay.value ? burnedTotal.value : burnedAvg.value)} ккал
              </strong>
            </span>
            <span class="text-gray-500">
              Нетто{isDay.value ? '' : ' за період'} (спожито − спалено):{' '}
              <strong class="text-gray-800">{Math.round(isDay.value ? totals.value.kcal - burnedTotal.value : netTotal.value)} ккал</strong>
            </span>
          </div>

          {/* Зміна ваги: оцінка (енергобаланс) + факт (зважування) */}
          {(weightEstimate.value != null || weightActual.value != null) && (
            <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {weightEstimate.value != null && (
                <div class="rounded-xl bg-gray-50 px-4 py-3">
                  <div class="flex items-baseline justify-between gap-2">
                    <span class="text-sm font-medium text-gray-700">Орієнтовна зміна ваги</span>
                    <span
                      class={`text-2xl font-bold ${
                        weightEstimate.value.weightChangeKg < 0
                          ? 'text-emerald-600'
                          : 'text-amber-600'
                      }`}
                    >
                      {formatWeightChange(weightEstimate.value.weightChangeKg)}
                    </span>
                  </div>
                  <div class="mt-0.5 text-xs text-gray-400">
                    з енергобалансу · за {weightEstimate.value.basisDays} дн. із записами ·
                    підтримка ≈ {weightEstimate.value.tdee} ккал/день
                  </div>
                </div>
              )}

              {weightActual.value != null && (
                <div class="rounded-xl bg-gray-50 px-4 py-3">
                  <div class="flex items-baseline justify-between gap-2">
                    <span class="text-sm font-medium text-gray-700">Фактична зміна ваги</span>
                    <span
                      class={`text-2xl font-bold ${
                        weightActual.value.changeKg < 0
                          ? 'text-emerald-600'
                          : weightActual.value.changeKg > 0
                            ? 'text-amber-600'
                            : 'text-gray-700'
                      }`}
                    >
                      {formatWeightChange(weightActual.value.changeKg)}
                    </span>
                  </div>
                  <div class="mt-0.5 text-xs text-gray-400">
                    зі зважувань · {weightActual.value.startKg} → {weightActual.value.endKg} кг
                  </div>
                </div>
              )}
            </div>
          )}

          {norms.value.dailyKcal == null && (
            <p class="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
              Заповніть профіль, щоб бачити цільові норми.
            </p>
          )}
        </div>

         {/* Графік добових калорій */}
        {!isDay.value && (
          <div class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
            <h2 class="text-lg font-semibold text-gray-900">Калорії по днях</h2>
            <div class="mt-4">
              {pending.value && days.value.length === 0 ? (
                <LoadingState />
              ) : (
                <CaloriesChart days={days.value} norm={norms.value.dailyKcal} />
              )}
            </div>
          </div>
        )}

        {/* Графік вживання води */}
        {!isDay.value && (
          <div class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
            <h2 class="text-lg font-semibold text-gray-900">Вода по днях</h2>
            <div class="mt-4">
              {pending.value && days.value.length === 0 ? (
                <LoadingState />
              ) : (
                <WaterChart days={days.value} goalMl={WATER_DAILY_GOAL_ML} />
              )}
            </div>
          </div>
        )}

        {/* Динаміка ваги */}
        <div class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
          <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 class="text-lg font-semibold text-gray-900">Динаміка ваги</h2>
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
            </div>
          </div>
          <div class="mt-4">
            <WeightChart points={weightHistory.value} />
          </div>
        </div>

       

        {/* Зведені показники за період */}
        <div class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
          <h2 class="text-lg font-semibold text-gray-900">Підсумок періоду</h2>
          <div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {statCard('Спожито всього', `${Math.round(totals.value.kcal)}`, 'ккал')}
            {statCard('Спалено всього', `${Math.round(burnedTotal.value)}`, 'ккал')}
            {statCard('Нетто', `${Math.round(netTotal.value)}`, 'спожито − спалено')}
            {weightEstimate.value != null &&
              statCard(
                'Орієнт. зміна ваги',
                formatWeightChange(weightEstimate.value.weightChangeKg),
                `за ${weightEstimate.value.basisDays} дн. із записами`,
              )}
            {weightActual.value != null &&
              statCard(
                'Факт. зміна ваги',
                formatWeightChange(weightActual.value.changeKg),
                `${weightActual.value.startKg} → ${weightActual.value.endKg} кг`,
              )}
            {statCard(
              'Спожито (сер./день)',
              `${Math.round(averages.value.kcal)}`,
              loggedDays.value > 0 ? `по ${loggedDays.value} дн.` : 'немає записів',
            )}
            {statCard(
              'Спалено (сер./день)',
              `${Math.round(burnedAvg.value)}`,
              activeDays.value > 0 ? `по ${activeDays.value} дн.` : 'немає активності',
            )}
            {statCard('Білки (сер.)', `${Math.round(averages.value.protein)}`, 'г/день')}
            {statCard('Днів із записами', `${loggedDays.value}`, `з ${totalDays.value}`)}
            {statCard('Днів з активністю', `${activeDays.value}`, `з ${totalDays.value}`)}
          </div>
        </div>
      </section>
    )
  },
})
