import { fetchWithRetry } from '../ai/providers/shared'

// Лукап продукту за штрихкодом в Open Food Facts (open data, ODbL).
// Тільки читання per-100g поживності; нічого не імпортуємо масово в довідник.
// Відповіді кешуються в памʼяті, щоб не бити API на кожен ре-скан.

const OFF_BASE = 'https://world.openfoodfacts.org/api/v2/product'
// OFF просить змістовний User-Agent із контактом застосунку.
const USER_AGENT = 'Calories/1.0 (https://calories.business)'

const FIELDS = [
  'code',
  'product_name',
  'product_name_uk',
  'product_name_ru',
  'generic_name',
  'brands',
  'quantity',
  'serving_quantity',
  'nutriments',
  'image_front_small_url',
].join(',')

export interface OffProduct {
  barcode: string
  name: string
  brand: string | null
  imageUrl: string | null
  /** Розмір порції в грамах, якщо OFF його вказує. */
  servingGrams: number | null
  per100: {
    kcal: number
    protein: number
    fat: number
    carb: number
  }
}

interface CacheEntry {
  value: OffProduct | null
  at: number
}

const cache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const CACHE_MAX = 500

/** Цифри 6–14 знаків (EAN-8/13, UPC-A/E, ITF-14). Інакше — null. */
export function normalizeBarcode(raw: string | undefined | null): string | null {
  const digits = (raw ?? '').replace(/\D/g, '')
  return digits.length >= 6 && digits.length <= 14 ? digits : null
}

function toNumber(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : (value as number)
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}

/** ккал на 100 г: спершу готове значення, інакше переклад з кДж. */
function energyKcalPer100(nutriments: Record<string, unknown>): number | null {
  const kcal = toNumber(nutriments['energy-kcal_100g'])
  if (kcal != null) return kcal
  const kj = toNumber(nutriments['energy-kj_100g']) ?? toNumber(nutriments['energy_100g'])
  return kj != null ? kj / 4.184 : null
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function getFromCache(barcode: string): CacheEntry | null {
  const hit = cache.get(barcode)
  if (!hit) return null
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(barcode)
    return null
  }
  return hit
}

function putInCache(barcode: string, value: OffProduct | null): void {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value
    if (oldest) cache.delete(oldest)
  }
  cache.set(barcode, { value, at: Date.now() })
}

/**
 * Повертає продукт із придатною поживністю або null (не знайдено / немає даних).
 * Не кидає помилок мережі — на збій відповідає null (кешується коротко? ні — не кешуємо).
 */
export async function fetchProductByBarcode(barcode: string): Promise<OffProduct | null> {
  const cached = getFromCache(barcode)
  if (cached) return cached.value

  let json: {
    status?: number
    product?: { nutriments?: Record<string, unknown> } & Record<string, unknown>
  }
  try {
    const res = await fetchWithRetry(
      `${OFF_BASE}/${barcode}?fields=${FIELDS}&lc=uk`,
      { method: 'GET', headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } },
      { retries: 1 },
    )
    if (res.status === 404) {
      putInCache(barcode, null)
      return null
    }
    if (!res.ok) {
      console.error('[openFoodFacts] HTTP', res.status, 'для', barcode)
      return null
    }
    json = (await res.json()) as typeof json
  } catch (err) {
    console.error('[openFoodFacts] запит не вдався:', err)
    return null
  }

  if (json.status !== 1 || !json.product) {
    putInCache(barcode, null)
    return null
  }

  const p = json.product
  const nutriments = p.nutriments ?? {}
  const kcal = energyKcalPer100(nutriments)
  const protein = toNumber(nutriments['proteins_100g'])
  const fat = toNumber(nutriments['fat_100g'])
  const carb = toNumber(nutriments['carbohydrates_100g'])

  // Без калорійності запис у щоденнику не має сенсу.
  if (kcal == null) {
    putInCache(barcode, null)
    return null
  }

  const name =
    [p.product_name_uk, p.product_name_ru, p.product_name, p.generic_name]
      .map((v) => (typeof v === 'string' ? v.trim() : ''))
      .find((v) => v.length > 0) ?? `Продукт ${barcode}`

  const brand =
    typeof p.brands === 'string' && p.brands.trim()
      ? p.brands.split(',')[0]!.trim()
      : null

  const product: OffProduct = {
    barcode,
    name,
    brand,
    imageUrl: typeof p.image_front_small_url === 'string' ? p.image_front_small_url : null,
    servingGrams: toNumber(p.serving_quantity),
    per100: {
      kcal: Math.round(kcal),
      protein: round1(Math.max(0, protein ?? 0)),
      fat: round1(Math.max(0, fat ?? 0)),
      carb: round1(Math.max(0, carb ?? 0)),
    },
  }

  putInCache(barcode, product)
  return product
}
