import { defineComponent, computed, ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { DishName, EmptyState, ErrorBanner, LoadingState, NuxtLink } from '#components'
import {
  useMenu,
  type DishDetails,
  type DishSearchHit,
  type ItemDetailsResponse,
  type MenuItem,
  type MenuSlot,
} from '~/composables/useMenu'
import { useToast } from '~/composables/useToast'
import { shiftIso } from '~/utils/day'
import { btnPrimaryClass, inputClass } from '~/utils/ui'

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

    const {
      plan,
      norms,
      pending,
      generate,
      regenerateDay,
      applyDay,
      applyItem,
      fetchItemDetails,
      searchDishes,
      fetchDishDetails,
      fetchRecipeByName,
    } = useMenu()
    const toast = useToast()

    const generating = ref(false)
    const genError = ref<string | null>(null)
    // Ключ кнопки, яка зараз у процесі застосування (день або страва).
    const applyingKey = ref<string | null>(null)
    // dayIndex дня, що зараз перегенеровується (null — жоден).
    const regeneratingDay = ref<number | null>(null)

    // Модалка деталей страви (спільна для страв меню й знайдених через пошук).
    const detailsOpen = ref(false)
    const detailsTitle = ref('')
    const detailsSubtitle = ref('')
    const detailsData = ref<DishDetails | null>(null)
    const detailsPending = ref(false)
    const detailsError = ref<string | null>(null)

    async function runDetails(
      title: string,
      subtitle: string,
      loader: () => Promise<ItemDetailsResponse>,
    ) {
      detailsOpen.value = true
      detailsTitle.value = title
      detailsSubtitle.value = subtitle
      detailsData.value = null
      detailsError.value = null
      detailsPending.value = true
      try {
        const res = await loader()
        detailsData.value = res.details
      } catch (err: unknown) {
        detailsError.value = extractErrorMessage(err) ?? 'Не вдалося завантажити деталі'
      } finally {
        detailsPending.value = false
      }
    }

    function openDetails(meal: MenuItem) {
      const sub = `${SLOT_LABELS[meal.slot]} · ${Math.round(meal.portionGrams)} г · ${Math.round(
        meal.kcal,
      )} ккал · Б ${roundMacro(meal.protein)} · Ж ${roundMacro(meal.fat)} · В ${roundMacro(meal.carb)}`
      void runDetails(meal.name, sub, () => fetchItemDetails(meal.id))
    }

    function openDishDetails(hit: DishSearchHit) {
      const sub = `${Math.round(hit.kcalPer100)} ккал/100 г · Б ${roundMacro(
        hit.proteinPer100,
      )} · Ж ${roundMacro(hit.fatPer100)} · В ${roundMacro(hit.carbPer100)}`
      void runDetails(hit.name, sub, () => fetchDishDetails(hit.id))
    }

    function openRecipeByName(name: string) {
      void runDetails(name, 'AI-рецепт за назвою', () => fetchRecipeByName(name))
    }

    function closeDetails() {
      detailsOpen.value = false
      detailsData.value = null
      detailsError.value = null
    }

    function onDetailsKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape') closeDetails()
    }

    // Пошук страви в довіднику + особистій базі (з рецептом).
    const searchTerm = ref('')
    const searchHits = ref<DishSearchHit[]>([])
    const searchPending = ref(false)
    let searchTimer: ReturnType<typeof setTimeout> | null = null

    watch(searchTerm, (value) => {
      if (searchTimer) clearTimeout(searchTimer)
      const term = value.trim()
      if (term.length < 2) {
        searchHits.value = []
        searchPending.value = false
        return
      }
      searchPending.value = true
      searchTimer = setTimeout(async () => {
        try {
          const res = await searchDishes(term)
          // Семантичні збіги з низькою схожістю — шум (малий довідник): лишаємо впевнені.
          searchHits.value = res.items.filter(
            (h) => h.match !== 'semantic' || (h.similarity ?? 0) >= 0.55,
          )
        } catch {
          searchHits.value = []
        } finally {
          searchPending.value = false
        }
      }, 280)
    })

    onMounted(() => document.addEventListener('keydown', onDetailsKeydown))
    onBeforeUnmount(() => {
      document.removeEventListener('keydown', onDetailsKeydown)
      if (searchTimer) clearTimeout(searchTimer)
    })

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
      try {
        await generate()
        toast.success('Меню згенеровано')
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
      try {
        await regenerateDay(p.id, dayIndex)
        toast.success('День оновлено')
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
      try {
        const res = await applyDay(p.id, dayIndex, date)
        toast.success(`Додано ${res.applied} страв(и) на ${formatDay(date)} у щоденник.`)
      } catch (err: unknown) {
        toast.error(extractErrorMessage(err) ?? 'Не вдалося додати день')
      } finally {
        applyingKey.value = null
      }
    }

    async function onApplyItem(item: MenuItem, date: string) {
      const p = plan.value
      if (!p) return
      const key = `item-${item.id}`
      applyingKey.value = key
      try {
        await applyItem(p.id, item.id, date)
        toast.success(`«${item.name}» додано на ${formatDay(date)} у щоденник.`)
      } catch (err: unknown) {
        toast.error(extractErrorMessage(err) ?? 'Не вдалося додати страву')
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
            aria-busy={generating.value}
            class={btnPrimaryClass}
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
          <ErrorBanner message={genError.value}>
            <NuxtLink to="/settings/ai-keys" class="mt-1 inline-block font-medium text-red-900 underline">
              Перейти до налаштувань AI
            </NuxtLink>
          </ErrorBanner>
        )}

        {/* Пошук страви з рецептом */}
        <div class="rounded-xl bg-card md:p-6 p-5 shadow-card">
          <h2 class="text-lg font-semibold text-gray-900">Знайти страву</h2>
          <p class="mt-1 text-sm text-gray-500">
            Пошук у довіднику та ваших стравах — з інгредієнтами й кроками приготування.
          </p>
          <input
            type="search"
            value={searchTerm.value}
            onInput={(e) => (searchTerm.value = (e.target as HTMLInputElement).value)}
            class={`${inputClass} mt-3`}
            placeholder="напр. борщ, сирники, паста карбонара"
            autocomplete="off"
          />
          {searchTerm.value.trim().length >= 2 && (
            <div class="mt-3 space-y-3">
              <button
                type="button"
                onClick={() => openRecipeByName(searchTerm.value.trim())}
                class="w-full rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-left text-sm font-medium text-brand-700 transition hover:bg-brand-100"
              >
                🍳 Отримати рецепт для «{searchTerm.value.trim()}»
              </button>

              {searchPending.value ? (
                <LoadingState />
              ) : searchHits.value.length === 0 ? (
                <p class="text-sm text-gray-500">
                  У довіднику збігів немає — скористайтесь кнопкою вище, щоб отримати рецепт.
                </p>
              ) : (
                <ul class="divide-y divide-gray-100">
                  {searchHits.value.map((hit) => (
                    <li key={hit.id} class="flex items-center gap-3 py-2.5">
                      <div class="min-w-0 flex-1">
                        <div class="truncate font-medium text-gray-900">{hit.name}</div>
                        <div class="mt-0.5 text-xs text-gray-500">
                          {Math.round(hit.kcalPer100)} ккал/100 г · Б {roundMacro(hit.proteinPer100)} · Ж{' '}
                          {roundMacro(hit.fatPer100)} · В {roundMacro(hit.carbPer100)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => openDishDetails(hit)}
                        class="shrink-0 text-xs font-medium text-brand-600 hover:text-brand-700"
                      >
                        Рецепт
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {pending.value && !plan.value ? (
          <LoadingState />
        ) : !plan.value ? (
          <EmptyState message="Ще немає меню. Згенеруйте його — AI складе план на тиждень, віддаючи перевагу вашим вже збереженим стравам." />
        ) : (
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            {days.value.map((day) => {
              const norm = norms.value.dailyKcal
              const over = norm != null && day.totalKcal > norm * 1.1
              return (
                <div
                  key={day.dayIndex}
                  class="rounded-xl bg-card p-5 shadow-card"
                >
                  <div class="flex items-baseline justify-between gap-2">
                    <h2 class="text-lg font-semibold text-gray-900">
                      {DAY_LABELS[day.dayIndex] ?? `День ${day.dayIndex + 1}`}
                      <span class="ml-2 text-sm font-normal text-gray-500">
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
                    <span class="text-xs text-gray-500">
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
                            <span class="shrink-0 rounded-full bg-gray-200 px-2 py-0.5 text-[11px] text-gray-600">
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

        {detailsOpen.value ? (
          <div
            class="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
            onClick={closeDetails}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="dish-details-title"
              class="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-card p-6 shadow-xl"
              onClick={(e: MouseEvent) => e.stopPropagation()}
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <h3 id="dish-details-title" class="text-lg font-semibold text-gray-900">{detailsTitle.value}</h3>
                  <p class="mt-0.5 text-xs text-gray-500">{detailsSubtitle.value}</p>
                </div>
                <button
                  type="button"
                  onClick={closeDetails}
                  class="shrink-0 rounded-lg p-1 text-gray-500 transition hover:bg-gray-200 hover:text-gray-600"
                  aria-label="Закрити"
                >
                  ✕
                </button>
              </div>

              <div class="mt-4">
                {detailsPending.value ? (
                  <LoadingState message="Готуємо деталі…" />
                ) : detailsError.value ? (
                  <ErrorBanner message={detailsError.value}>
                    <NuxtLink
                      to="/settings/ai-keys"
                      class="mt-1 inline-block font-medium text-red-900 underline"
                    >
                      Перейти до налаштувань AI
                    </NuxtLink>
                  </ErrorBanner>
                ) : detailsData.value ? (
                  <div class="space-y-4">
                    <div>
                      <h4 class="text-sm font-semibold text-gray-800">Інгредієнти</h4>
                      <ul class="mt-2 space-y-1">
                        {detailsData.value.ingredients.map((ing, i) => (
                          <li key={i} class="flex justify-between gap-3 text-sm text-gray-700">
                            <span>{ing.name}</span>
                            {ing.amount ? (
                              <span class="shrink-0 text-gray-500">{ing.amount}</span>
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
