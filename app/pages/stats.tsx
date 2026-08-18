import { defineComponent, computed } from 'vue'
import { CaloriesChart } from '#components'
import { useStats, type StatsRange } from '~/composables/useStats'

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

    const { range, days, totals, averages, norms, loggedDays, totalDays, pending } = useStats()

    const isDay = computed(() => range.value === 'day')

    // Для дня показуємо фактичне споживання, для тижня/місяця — середнє за день.
    const macros = computed(() => (isDay.value ? totals.value : averages.value))
    const macrosLabel = computed(() => (isDay.value ? 'Спожито за день' : 'Середнє за день'))

    return () => (
      <section class="space-y-6">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h1 class="text-2xl font-bold text-gray-900">Статистика</h1>
          <div class="flex gap-2">
            {RANGE_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => (range.value = o.value)}
                class={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  range.value === o.value
                    ? 'bg-brand-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {o.label}
              </button>
            ))}
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
                <div class="flex h-48 items-center justify-center text-sm text-gray-400">
                  Завантаження…
                </div>
              ) : (
                <CaloriesChart days={days.value} norm={norms.value.dailyKcal} />
              )}
            </div>
          </div>
        )}

        {/* Зведені показники за період */}
        <div class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
          <h2 class="text-lg font-semibold text-gray-900">Підсумок періоду</h2>
          <div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {statCard('Спожито всього', `${Math.round(totals.value.kcal)}`, 'ккал')}
            {statCard(
              'Середнє/день',
              `${Math.round(averages.value.kcal)}`,
              loggedDays.value > 0 ? `по ${loggedDays.value} дн.` : 'немає записів',
            )}
            {statCard('Білки (сер.)', `${Math.round(averages.value.protein)}`, 'г/день')}
            {statCard('Днів із записами', `${loggedDays.value}`, `з ${totalDays.value}`)}
          </div>
        </div>
      </section>
    )
  },
})
