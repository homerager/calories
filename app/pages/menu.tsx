import { defineComponent, computed, ref } from 'vue'
import { NuxtLink, DishName } from '#components'
import { useMenu, type DishDetails, type MenuItem, type MenuSlot } from '~/composables/useMenu'

const SLOT_LABELS: Record<MenuSlot, string> = {
  BREAKFAST: 'Сніданок',
  LUNCH: 'Обід',
  DINNER: 'Вечеря',
  SNACK: 'Перекус',
}

const SLOT_ORDER: MenuSlot[] = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK']

const DAY_LABELS = [
  'Понеділок',
  'Вівторок',
  'Середа',
  'Четвер',
  'Пʼятниця',
  'Субота',
  'Неділя',
]

const roundMacro = (v: number) => Math.round(v * 10) / 10

function shiftIso(iso: string, deltaDays: number): string {
  const d = new Date(`${iso}T12:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + deltaDays)
  return d.toISOString().slice(0, 10)
}

function formatDay(iso: string): string {
  const d = new Date(`${iso}T12:00:00.000Z`)
  return d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' })
}

interface DayGroup {
  dayIndex: number
  date: string
  meals: MenuItem[]
  totalKcal: number
  totalProtein: number
  totalFat: number
  totalCarb: number
}

export default defineComponent({
  name: 'MenuPage',
  setup() {
    definePageMeta({ middleware: 'auth' })

    const { plan, norms, pending, generate, regenerateDay, applyDay, applyItem, fetchItemDetails } =
      useMenu()

    const generating = ref(false)
    const genError = ref<string | null>(null)
    // Ключ кнопки, яка зараз у процесі застосування (день або страва).
    const applyingKey = ref<string | null>(null)
    const applyMsg = ref<string | null>(null)
    // dayIndex дня, що зараз перегенеровується (null — жоден).
    const regeneratingDay = ref<number | null>(null)

    // Модалка деталей страви.
    const detailsItem = ref<MenuItem | null>(null)
    const detailsData = ref<DishDetails | null>(null)
    const detailsPending = ref(false)
    const detailsError = ref<string | null>(null)

    async function openDetails(meal: MenuItem) {
      detailsItem.value = meal
      detailsData.value = null
      detailsError.value = null
      detailsPending.value = true
      try {
        const res = await fetchItemDetails(meal.id)
        detailsData.value = res.details
      } catch (err: unknown) {
        detailsError.value = extractErrorMessage(err) ?? 'Не вдалося завантажити деталі'
      } finally {
        detailsPending.value = false
      }
    }

    function closeDetails() {
      detailsItem.value = null
      detailsData.value = null
      detailsError.value = null
    }

    const days = computed<DayGroup[]>(() => {
      const p = plan.value
      if (!p) return []
      const map = new Map<number, MenuItem[]>()
      for (const it of p.items) {
        const list = map.get(it.dayIndex) ?? []
        list.push(it)
        map.set(it.dayIndex, list)
      }
      return [...map.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([dayIndex, meals]) => {
          const sorted = [...meals].sort(
            (a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot),
          )
          return {
            dayIndex,
            date: shiftIso(p.startDate, dayIndex),
            meals: sorted,
            totalKcal: sorted.reduce((s, m) => s + m.kcal, 0),
            totalProtein: sorted.reduce((s, m) => s + m.protein, 0),
            totalFat: sorted.reduce((s, m) => s + m.fat, 0),
            totalCarb: sorted.reduce((s, m) => s + m.carb, 0),
          }
        })
    })

    async function onGenerate() {
      generating.value = true
      genError.value = null
      applyMsg.value = null
      try {
        await generate()
      } catch (err: unknown) {
        genError.value = extractErrorMessage(err) ?? 'Не вдалося згенерувати меню'
      } finally {
        generating.value = false
      }
    }

    async function onRegenerateDay(dayIndex: number) {
      const p = plan.value
      if (!p) return
      regeneratingDay.value = dayIndex
      genError.value = null
      applyMsg.value = null
      try {
        await regenerateDay(p.id, dayIndex)
      } catch (err: unknown) {
        genError.value = extractErrorMessage(err) ?? 'Не вдалося перегенерувати день'
      } finally {
        regeneratingDay.value = null
      }
    }

    async function onApplyDay(dayIndex: number, date: string) {
      const p = plan.value
      if (!p) return
      const key = `day-${dayIndex}`
      applyingKey.value = key
      applyMsg.value = null
      try {
        const res = await applyDay(p.id, dayIndex, date)
        applyMsg.value = `Додано ${res.applied} страв(и) на ${formatDay(date)} у щоденник.`
      } catch (err: unknown) {
        applyMsg.value = extractErrorMessage(err) ?? 'Не вдалося додати день'
      } finally {
        applyingKey.value = null
      }
    }

    async function onApplyItem(item: MenuItem, date: string) {
      const p = plan.value
      if (!p) return
      const key = `item-${item.id}`
      applyingKey.value = key
      applyMsg.value = null
      try {
        await applyItem(p.id, item.id, date)
        applyMsg.value = `«${item.name}» додано на ${formatDay(date)} у щоденник.`
      } catch (err: unknown) {
        applyMsg.value = extractErrorMessage(err) ?? 'Не вдалося додати страву'
      } finally {
        applyingKey.value = null
      }
    }

    return () => (
      <section class="space-y-6">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h1 class="text-2xl font-bold text-gray-900">Меню на тиждень</h1>
          <button
            type="button"
            onClick={onGenerate}
            disabled={generating.value}
            class="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {generating.value
              ? 'Генеруємо…'
              : plan.value
                ? 'Перегенерувати'
                : 'Згенерувати меню'}
          </button>
        </div>

        {norms.value.dailyKcal == null && (
          <div class="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-500">
            Заповніть{' '}
            <NuxtLink to="/profile" class="font-medium text-brand-600 underline">
              профіль
            </NuxtLink>
            , щоб меню враховувало ваші добові норми.
          </div>
        )}

        {genError.value && (
          <div class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-100">
            <p>{genError.value}</p>
            <NuxtLink to="/settings/ai-keys" class="mt-1 inline-block font-medium text-red-800 underline">
              Перейти до налаштувань AI
            </NuxtLink>
          </div>
        )}

        {applyMsg.value && (
          <div class="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-emerald-100">
            {applyMsg.value}
          </div>
        )}

        {pending.value && !plan.value ? (
          <p class="text-sm text-gray-400">Завантаження…</p>
        ) : !plan.value ? (
          <div class="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-gray-100">
            <p class="text-gray-600">
              Ще немає меню. Згенеруйте його — AI складе план на тиждень, віддаючи перевагу вашим
              вже збереженим стравам.
            </p>
          </div>
        ) : (
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            {days.value.map((day) => {
              const norm = norms.value.dailyKcal
              const over = norm != null && day.totalKcal > norm * 1.1
              return (
                <div
                  key={day.dayIndex}
                  class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100"
                >
                  <div class="flex items-baseline justify-between gap-2">
                    <h2 class="text-lg font-semibold text-gray-900">
                      {DAY_LABELS[day.dayIndex] ?? `День ${day.dayIndex + 1}`}
                      <span class="ml-2 text-sm font-normal text-gray-400">
                        {formatDay(day.date)}
                      </span>
                    </h2>
                    <span class="shrink-0 text-sm text-gray-500">
                      <strong class={over ? 'text-red-600' : 'text-gray-800'}>
                        {Math.round(day.totalKcal)}
                      </strong>
                      {norm != null ? ` / ${norm}` : ''} ккал
                    </span>
                  </div>

                  <div class="mt-1 flex items-center justify-between gap-2">
                    <span class="text-xs text-gray-400">
                      Б {roundMacro(day.totalProtein)} · Ж {roundMacro(day.totalFat)} · В{' '}
                      {roundMacro(day.totalCarb)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRegenerateDay(day.dayIndex)}
                      disabled={regeneratingDay.value !== null}
                      class="shrink-0 text-xs font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50"
                    >
                      {regeneratingDay.value === day.dayIndex ? 'Оновлюємо…' : '↻ Перегенерувати день'}
                    </button>
                  </div>

                  <ul class="mt-3 divide-y divide-gray-100">
                    {day.meals.map((meal) => (
                      <li key={meal.id} class="flex items-center gap-3 py-2.5">
                        <div class="min-w-0 flex-1">
                          <div class="flex items-center gap-2">
                            <span class="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">
                              {SLOT_LABELS[meal.slot]}
                            </span>
                            <button
                              type="button"
                              onClick={() => openDetails(meal)}
                              class="min-w-0 flex-1 text-left"
                              title="Показати деталі та інгредієнти"
                            >
                              <DishName
                                text={meal.name}
                                spanClass="font-medium text-gray-900 hover:text-brand-700"
                              />
                            </button>
                          </div>
                          <div class="mt-0.5 text-xs text-gray-500">
                            {Math.round(meal.portionGrams)} г · {Math.round(meal.kcal)} ккал · Б{' '}
                            {roundMacro(meal.protein)} · Ж {roundMacro(meal.fat)} · В{' '}
                            {roundMacro(meal.carb)}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onApplyItem(meal, day.date)}
                          disabled={applyingKey.value === `item-${meal.id}`}
                          class="shrink-0 text-xs font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50"
                        >
                          {applyingKey.value === `item-${meal.id}` ? '…' : 'Додати'}
                        </button>
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    onClick={() => onApplyDay(day.dayIndex, day.date)}
                    disabled={applyingKey.value === `day-${day.dayIndex}`}
                    class="mt-3 w-full rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-100 disabled:opacity-60"
                  >
                    {applyingKey.value === `day-${day.dayIndex}`
                      ? 'Додаємо…'
                      : 'Додати день у щоденник'}
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {detailsItem.value ? (
          <div
            class="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
            onClick={closeDetails}
          >
            <div
              class="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
              onClick={(e: MouseEvent) => e.stopPropagation()}
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <h3 class="text-lg font-semibold text-gray-900">{detailsItem.value.name}</h3>
                  <p class="mt-0.5 text-xs text-gray-500">
                    {SLOT_LABELS[detailsItem.value.slot]} · {Math.round(detailsItem.value.portionGrams)}{' '}
                    г · {Math.round(detailsItem.value.kcal)} ккал · Б {roundMacro(detailsItem.value.protein)}{' '}
                    · Ж {roundMacro(detailsItem.value.fat)} · В {roundMacro(detailsItem.value.carb)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeDetails}
                  class="shrink-0 rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                  aria-label="Закрити"
                >
                  ✕
                </button>
              </div>

              <div class="mt-4">
                {detailsPending.value ? (
                  <p class="text-sm text-gray-400">Готуємо деталі…</p>
                ) : detailsError.value ? (
                  <div class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-100">
                    <p>{detailsError.value}</p>
                    <NuxtLink
                      to="/settings/ai-keys"
                      class="mt-1 inline-block font-medium text-red-800 underline"
                    >
                      Перейти до налаштувань AI
                    </NuxtLink>
                  </div>
                ) : detailsData.value ? (
                  <div class="space-y-4">
                    <div>
                      <h4 class="text-sm font-semibold text-gray-800">Інгредієнти</h4>
                      <ul class="mt-2 space-y-1">
                        {detailsData.value.ingredients.map((ing, i) => (
                          <li key={i} class="flex justify-between gap-3 text-sm text-gray-700">
                            <span>{ing.name}</span>
                            {ing.amount ? (
                              <span class="shrink-0 text-gray-400">{ing.amount}</span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {detailsData.value.steps.length > 0 ? (
                      <div>
                        <h4 class="text-sm font-semibold text-gray-800">Приготування</h4>
                        <ol class="mt-2 list-decimal space-y-1 pl-5 text-sm text-gray-700">
                          {detailsData.value.steps.map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ol>
                      </div>
                    ) : null}

                    {detailsData.value.tips ? (
                      <div class="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">
                        {detailsData.value.tips}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </section>
    )
  },
})
