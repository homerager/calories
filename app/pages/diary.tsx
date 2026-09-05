import { computed, defineComponent, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { BarcodeScanner, EmptyState, ErrorBanner, FoodSuggestions, LoadingState, NuxtLink } from '#components'
import { compressImage } from '~/utils/image'
import {
  useDiary,
  type FoodSearchHit,
  type MealItem,
  type MealSlot,
  type MealSource,
  type MyDish,
  type RecognizeDraft,
} from '~/composables/useDiary'
import { useToast } from '~/composables/useToast'
import { shiftIso, todayIso } from '~/utils/day'
import {
  btnGhostClass,
  btnPrimaryClass,
  btnSecondaryClass,
  btnTabActiveClass,
  btnTabIdleClass,
  inputClass,
  inputClassCompact,
  labelClass,
} from '~/utils/ui'

const SLOT_OPTIONS: { value: MealSlot; label: string }[] = [
  { value: 'BREAKFAST', label: 'Сніданок' },
  { value: 'LUNCH', label: 'Обід' },
  { value: 'DINNER', label: 'Вечеря' },
  { value: 'SNACK', label: 'Перекус' },
]

const SOURCE_LABELS: Record<MealSource, string> = {
  AI_PHOTO: 'AI · фото',
  AI_TEXT: 'AI · текст',
  MANUAL: 'Вручну',
}

// Порядок груп у списку записів. 'OTHER' — записи без прийому їжі.
type SlotKey = MealSlot | 'OTHER'
const SLOT_GROUP_ORDER: SlotKey[] = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK', 'OTHER']
const SLOT_GROUP_LABELS: Record<SlotKey, string> = {
  BREAKFAST: 'Сніданок',
  LUNCH: 'Обід',
  DINNER: 'Вечеря',
  SNACK: 'Перекус',
  OTHER: 'Без прийому їжі',
}

const roundKcal = (v: number) => Math.round(v)
const roundMacro = (v: number) => Math.round(v * 10) / 10

function parseNum(value: string): number {
  const n = Number(value.trim().replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

// Формат дати запису (YYYY-MM-DD → DD.MM.YYYY) для рядка мета.
function formatDay(iso: string): string {
  const d = new Date(`${iso}T12:00:00.000Z`)
  return d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// Час створення запису (HH:mm) із повного ISO-таймстемпа createdAt.
function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })
}

interface DraftForm {
  name: string
  portionGrams: number
  kcal: number
  protein: number
  fat: number
  carb: number
  slot: MealSlot | ''
  source: MealSource
  confidence: number | null
  foodItemId: string | null
  per100: { kcal: number; protein: number; fat: number; carb: number } | null
}

export default defineComponent({
  name: 'DiaryPage',
  setup() {
    definePageMeta({ middleware: 'auth' })

    const {
      date,
      meals,
      totals,
      norms,
      pending,
      recognizeText,
      recognizeImage,
      lookupBarcode,
      saveMeal,
      updateMeal,
      deleteMeal,
      fetchMyDishes,
      searchFood,
      copyMeals,
      setFavorite,
    } = useDiary()
    const toast = useToast()

    // Групування записів дня за прийомом їжі (зі збереженням хронології всередині групи).
    const groupedMeals = computed(() => {
      const buckets = new Map<SlotKey, { items: MealItem[]; kcal: number }>()
      for (const m of meals.value) {
        const key: SlotKey = m.slot ?? 'OTHER'
        const bucket = buckets.get(key) ?? { items: [], kcal: 0 }
        bucket.items.push(m)
        bucket.kcal += m.kcal
        buckets.set(key, bucket)
      }
      return SLOT_GROUP_ORDER.filter((k) => buckets.has(k)).map((k) => ({
        key: k,
        label: SLOT_GROUP_LABELS[k],
        items: buckets.get(k)!.items,
        kcal: buckets.get(k)!.kcal,
      }))
    })

    const tab = ref<'text' | 'photo' | 'barcode' | 'mine'>('text')

    // Особиста база страв (лениво завантажується при першому відкритті вкладки).
    const myDishes = ref<MyDish[]>([])
    const dishesPending = ref(false)
    const dishesLoaded = ref(false)
    const dishesError = ref<string | null>(null)
    const dishQuery = ref('')
    const dishHits = ref<MyDish[] | null>(null)
    const dishSearchPending = ref(false)

    async function loadMyDishes() {
      if (dishesLoaded.value || dishesPending.value) return
      dishesPending.value = true
      dishesError.value = null
      try {
        const res = await fetchMyDishes()
        myDishes.value = res.items
        dishesLoaded.value = true
      } catch (err: unknown) {
        dishesError.value = extractErrorMessage(err) ?? 'Не вдалося завантажити страви'
      } finally {
        dishesPending.value = false
      }
    }

    const visibleDishes = computed(() => dishHits.value ?? myDishes.value)

    function selectTab(next: 'text' | 'photo' | 'barcode' | 'mine') {
      tab.value = next
      if (next === 'mine') void loadMyDishes()
    }

    // Префіл чернетки з готової страви (per100 відомі → масштабуємо на порцію).
    function openDishDraft(d: MyDish) {
      const portion = d.lastPortionGrams > 0 ? d.lastPortionGrams : 100
      const k = portion / 100
      fillDraft(
        {
          name: d.name,
          portionGrams: portion,
          kcal: roundKcal(d.per100.kcal * k),
          protein: roundMacro(d.per100.protein * k),
          fat: roundMacro(d.per100.fat * k),
          carb: roundMacro(d.per100.carb * k),
          confidence: 1,
          per100: { ...d.per100 },
          foodItemId: d.foodItemId,
          suggestedSource: 'MANUAL',
        },
        null,
      )
      nextTick(() => editorRef.value?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
    }
    const textInput = ref('')
    const recognizing = ref(false)
    const recognizeError = ref<string | null>(null)
    const fileInput = ref<HTMLInputElement | null>(null)

    const suggestions = ref<FoodSearchHit[]>([])
    const suggestionsOpen = ref(false)
    const suggestionIndex = ref(-1)
    let suggestTimer: ReturnType<typeof setTimeout> | null = null
    let dishTimer: ReturnType<typeof setTimeout> | null = null

    function clearSuggestTimer() {
      if (suggestTimer) {
        clearTimeout(suggestTimer)
        suggestTimer = null
      }
    }

    async function loadSuggestions(term: string) {
      if (term.length < 2) {
        suggestions.value = []
        suggestionsOpen.value = false
        suggestionIndex.value = -1
        return
      }
      try {
        const res = await searchFood(term, 8)
        suggestions.value = res.items
        suggestionsOpen.value = res.items.length > 0
        suggestionIndex.value = res.items.length > 0 ? 0 : -1
      } catch {
        suggestions.value = []
        suggestionsOpen.value = false
      }
    }

    watch(textInput, (value) => {
      clearSuggestTimer()
      const term = value.trim()
      if (term.length < 2) {
        suggestions.value = []
        suggestionsOpen.value = false
        suggestionIndex.value = -1
        return
      }
      suggestTimer = setTimeout(() => void loadSuggestions(term), 280)
    })

    watch(dishQuery, (value) => {
      if (dishTimer) clearTimeout(dishTimer)
      const term = value.trim()
      if (term.length < 2) {
        dishHits.value = null
        dishSearchPending.value = false
        return
      }
      dishSearchPending.value = true
      dishTimer = setTimeout(async () => {
        try {
          const res = await fetchMyDishes(term)
          dishHits.value = res.items
        } catch (err: unknown) {
          dishesError.value = extractErrorMessage(err) ?? 'Не вдалося знайти страви'
        } finally {
          dishSearchPending.value = false
        }
      }, 280)
    })

    onBeforeUnmount(() => {
      clearSuggestTimer()
      if (dishTimer) clearTimeout(dishTimer)
    })

    function openSuggestionDraft(item: FoodSearchHit) {
      suggestionsOpen.value = false
      suggestionIndex.value = -1
      fillDraft(
        {
          name: item.name,
          portionGrams: 100,
          kcal: roundKcal(item.kcalPer100),
          protein: roundMacro(item.proteinPer100),
          fat: roundMacro(item.fatPer100),
          carb: roundMacro(item.carbPer100),
          confidence: 1,
          per100: {
            kcal: item.kcalPer100,
            protein: item.proteinPer100,
            fat: item.fatPer100,
            carb: item.carbPer100,
          },
          foodItemId: item.id,
          suggestedSource: 'MANUAL',
        },
        { cacheHit: true, usingFallback: false },
      )
      nextTick(() => editorRef.value?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
    }

    function onTextKeydown(e: KeyboardEvent) {
      if (!suggestionsOpen.value || suggestions.value.length === 0) {
        if (e.key === 'Enter') void onRecognizeText()
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        suggestionIndex.value = (suggestionIndex.value + 1) % suggestions.value.length
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        suggestionIndex.value =
          (suggestionIndex.value - 1 + suggestions.value.length) % suggestions.value.length
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const item =
          suggestionIndex.value >= 0 ? suggestions.value[suggestionIndex.value] : suggestions.value[0]
        if (item) openSuggestionDraft(item)
      } else if (e.key === 'Escape') {
        suggestionsOpen.value = false
        suggestionIndex.value = -1
      }
    }

    // Чернетка (редагована перед збереженням).
    const draft = reactive<DraftForm>({
      name: '',
      portionGrams: 100,
      kcal: 0,
      protein: 0,
      fat: 0,
      carb: 0,
      slot: '',
      source: 'MANUAL',
      confidence: null,
      foodItemId: null,
      per100: null,
    })
    const draftVisible = ref(false)
    const draftMeta = ref<{ cacheHit: boolean; usingFallback: boolean; barcode?: boolean } | null>(
      null,
    )
    const saving = ref(false)
    // Коли задано — редагуємо наявний запис, а не створюємо новий.
    const editingId = ref<string | null>(null)
    const editorRef = ref<HTMLDivElement | null>(null)

    function fillDraft(
      d: RecognizeDraft,
      meta: { cacheHit: boolean; usingFallback: boolean; barcode?: boolean } | null,
    ) {
      draft.name = d.name
      draft.portionGrams = d.portionGrams
      draft.kcal = d.kcal
      draft.protein = d.protein
      draft.fat = d.fat
      draft.carb = d.carb
      draft.slot = ''
      draft.source = d.suggestedSource
      draft.confidence = d.confidence
      draft.foodItemId = d.foodItemId
      draft.per100 = d.per100
      draftMeta.value = meta
      editingId.value = null
      draftVisible.value = true
    }

    // Відкриває редактор для наявного запису (режим редагування).
    function openEditDraft(m: MealItem) {
      const scale = m.portionGrams > 0 ? 100 / m.portionGrams : 0
      draft.name = m.name
      draft.portionGrams = m.portionGrams
      draft.kcal = m.kcal
      draft.protein = m.protein
      draft.fat = m.fat
      draft.carb = m.carb
      draft.slot = m.slot ?? ''
      draft.source = m.source
      draft.confidence = m.confidence
      // Скидаємо привʼязку: сервер пере-привʼяже FoodItem за назвою (upsert).
      draft.foodItemId = null
      draft.per100 = scale
        ? {
            kcal: roundKcal(m.kcal * scale),
            protein: roundMacro(m.protein * scale),
            fat: roundMacro(m.fat * scale),
            carb: roundMacro(m.carb * scale),
          }
        : null
      draftMeta.value = null
      editingId.value = m.id
      draftVisible.value = true
      nextTick(() => editorRef.value?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
    }

    function openManualDraft() {
      fillDraft(
        {
          name: '',
          portionGrams: 100,
          kcal: 0,
          protein: 0,
          fat: 0,
          carb: 0,
          confidence: 1,
          per100: { kcal: 0, protein: 0, fat: 0, carb: 0 },
          foodItemId: null,
          suggestedSource: 'MANUAL',
        },
        null,
      )
    }

    function closeDraft() {
      draftVisible.value = false
      draftMeta.value = null
      editingId.value = null
    }

    // Зміна порції масштабує БЖВ, якщо відома поживність на 100 г.
    function onPortionChange(value: number) {
      draft.portionGrams = value
      const p = draft.per100
      if (p && (p.kcal || p.protein || p.fat || p.carb)) {
        const k = value / 100
        draft.kcal = roundKcal(p.kcal * k)
        draft.protein = roundMacro(p.protein * k)
        draft.fat = roundMacro(p.fat * k)
        draft.carb = roundMacro(p.carb * k)
      }
    }

    async function onRecognizeText() {
      const text = textInput.value.trim()
      if (text.length < 2) {
        recognizeError.value = 'Опишіть страву детальніше'
        return
      }
      suggestionsOpen.value = false
      recognizing.value = true
      recognizeError.value = null
      try {
        const res = await recognizeText(text)
        fillDraft(res.draft, { cacheHit: res.cacheHit, usingFallback: res.usingFallback })
      } catch (err: unknown) {
        recognizeError.value = extractErrorMessage(err) ?? 'Не вдалося розпізнати'
      } finally {
        recognizing.value = false
      }
    }

    async function onFileChange(e: Event) {
      const target = e.target as HTMLInputElement
      const file = target.files?.[0]
      if (!file) return
      recognizing.value = true
      recognizeError.value = null
      try {
        const { base64, mimeType } = await compressImage(file)
        const res = await recognizeImage(base64, mimeType)
        fillDraft(res.draft, { cacheHit: res.cacheHit, usingFallback: res.usingFallback })
      } catch (err: unknown) {
        recognizeError.value = extractErrorMessage(err) ?? 'Не вдалося розпізнати фото'
      } finally {
        recognizing.value = false
        target.value = ''
      }
    }

    // Штрихкод: ручний ввід + камерне сканування (нативний BarcodeDetector).
    const barcodeInput = ref('')
    const barcodeError = ref<string | null>(null)
    const barcodeLoading = ref(false)
    const scannerOpen = ref(false)
    const barcodeSupported = ref(false)
    onMounted(() => {
      barcodeSupported.value = typeof window !== 'undefined' && 'BarcodeDetector' in window
    })

    async function onLookupBarcode(raw?: string) {
      const code = (raw ?? barcodeInput.value).replace(/\D/g, '')
      if (code.length < 6) {
        barcodeError.value = 'Введіть штрихкод (мінімум 6 цифр)'
        return
      }
      barcodeInput.value = code
      barcodeLoading.value = true
      barcodeError.value = null
      try {
        const res = await lookupBarcode(code)
        fillDraft(res.draft, { cacheHit: false, usingFallback: false, barcode: true })
        nextTick(() => editorRef.value?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
      } catch (err: unknown) {
        barcodeError.value = extractErrorMessage(err) ?? 'Не вдалося знайти продукт за штрихкодом'
      } finally {
        barcodeLoading.value = false
      }
    }

    function onScanDetected(code: string) {
      scannerOpen.value = false
      void onLookupBarcode(code)
    }

    async function onSaveDraft() {
      if (!draft.name.trim()) {
        toast.error('Вкажіть назву страви')
        return
      }
      if (draft.portionGrams <= 0) {
        toast.error('Порція має бути більшою за 0')
        return
      }
      saving.value = true
      try {
        const payload = {
          name: draft.name.trim(),
          portionGrams: draft.portionGrams,
          kcal: draft.kcal,
          protein: draft.protein,
          fat: draft.fat,
          carb: draft.carb,
          slot: draft.slot || null,
          source: draft.source,
          confidence: draft.confidence,
          foodItemId: draft.foodItemId,
        }
        if (editingId.value) {
          await updateMeal(editingId.value, payload)
          toast.success('Запис оновлено')
        } else {
          await saveMeal(payload)
          textInput.value = ''
          toast.success('Запис додано')
        }
        closeDraft()
      } catch (err: unknown) {
        toast.error(
          editingId.value
            ? extractErrorMessage(err) ?? 'Не вдалося оновити запис'
            : extractErrorMessage(err) ?? 'Не вдалося зберегти запис',
        )
      } finally {
        saving.value = false
      }
    }

    const copying = ref(false)
    async function onCopyYesterday() {
      copying.value = true
      try {
        const res = await copyMeals(shiftIso(date.value, -1), date.value)
        toast.success(`Скопійовано ${res.copied} записів`)
      } catch (err: unknown) {
        toast.error(extractErrorMessage(err) ?? 'Не вдалося скопіювати вчорашній день')
      } finally {
        copying.value = false
      }
    }

    async function onToggleFavorite(d: MyDish) {
      const next = !d.favorite
      try {
        await setFavorite(d.foodItemId, next)
        const patch = (list: MyDish[]) =>
          list.map((item) => (item.foodItemId === d.foodItemId ? { ...item, favorite: next } : item))
        myDishes.value = patch(myDishes.value)
        if (dishHits.value) dishHits.value = patch(dishHits.value)
      } catch (err: unknown) {
        toast.error(extractErrorMessage(err) ?? 'Не вдалося оновити улюблені')
      }
    }
    const deletingId = ref<string | null>(null)
    async function onDelete(id: string) {
      deletingId.value = id
      try {
        await deleteMeal(id)
      } catch (err: unknown) {
        toast.error(extractErrorMessage(err) ?? 'Не вдалося видалити запис')
      } finally {
        deletingId.value = null
      }
    }

    function progressBar(label: string, value: number, norm: number | null, unit: string, tint: string) {
      const pct = norm && norm > 0 ? Math.min(100, Math.round((value / norm) * 100)) : 0
      const over = norm != null && value > norm
      return (
        <div>
          <div class="flex items-baseline justify-between text-sm">
            <span class="font-medium text-gray-700">{label}</span>
            <span class="text-gray-500">
              <strong class={over ? 'text-red-600' : 'text-gray-800'}>{Math.round(value)}</strong>
              {norm != null ? ` / ${norm}` : ''} {unit}
            </span>
          </div>
          <div class="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              class={`h-full rounded-full transition-all ${over ? 'bg-red-400' : tint}`}
              style={{ width: `${norm && norm > 0 ? pct : value > 0 ? 100 : 0}%` }}
            />
          </div>
        </div>
      )
    }

    function draftField(
      key: 'kcal' | 'protein' | 'fat' | 'carb',
      label: string,
    ) {
      return (
        <div>
          <label class={labelClass} for={`draft-${key}`}>{label}</label>
          <input
            id={`draft-${key}`}
            type="number"
            min={0}
            step="0.1"
            value={draft[key]}
            onInput={(e) => (draft[key] = parseNum((e.target as HTMLInputElement).value))}
            class={inputClass}
          />
        </div>
      )
    }

    function renderMeal(m: MealItem) {
      return (
        <li key={m.id} class="flex items-center gap-3 py-3">
          <div class="min-w-0 flex-1">
            <span class="block truncate font-medium text-gray-900">{m.name}</span>
            <div class="mt-0.5 text-xs text-gray-500">
              {formatDay(m.date)}, {formatTime(m.createdAt)} · {m.portionGrams} г · Б {m.protein} · Ж {m.fat} · В {m.carb} ·{' '}
              <span class="text-gray-500">{SOURCE_LABELS[m.source]}</span>
            </div>
          </div>
          <div class="shrink-0 text-right">
            <div class="font-semibold text-gray-900">{Math.round(m.kcal)} ккал</div>
            <div class="mt-1 flex items-center justify-end gap-3 text-xs">
              <button
                type="button"
                onClick={() => openEditDraft(m)}
                class="font-medium text-brand-600 hover:text-brand-700"
              >
                Редагувати
              </button>
              <button
                type="button"
                onClick={() => onDelete(m.id)}
                disabled={deletingId.value === m.id}
                class="text-sm font-medium text-red-700 hover:text-red-800 disabled:opacity-50"
              >
                {deletingId.value === m.id ? 'Видаляємо…' : 'Видалити'}
              </button>
            </div>
          </div>
        </li>
      )
    }

    return () => (
      <section class="space-y-6">
        {/* Заголовок + навігація по датах */}
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h1 class="text-2xl font-bold text-gray-900">Щоденник</h1>
          <div class="flex items-center gap-2 sm:flex-nowrap flex-wrap">
            <div class="flex items-center gap-2 sm:w-auto w-full">
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
            <div class="flex items-center justify-end w-full sm:mt-0 mt-3">
              <button
                type="button"
                onClick={() => void onCopyYesterday()}
                disabled={copying.value}
                class={btnTabActiveClass}
              >
                {copying.value ? 'Копіюємо…' : 'Копіювати вчора'}
              </button>
            </div>
          </div>
        </div>

        {/* Прогрес відносно норм */}
        <div class="rounded-xl bg-card md:p-6 p-5 shadow-card">
          <h2 class="text-lg font-semibold text-gray-900">Прогрес дня</h2>
          <div class="mt-4 space-y-3">
            {progressBar('Калорії', totals.value.totalKcal, norms.value.dailyKcal, 'ккал', 'bg-brand-500')}
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {progressBar('Білки', totals.value.totalProtein, norms.value.proteinGrams, 'г', 'bg-sky-400')}
              {progressBar('Жири', totals.value.totalFat, norms.value.fatGrams, 'г', 'bg-amber-400')}
              {progressBar('Вуглеводи', totals.value.totalCarb, norms.value.carbGrams, 'г', 'bg-rose-400')}
            </div>
          </div>
          {norms.value.dailyKcal == null && (
            <p class="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
              Заповніть профіль, щоб бачити цільові норми.
            </p>
          )}
        </div>

        {/* Додавання */}
        <div class="rounded-xl bg-card md:p-6 p-5 shadow-card">
          <h2 class="text-lg font-semibold text-gray-900">Додати їжу</h2>

          <div class="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => selectTab('text')}
              aria-pressed={tab.value === 'text'}
              class={tab.value === 'text' ? btnTabActiveClass : btnTabIdleClass}
            >
              Текст
            </button>
            <button
              type="button"
              onClick={() => selectTab('photo')}
              aria-pressed={tab.value === 'photo'}
              class={tab.value === 'photo' ? btnTabActiveClass : btnTabIdleClass}
            >
              Фото
            </button>
            <button
              type="button"
              onClick={() => selectTab('barcode')}
              aria-pressed={tab.value === 'barcode'}
              class={tab.value === 'barcode' ? btnTabActiveClass : btnTabIdleClass}
            >
              Штрихкод
            </button>
            <button
              type="button"
              onClick={() => selectTab('mine')}
              aria-pressed={tab.value === 'mine'}
              class={tab.value === 'mine' ? btnTabActiveClass : btnTabIdleClass}
            >
              Мої страви
            </button>
            <button
              type="button"
              onClick={openManualDraft}
              class={`${btnSecondaryClass} ml-auto px-3 py-1.5 text-sm`}
            >
              Вручну
            </button>
          </div>

          {tab.value === 'mine' ? (
            <div class="mt-4">
              {dishesPending.value ? (
                <LoadingState />
              ) : dishesError.value ? (
                <ErrorBanner message={dishesError.value} />
              ) : myDishes.value.length === 0 && !dishQuery.value.trim() ? (
                <EmptyState message="Тут зʼявляться страви, які ви вже додавали. Додайте кілька записів через текст, фото чи вручну." />
              ) : (
                <>
                  <label class={labelClass} for="dishSearch">Пошук у моїх стравах</label>
                  <input
                    id="dishSearch"
                    type="search"
                    value={dishQuery.value}
                    onInput={(e) => (dishQuery.value = (e.target as HTMLInputElement).value)}
                    class={inputClass}
                    placeholder="напр. гречка, борщ, омлет"
                    autocomplete="off"
                  />
                  {dishSearchPending.value ? (
                    <div class="mt-3">
                      <LoadingState />
                    </div>
                  ) : visibleDishes.value.length === 0 ? (
                    <p class="mt-3 text-sm text-gray-500">Нічого не знайдено. Спробуйте інший запит.</p>
                  ) : (
                    <ul class="mt-2 divide-y divide-gray-100">
                      {visibleDishes.value.map((d) => (
                        <li key={d.foodItemId} class="flex items-center gap-3 py-2.5">
                          <div class="min-w-0 flex-1">
                            <div class="truncate font-medium text-gray-900">{d.name}</div>
                            <div class="mt-0.5 text-xs text-gray-500">
                              {Math.round(d.per100.kcal)} ккал/100 г · Б {roundMacro(d.per100.protein)} · Ж{' '}
                              {roundMacro(d.per100.fat)} · В {roundMacro(d.per100.carb)}
                              {d.timesUsed > 0 ? (
                                <span class="text-gray-500"> · {d.timesUsed}×</span>
                              ) : null}
                              {d.match === 'semantic' ? (
                                <span class="ml-1 text-brand-700">· схожа страва</span>
                              ) : null}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => void onToggleFavorite(d)}
                            class="shrink-0 rounded-lg px-2 py-1.5 text-sm font-medium text-amber-600 hover:bg-amber-50"
                            aria-pressed={!!d.favorite}
                            aria-label={d.favorite ? 'Прибрати з улюблених' : 'Додати до улюблених'}
                            title={d.favorite ? 'В улюблених' : 'Додати до улюблених'}
                          >
                            {d.favorite ? '★' : '☆'}
                          </button>
                          <button
                            type="button"
                            onClick={() => openDishDraft(d)}
                            class="shrink-0 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-brand-700"
                          >
                            Додати
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          ) : tab.value === 'text' ? (
            <div class="mt-4 flex flex-wrap items-end gap-3">
              <div class="relative min-w-0 w-full md:w-auto md:flex-1">
                <label class={labelClass} for="foodText">Опис страви</label>
                <input
                  id="foodText"
                  type="text"
                  value={textInput.value}
                  onInput={(e) => (textInput.value = (e.target as HTMLInputElement).value)}
                  onKeydown={onTextKeydown}
                  onBlur={() => {
                    setTimeout(() => {
                      suggestionsOpen.value = false
                    }, 120)
                  }}
                  class={inputClass}
                  placeholder="напр. тарілка гречки з куркою, 300 г"
                  autocomplete="off"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={suggestionsOpen.value}
                  aria-controls="food-suggestions"
                  aria-activedescendant={
                    suggestionIndex.value >= 0 ? `food-suggestions-${suggestionIndex.value}` : undefined
                  }
                />
                {suggestionsOpen.value ? (
                  <FoodSuggestions
                    items={suggestions.value}
                    activeIndex={suggestionIndex.value}
                    onSelect={openSuggestionDraft}
                  />
                ) : null}
              </div>
              <button
                type="button"
                onClick={onRecognizeText}
                disabled={recognizing.value}
                aria-busy={recognizing.value}
                class={btnPrimaryClass}
              >
                {recognizing.value ? 'Розпізнаємо…' : 'Розпізнати'}
              </button>
            </div>
          ) : tab.value === 'photo' ? (
            <div class="mt-4">
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                capture="environment"
                aria-label="Фото страви"
                onChange={onFileChange}
                class="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-600 file:px-4 file:py-2 file:font-medium file:text-white hover:file:bg-brand-700"
              />
              <p class="mt-2 text-xs text-gray-500">
                Фото стискається на пристрої перед відправкою. {recognizing.value && 'Розпізнаємо…'}
              </p>
            </div>
          ) : (
            <div class="mt-4 space-y-3">
              <div class="flex flex-wrap items-end gap-3">
                <div class="min-w-0 w-full md:w-auto md:flex-1">
                  <label class={labelClass} for="barcodeInput">Штрихкод продукту</label>
                  <input
                    id="barcodeInput"
                    type="text"
                    inputmode="numeric"
                    autocomplete="off"
                    value={barcodeInput.value}
                    onInput={(e) => (barcodeInput.value = (e.target as HTMLInputElement).value)}
                    onKeydown={(e: KeyboardEvent) => {
                      if (e.key === 'Enter') void onLookupBarcode()
                    }}
                    class={inputClass}
                    placeholder="напр. 4820000000000"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void onLookupBarcode()}
                  disabled={barcodeLoading.value}
                  aria-busy={barcodeLoading.value}
                  class={btnPrimaryClass}
                >
                  {barcodeLoading.value ? 'Шукаємо…' : 'Знайти'}
                </button>
                {barcodeSupported.value && !scannerOpen.value && (
                  <button
                    type="button"
                    onClick={() => (scannerOpen.value = true)}
                    class={btnSecondaryClass}
                  >
                    Сканувати камерою
                  </button>
                )}
              </div>
              <p class="text-xs text-gray-500">
                Дані з відкритої бази Open Food Facts. Перевіряйте поживність — записи бувають
                неповні.
              </p>
              {scannerOpen.value && (
                <BarcodeScanner
                  onDetected={onScanDetected}
                  onClose={() => (scannerOpen.value = false)}
                />
              )}
              {barcodeError.value && <ErrorBanner message={barcodeError.value} />}
            </div>
          )}

          {recognizeError.value && (
            <div class="mt-3">
              <ErrorBanner message={recognizeError.value}>
                <NuxtLink to="/settings/ai-keys" class="mt-1 inline-block font-medium text-red-900 underline">
                  Перейти до налаштувань AI
                </NuxtLink>
              </ErrorBanner>
            </div>
          )}

          {/* Редактор чернетки */}
          {draftVisible.value && (
            <div ref={editorRef} class="mt-5 rounded-xl border border-brand-100 bg-brand-50/40 p-4">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <h3 class="font-semibold text-gray-900">
                  {editingId.value ? 'Редагувати запис' : 'Підтвердіть запис'}
                </h3>
                <div class="flex items-center gap-2 text-xs">
                  {draftMeta.value?.cacheHit && (
                    <span class="rounded-full bg-gray-200 px-2 py-0.5 text-gray-600">З довідника</span>
                  )}
                  {draftMeta.value?.barcode && (
                    <span class="rounded-full bg-gray-200 px-2 py-0.5 text-gray-600">Зі штрихкоду</span>
                  )}
                  {draftMeta.value?.usingFallback && (
                    <span class="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">Сервісний ключ</span>
                  )}
                  {!editingId.value && draft.confidence != null && draft.source !== 'MANUAL' && (
                    <span class="rounded-full bg-brand-100 px-2 py-0.5 text-brand-700">
                      Впевненість {Math.round(draft.confidence * 100)}%
                    </span>
                  )}
                </div>
              </div>

              <div class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div class="sm:col-span-2">
                  <label class={labelClass} for="draft-name">Назва</label>
                  <input
                    id="draft-name"
                    type="text"
                    value={draft.name}
                    onInput={(e) => (draft.name = (e.target as HTMLInputElement).value)}
                    class={inputClass}
                  />
                </div>

                <div>
                  <label class={labelClass} for="draft-portion">Порція, г</label>
                  <input
                    id="draft-portion"
                    type="number"
                    min={1}
                    step="1"
                    value={draft.portionGrams}
                    onInput={(e) => onPortionChange(parseNum((e.target as HTMLInputElement).value))}
                    class={inputClass}
                  />
                </div>

                <div>
                  <label class={labelClass} for="draft-slot">Прийом їжі</label>
                  <select
                    id="draft-slot"
                    value={draft.slot}
                    onChange={(e) => (draft.slot = (e.target as HTMLSelectElement).value as MealSlot | '')}
                    class={inputClass}
                  >
                    <option value="">Не вказано</option>
                    {SLOT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                {draftField('kcal', 'Калорії, ккал')}
                {draftField('protein', 'Білки, г')}
                {draftField('fat', 'Жири, г')}
                {draftField('carb', 'Вуглеводи, г')}
              </div>

              <div class="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={onSaveDraft}
                  disabled={saving.value}
                  aria-busy={saving.value}
                  class={btnPrimaryClass}
                >
                  {saving.value
                    ? editingId.value
                      ? 'Оновлюємо…'
                      : 'Зберігаємо…'
                    : editingId.value
                      ? 'Оновити'
                      : 'Зберегти'}
                </button>
                <button
                  type="button"
                  onClick={closeDraft}
                  class={btnSecondaryClass}
                >
                  Скасувати
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Записи дня */}
        <div class="rounded-xl bg-card md:p-6 p-5 shadow-card">
          <div class="flex items-baseline justify-between">
            <h2 class="text-lg font-semibold text-gray-900">Записи</h2>
            <span class="text-sm text-gray-500">
              Разом: <strong class="text-gray-800">{Math.round(totals.value.totalKcal)} ккал</strong>
            </span>
          </div>

          {pending.value && meals.value.length === 0 ? (
            <LoadingState />
          ) : meals.value.length === 0 ? (
            <EmptyState message="Ще немає записів за цей день." />
          ) : (
            <div class="mt-4 space-y-5">
              {groupedMeals.value.map((group) => (
                <div key={group.key}>
                  <div class="flex items-baseline justify-between border-b border-gray-100 pb-1">
                    <h3 class="text-sm font-semibold text-gray-700">{group.label}</h3>
                    <span class="text-xs text-gray-500">{Math.round(group.kcal)} ккал</span>
                  </div>
                  <ul class="divide-y divide-gray-100">{group.items.map(renderMeal)}</ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    )
  },
})
