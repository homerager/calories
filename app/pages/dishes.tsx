import { computed, defineComponent, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { EmptyState, ErrorBanner, LoadingState, NuxtLink } from '#components'
import {
  useRecipes,
  type RecipeDetails,
  type RecipeIngredient,
  type RecipeItem,
  type RecipeSlot,
} from '~/composables/useRecipes'
import { useToast } from '~/composables/useToast'
import { todayIso } from '~/utils/day'
import {
  btnGhostClass,
  btnPrimaryClass,
  btnSecondaryClass,
  inputClass,
  inputClassCompact,
  labelClass,
} from '~/utils/ui'

const SLOT_LABELS: Record<RecipeSlot, string> = {
  BREAKFAST: 'Сніданок',
  LUNCH: 'Обід',
  DINNER: 'Вечеря',
  SNACK: 'Перекус',
}

const SLOT_OPTIONS: { value: RecipeSlot | ''; label: string }[] = [
  { value: '', label: 'Без прийому' },
  { value: 'BREAKFAST', label: 'Сніданок' },
  { value: 'LUNCH', label: 'Обід' },
  { value: 'DINNER', label: 'Вечеря' },
  { value: 'SNACK', label: 'Перекус' },
]

const roundKcal = (v: number) => Math.round(v)
const roundMacro = (v: number) => Math.round(v * 10) / 10

function parseNum(value: string): number {
  const n = Number(value.trim().replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

interface EditForm {
  name: string
  slot: RecipeSlot | ''
  portionGrams: string
  kcal: string
  protein: string
  fat: string
  carb: string
  ingredients: RecipeIngredient[]
  steps: string[]
  tips: string
}

function emptyForm(): EditForm {
  return {
    name: '',
    slot: '',
    portionGrams: '',
    kcal: '',
    protein: '',
    fat: '',
    carb: '',
    ingredients: [{ name: '', amount: '' }],
    steps: [''],
    tips: '',
  }
}

function formFromRecipe(r: RecipeItem): EditForm {
  return {
    name: r.name,
    slot: r.slot ?? '',
    portionGrams: String(Math.round(r.portionGrams)),
    kcal: String(roundKcal(r.kcal)),
    protein: String(roundMacro(r.protein)),
    fat: String(roundMacro(r.fat)),
    carb: String(roundMacro(r.carb)),
    ingredients: r.details?.ingredients.length
      ? r.details.ingredients.map((i) => ({ name: i.name, amount: i.amount }))
      : [{ name: '', amount: '' }],
    steps: r.details?.steps.length ? [...r.details.steps] : [''],
    tips: r.details?.tips ?? '',
  }
}

export default defineComponent({
  name: 'DishesPage',
  setup() {
    definePageMeta({ middleware: 'auth' })

    const { items, pending, fetchRecipe, updateRecipe, generateRecipe } = useRecipes()
    const toast = useToast()

    const query = ref('')
    const selectedId = ref<string | null>(null)
    const detail = ref<RecipeItem | null>(null)
    const detailPending = ref(false)
    const detailError = ref<string | null>(null)
    const generating = ref(false)
    const generateError = ref<string | null>(null)
    const editing = ref(false)
    const form = reactive<EditForm>(emptyForm())
    const saving = ref(false)
    const adding = ref(false)

    const logDate = ref(todayIso())
    const logPortion = ref('')
    const logSlot = ref<RecipeSlot | ''>('')

    const filtered = computed(() => {
      const q = query.value.trim().toLowerCase()
      if (!q) return items.value
      return items.value.filter((it) => it.name.toLowerCase().includes(q))
    })

    const selectedName = computed(
      () =>
        detail.value?.name
        ?? items.value.find((it) => it.id === selectedId.value)?.name
        ?? 'Страва',
    )

    const hasRecipe = computed(() => Boolean(detail.value?.details?.ingredients.length))

    watch(selectedId, async (id) => {
      editing.value = false
      generating.value = false
      generateError.value = null
      detail.value = null
      detailError.value = null
      if (!id) return
      detailPending.value = true
      try {
        const res = await fetchRecipe(id)
        detail.value = res.recipe
        Object.assign(form, formFromRecipe(res.recipe))
        logPortion.value = String(Math.round(res.recipe.portionGrams) || 100)
        logDate.value = todayIso()
        logSlot.value = ''
      } catch (err: unknown) {
        detailError.value = extractErrorMessage(err) ?? 'Не вдалося завантажити рецепт'
      } finally {
        detailPending.value = false
      }
    })

    function closeDetails() {
      selectedId.value = null
      detail.value = null
      detailError.value = null
      generateError.value = null
      generating.value = false
      editing.value = false
    }

    function onDetailsKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape') closeDetails()
    }

    onMounted(() => document.addEventListener('keydown', onDetailsKeydown))
    onBeforeUnmount(() => document.removeEventListener('keydown', onDetailsKeydown))

    function startEdit() {
      if (!detail.value) return
      Object.assign(form, formFromRecipe(detail.value))
      editing.value = true
    }

    function cancelEdit() {
      if (detail.value) Object.assign(form, formFromRecipe(detail.value))
      editing.value = false
    }

    function addIngredient() {
      form.ingredients.push({ name: '', amount: '' })
    }

    function removeIngredient(i: number) {
      if (form.ingredients.length <= 1) {
        form.ingredients[0] = { name: '', amount: '' }
        return
      }
      form.ingredients.splice(i, 1)
    }

    function addStep() {
      form.steps.push('')
    }

    function removeStep(i: number) {
      if (form.steps.length <= 1) {
        form.steps[0] = ''
        return
      }
      form.steps.splice(i, 1)
    }

    function collectDetails(): RecipeDetails | null {
      const ingredients = form.ingredients
        .map((i) => ({ name: i.name.trim(), amount: i.amount.trim() }))
        .filter((i) => i.name)
      if (ingredients.length === 0) return null
      const steps = form.steps.map((s) => s.trim()).filter(Boolean)
      return { ingredients, steps, tips: form.tips.trim() }
    }

    async function onSaveEdits() {
      if (!detail.value) return
      const details = collectDetails()
      if (!details) {
        toast.error('Додайте хоча б один інгредієнт')
        return
      }
      const name = form.name.trim()
      if (!name) {
        toast.error('Вкажіть назву')
        return
      }
      saving.value = true
      try {
        const recipe = await updateRecipe(detail.value.id, {
          name,
          slot: form.slot || null,
          portionGrams: parseNum(form.portionGrams) || 100,
          kcal: parseNum(form.kcal),
          protein: parseNum(form.protein),
          fat: parseNum(form.fat),
          carb: parseNum(form.carb),
          details,
        })
        detail.value = recipe
        Object.assign(form, formFromRecipe(recipe))
        editing.value = false
        toast.success('Рецепт оновлено')
      } catch (err: unknown) {
        toast.error(extractErrorMessage(err) ?? 'Не вдалося зберегти')
      } finally {
        saving.value = false
      }
    }

    async function onGenerateRecipe() {
      const r = detail.value
      if (!r || generating.value) return
      generating.value = true
      generateError.value = null
      try {
        const recipe = await generateRecipe(r.id)
        if (selectedId.value !== r.id) return
        detail.value = recipe
        Object.assign(form, formFromRecipe(recipe))
        toast.success('Рецепт згенеровано')
      } catch (err: unknown) {
        generateError.value = extractErrorMessage(err) ?? 'Не вдалося згенерувати рецепт'
      } finally {
        generating.value = false
      }
    }

    async function onAddToDiary() {
      const r = detail.value
      if (!r) return
      const portion = parseNum(logPortion.value)
      if (portion <= 0) {
        toast.error('Вкажіть порцію в грамах')
        return
      }
      const base = r.portionGrams > 0 ? r.portionGrams : 100
      const factor = portion / base
      adding.value = true
      try {
        await $fetch('/api/meals', {
          method: 'POST',
          body: {
            date: logDate.value || todayIso(),
            slot: logSlot.value || r.slot || null,
            name: r.name,
            portionGrams: portion,
            kcal: roundKcal(r.kcal * factor),
            protein: roundMacro(r.protein * factor),
            fat: roundMacro(r.fat * factor),
            carb: roundMacro(r.carb * factor),
            source: 'MANUAL',
            foodItemId: r.foodItemId,
          },
        })
        toast.success('Додано в щоденник')
      } catch (err: unknown) {
        toast.error(extractErrorMessage(err) ?? 'Не вдалося додати в щоденник')
      } finally {
        adding.value = false
      }
    }

    return () => (
      <section class="space-y-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Страви</h1>
          <p class="mt-1 text-sm text-gray-500">
            Спільна база страв із тижневих меню. Рецепт можна згенерувати тут або відкривши страву в{' '}
            <NuxtLink to="/menu" class="font-medium text-brand-700 hover:text-brand-800">
              меню
            </NuxtLink>
            .
          </p>
        </div>

        {pending.value && items.value.length === 0 ? (
          <LoadingState />
        ) : items.value.length === 0 ? (
          <EmptyState message="Ще немає страв у каталозі. Згенеруйте тижневе меню — вони зʼявляться тут.">
            <NuxtLink to="/menu" class="mt-3 inline-block font-medium text-brand-700 hover:text-brand-800">
              Відкрити меню на тиждень
            </NuxtLink>
          </EmptyState>
        ) : (
          <div class="rounded-xl bg-card md:p-6 p-5 shadow-card">
            <input
              type="search"
              value={query.value}
              onInput={(e) => (query.value = (e.target as HTMLInputElement).value)}
              class={inputClass}
              placeholder="Пошук за назвою"
              autocomplete="off"
            />
            {filtered.value.length === 0 ? (
              <p class="mt-4 text-sm text-gray-500">Немає збігів.</p>
            ) : (
              <ul class="mt-3 divide-y divide-gray-100">
                {filtered.value.map((it) => (
                  <li key={it.id}>
                    <button
                      type="button"
                      onClick={() => (selectedId.value = it.id)}
                      class={`w-full px-1 py-2.5 text-left transition hover:bg-gray-50 ${
                        selectedId.value === it.id ? 'text-brand-700' : ''
                      }`}
                    >
                      <div class="truncate font-medium text-gray-900">{it.name}</div>
                      <div class="mt-0.5 text-xs text-gray-500">
                        {it.slot ? `${SLOT_LABELS[it.slot]} · ` : ''}
                        {Math.round(it.portionGrams)} г · {roundKcal(it.kcal)} ккал
                        {it.hasRecipe ? ' · рецепт' : ''}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {selectedId.value ? (
          <div
            class="fixed inset-0 z-40 flex items-center justify-center !mt-0 bg-black/40 p-4"
            onClick={closeDetails}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="dish-details-title"
              class="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-card p-6 shadow-xl"
              onClick={(e: MouseEvent) => e.stopPropagation()}
            >
              <div class="flex flex-nowrap items-start justify-between gap-2">
                {editing.value ? (
                  <div class="min-w-0 flex-1">
                    <label class={labelClass} for="dish-name">
                      Назва
                    </label>
                    <input
                      id="dish-name"
                      class={inputClass}
                      value={form.name}
                      onInput={(e) => (form.name = (e.target as HTMLInputElement).value)}
                    />
                  </div>
                ) : (
                  <h3 id="dish-details-title" class="text-lg font-semibold text-gray-900">
                    {selectedName.value}
                  </h3>
                )}
                <div class="flex shrink-0 items-center gap-2">
                  {editing.value ? (
                    <>
                      <button type="button" class={btnGhostClass} onClick={cancelEdit}>
                        Скасувати
                      </button>
                      <button
                        type="button"
                        class={btnPrimaryClass}
                        disabled={saving.value}
                        onClick={() => void onSaveEdits()}
                      >
                        {saving.value ? 'Зберігаємо…' : 'Зберегти'}
                      </button>
                    </>
                  ) : detail.value && !detailPending.value && !detailError.value && !generating.value ? (
                    <button type="button" class={btnSecondaryClass} onClick={startEdit}>
                      Редагувати
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={closeDetails}
                    class="rounded-lg p-1 text-gray-500 transition hover:bg-gray-200 hover:text-gray-600"
                    aria-label="Закрити"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div class="mt-4">
                {detailPending.value ? (
                  <LoadingState />
                ) : detailError.value ? (
                  <ErrorBanner message={detailError.value} />
                ) : detail.value ? (
                  <div class="space-y-5">

                  {editing.value ? (
                    <div class="grid grid-cols-2 gap-2 sm:grid-cols-5">
                      {([
                        ['portionGrams', 'Порція, г'],
                        ['kcal', 'ккал'],
                        ['protein', 'Б, г'],
                        ['fat', 'Ж, г'],
                        ['carb', 'В, г'],
                      ] as const).map(([key, label]) => (
                        <div key={key}>
                          <label class={labelClass}>{label}</label>
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            class={inputClassCompact + ' mt-1 w-full'}
                            value={form[key]}
                            onInput={(e) => (form[key] = (e.target as HTMLInputElement).value)}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p class="text-sm text-gray-500">
                      {detail.value.slot ? `${SLOT_LABELS[detail.value.slot]} · ` : ''}
                      {Math.round(detail.value.portionGrams)} г · {roundKcal(detail.value.kcal)} ккал · Б{' '}
                      {roundMacro(detail.value.protein)} · Ж {roundMacro(detail.value.fat)} · В{' '}
                      {roundMacro(detail.value.carb)}
                    </p>
                  )}

                  <div>
                    <h4 class="text-sm font-semibold text-gray-800">Інгредієнти</h4>
                    {editing.value ? (
                      <ul class="mt-2 space-y-2">
                        {form.ingredients.map((ing, i) => (
                          <li key={i} class="flex gap-2">
                            <input
                              class={inputClassCompact + ' min-w-0 flex-1'}
                              placeholder="Назва"
                              value={ing.name}
                              onInput={(e) => (form.ingredients[i]!.name = (e.target as HTMLInputElement).value)}
                            />
                            <input
                              class={inputClassCompact + ' w-28'}
                              placeholder="К-сть"
                              value={ing.amount}
                              onInput={(e) => (form.ingredients[i]!.amount = (e.target as HTMLInputElement).value)}
                            />
                            <button
                              type="button"
                              class={btnGhostClass}
                              onClick={() => removeIngredient(i)}
                              aria-label="Прибрати інгредієнт"
                            >
                              ✕
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : generating.value ? (
                      <LoadingState message="Готуємо рецепт…" />
                    ) : hasRecipe.value ? (
                      <ul class="mt-2 space-y-1">
                        {detail.value.details!.ingredients.map((ing, i) => (
                          <li key={i} class="flex justify-between gap-3 text-sm text-gray-700">
                            <span>{ing.name}</span>
                            {ing.amount ? <span class="shrink-0 text-gray-500">{ing.amount}</span> : null}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div class="mt-2 space-y-3">
                        <p class="text-sm text-gray-500">Рецепт ще не згенеровано.</p>
                        {generateError.value ? (
                          <ErrorBanner message={generateError.value}>
                            <NuxtLink
                              to="/settings/ai-keys"
                              class="mt-1 inline-block font-medium text-red-900 underline"
                            >
                              Перейти до налаштувань AI
                            </NuxtLink>
                          </ErrorBanner>
                        ) : null}
                        <button
                          type="button"
                          class={btnPrimaryClass}
                          disabled={generating.value}
                          onClick={() => void onGenerateRecipe()}
                        >
                          Згенерувати рецепт
                        </button>
                      </div>
                    )}
                    {editing.value ? (
                      <button type="button" class={`${btnGhostClass} mt-2`} onClick={addIngredient}>
                        + Інгредієнт
                      </button>
                    ) : null}
                  </div>

                  {editing.value || hasRecipe.value ? (
                    <div>
                      <h4 class="text-sm font-semibold text-gray-800">Приготування</h4>
                      {editing.value ? (
                        <ol class="mt-2 space-y-2">
                          {form.steps.map((step, i) => (
                            <li key={i} class="flex gap-2">
                              <span class="mt-2 w-5 shrink-0 text-sm text-gray-400">{i + 1}.</span>
                              <textarea
                                class={inputClassCompact + ' min-h-16 flex-1'}
                                value={step}
                                onInput={(e) => (form.steps[i] = (e.target as HTMLTextAreaElement).value)}
                              />
                              <button
                                type="button"
                                class={btnGhostClass}
                                onClick={() => removeStep(i)}
                                aria-label="Прибрати крок"
                              >
                                ✕
                              </button>
                            </li>
                          ))}
                        </ol>
                      ) : detail.value.details?.steps.length ? (
                        <ol class="mt-2 list-decimal space-y-1 pl-5 text-sm text-gray-700">
                          {detail.value.details.steps.map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ol>
                      ) : (
                        <p class="mt-2 text-sm text-gray-500">Кроків немає.</p>
                      )}
                      {editing.value ? (
                        <button type="button" class={`${btnGhostClass} mt-2`} onClick={addStep}>
                          + Крок
                        </button>
                      ) : null}
                    </div>
                  ) : null}

                  {editing.value ? (
                    <div>
                      <label class={labelClass} for="dish-tips">
                        Поради
                      </label>
                      <textarea
                        id="dish-tips"
                        class={inputClass}
                        value={form.tips}
                        onInput={(e) => (form.tips = (e.target as HTMLTextAreaElement).value)}
                      />
                    </div>
                  ) : detail.value.details?.tips ? (
                    <div class="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">
                      {detail.value.details.tips}
                    </div>
                  ) : null}

                  {!editing.value ? (
                    <div class="border-t border-gray-100 pt-4">
                      <h4 class="text-sm font-semibold text-gray-800">Додати в щоденник</h4>
                      <div class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div>
                          <label class={labelClass} for="log-date">
                            Дата
                          </label>
                          <input
                            id="log-date"
                            type="date"
                            max={todayIso()}
                            class={inputClassCompact + ' mt-1 w-full'}
                            value={logDate.value}
                            onInput={(e) => (logDate.value = (e.target as HTMLInputElement).value)}
                          />
                        </div>
                        <div>
                          <label class={labelClass} for="log-portion">
                            Порція, г
                          </label>
                          <input
                            id="log-portion"
                            type="number"
                            min="1"
                            class={inputClassCompact + ' mt-1 w-full'}
                            value={logPortion.value}
                            onInput={(e) => (logPortion.value = (e.target as HTMLInputElement).value)}
                          />
                        </div>
                        <div>
                          <label class={labelClass} for="log-slot">
                            Прийом
                          </label>
                          <select
                            id="log-slot"
                            class={inputClassCompact + ' mt-1 w-full'}
                            value={logSlot.value}
                            onChange={(e) => (logSlot.value = (e.target as HTMLSelectElement).value as RecipeSlot | '')}
                          >
                            {SLOT_OPTIONS.map((o) => (
                              <option key={o.value || 'none'} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <button
                        type="button"
                        class={`${btnPrimaryClass} mt-3`}
                        disabled={adding.value}
                        onClick={() => void onAddToDiary()}
                      >
                        {adding.value ? 'Додаємо…' : 'Додати'}
                      </button>
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
