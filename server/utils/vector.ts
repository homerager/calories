// Чисті хелпери для embeddings.
// Вектори зберігаються у звичайній колонці PostgreSQL `double precision[]`
// (`FoodItem.embedding`) — pgvector недоступний на керованих хостах без прав
// суперкористувача. Схожість рахується як скалярний добуток нормалізованих
// векторів (== косинусна схожість) прямо в SQL через unnest.

/** Розмірність embedding (OpenAI dimensions=768 / Gemini outputDimensionality=768). */
export const EMBEDDING_DIMENSIONS = 768

/** Мінімальна косинусна схожість, щоб показувати суто семантичний збіг. */
export const MIN_SEMANTIC_SIMILARITY = 0.42

/** Перевіряє довжину та скінченність значень вектора. */
export function assertVector(values: number[]): number[] {
  if (values.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`Очікується вектор довжини ${EMBEDDING_DIMENSIONS}, отримано ${values.length}`)
  }
  for (const v of values) {
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw new Error('Вектор містить нечислове значення')
    }
  }
  return values
}

/**
 * Нормалізує вектор до одиничної довжини.
 * Тоді скалярний добуток двох векторів дорівнює косинусній схожості —
 * і SQL не мусить рахувати норми на кожен рядок.
 */
export function normalizeVector(values: number[]): number[] {
  let sum = 0
  for (const v of values) sum += v * v
  const norm = Math.sqrt(sum)
  if (norm === 0) return values.slice()
  return values.map((v) => v / norm)
}

/**
 * Серіалізує масив у літерал масиву PostgreSQL: `{0.1,-0.2,...}`.
 * Кидає, якщо довжина/значення невалідні.
 */
export function toFloatArrayLiteral(values: number[]): string {
  assertVector(values)
  return `{${values.join(',')}}`
}

/** Косинусна схожість двох векторів (1 = однакові, 0 = ортогональні, −1 = протилежні). */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!
    const y = b[i]!
    dot += x * y
    normA += x * x
    normB += y * y
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  if (denom === 0) return 0
  return dot / denom
}

/**
 * Лексичний бал назви відносно запиту (вже lower-case).
 * 1 — точний збіг, далі префікс/слово/підрядок, 0 — немає збігу.
 */
export function lexicalScore(name: string, queryLower: string): number {
  if (!queryLower) return 0
  const n = name.toLowerCase()
  if (n === queryLower) return 1
  if (n.startsWith(queryLower)) return 0.92
  const words = n.split(/[\s,/()-]+/).filter(Boolean)
  if (words.some((w) => w.startsWith(queryLower))) return 0.85
  if (n.includes(queryLower)) return 0.78
  return 0
}
