import type { AiProvider } from '../../prisma/generated/client/enums'
import { Prisma } from '../../prisma/generated/client/client'
import { prisma } from '../utils/prisma'
import { decrypt } from '../utils/crypto'
import { EMBEDDING_DIMENSIONS, toVectorLiteral } from '../utils/vector'
import { fetchWithRetry, readJsonOrThrow } from './providers/shared'
import { serviceKey } from './config'

// Генерація та збереження embedding назв страв.
// Один простір векторів на інсталяцію: провайдер/модель з env, розмірність 1536
// (колонка pgvector). Зміна моделі потребує повторного backfill.

export type EmbeddingTask = 'query' | 'document'

export interface EmbeddingKey {
  provider: AiProvider
  apiKey: string
  model: string
}

const inflight = new Set<string>()

interface CacheEntry {
  vector: number[]
  at: number
}

const queryCache = new Map<string, CacheEntry>()
const QUERY_CACHE_TTL_MS = 10 * 60 * 1000
const QUERY_CACHE_MAX = 200

/** Провайдер embeddings: OPENAI (дефолт) або GEMINI. Anthropic embeddings не має. */
export function embeddingProvider(): 'OPENAI' | 'GEMINI' {
  const raw = process.env.NUXT_AI_EMBEDDING_PROVIDER?.trim().toUpperCase()
  return raw === 'GEMINI' ? 'GEMINI' : 'OPENAI'
}

/** Модель embeddings (env або дефолт під провайдера). */
export function embeddingModel(): string {
  const explicit = process.env.NUXT_AI_EMBEDDING_MODEL?.trim()
  if (explicit) return explicit
  return embeddingProvider() === 'GEMINI' ? 'gemini-embedding-001' : 'text-embedding-3-small'
}

function cacheKey(text: string): string {
  return `${embeddingProvider()}:${embeddingModel()}:${text.trim().toLowerCase()}`
}

function getCached(text: string): number[] | null {
  const key = cacheKey(text)
  const hit = queryCache.get(key)
  if (!hit) return null
  if (Date.now() - hit.at > QUERY_CACHE_TTL_MS) {
    queryCache.delete(key)
    return null
  }
  return hit.vector
}

function setCached(text: string, vector: number[]): void {
  if (queryCache.size >= QUERY_CACHE_MAX) {
    const oldest = queryCache.keys().next().value
    if (oldest) queryCache.delete(oldest)
  }
  queryCache.set(cacheKey(text), { vector, at: Date.now() })
}

/**
 * Резолвить ключ для embeddings: сервісний ключ обраного провайдера,
 * інакше власний ключ користувача (якщо передано userId).
 * Не списує безкоштовну квоту розпізнавання — embeddings дешеві й часті.
 */
export async function resolveEmbeddingKey(userId?: string): Promise<EmbeddingKey | null> {
  const provider = embeddingProvider()
  const model = embeddingModel()
  const service = serviceKey(provider)
  if (service) return { provider, apiKey: service, model }

  if (!userId) return null

  const row = await prisma.userAiKey.findUnique({
    where: { userId_provider: { userId, provider } },
    select: { encryptedKey: true },
  })
  if (!row) return null
  try {
    const apiKey = decrypt(row.encryptedKey)
    return apiKey ? { provider, apiKey, model } : null
  } catch {
    return null
  }
}

/** Чи можна викликати embeddings (є сервісний ключ обраного провайдера). */
export function embeddingsConfigured(): boolean {
  return serviceKey(embeddingProvider()) !== null
}

/** Текст, який йде в модель: назва страви без зайвих пробілів. */
export function foodEmbeddingText(name: string): string {
  return name.replace(/\s+/g, ' ').trim()
}

interface OpenAIEmbeddingResponse {
  data?: Array<{ embedding?: number[]; index?: number }>
}

interface GeminiEmbeddingResponse {
  embedding?: { values?: number[] }
  embeddings?: Array<{ values?: number[] }>
}

function assertDim(values: number[], provider: string): number[] {
  if (values.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `${provider}: очікувалась розмірність ${EMBEDDING_DIMENSIONS}, отримано ${values.length}`,
    )
  }
  return values
}

async function embedOpenAI(texts: string[], key: EmbeddingKey, task: EmbeddingTask): Promise<number[][]> {
  void task
  const res = await fetchWithRetry('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: key.model,
      input: texts,
      dimensions: EMBEDDING_DIMENSIONS,
    }),
  })
  const json = (await readJsonOrThrow(res, 'OPENAI')) as OpenAIEmbeddingResponse
  const data = [...(json.data ?? [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
  if (data.length !== texts.length) {
    throw new Error(`OPENAI embeddings: очікувалось ${texts.length} векторів, отримано ${data.length}`)
  }
  return data.map((d) => assertDim(d.embedding ?? [], 'OPENAI'))
}

function geminiTaskType(task: EmbeddingTask): string {
  return task === 'query' ? 'RETRIEVAL_QUERY' : 'RETRIEVAL_DOCUMENT'
}

async function embedGemini(texts: string[], key: EmbeddingKey, task: EmbeddingTask): Promise<number[][]> {
  const model = key.model.startsWith('models/') ? key.model.slice('models/'.length) : key.model
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:batchEmbedContents?key=${encodeURIComponent(key.apiKey)}`
  const res = await fetchWithRetry(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: texts.map((text) => ({
        model: `models/${model}`,
        content: { parts: [{ text }] },
        outputDimensionality: EMBEDDING_DIMENSIONS,
        taskType: geminiTaskType(task),
      })),
    }),
  })
  const json = (await readJsonOrThrow(res, 'GEMINI')) as GeminiEmbeddingResponse
  const list = json.embeddings ?? (json.embedding ? [json.embedding] : [])
  if (list.length !== texts.length) {
    throw new Error(`GEMINI embeddings: очікувалось ${texts.length} векторів, отримано ${list.length}`)
  }
  return list.map((e) => assertDim(e.values ?? [], 'GEMINI'))
}

/**
 * Рахує embeddings для списку текстів. Порожній вхід → порожній вихід.
 * Якщо ключа немає — `null` (викликач падає назад на лексичний пошук).
 */
export async function embedTexts(
  texts: string[],
  options: { task?: EmbeddingTask; userId?: string } = {},
): Promise<number[][] | null> {
  if (texts.length === 0) return []
  const key = await resolveEmbeddingKey(options.userId)
  if (!key) return null
  const task = options.task ?? 'document'
  try {
    return key.provider === 'GEMINI' ? await embedGemini(texts, key, task) : await embedOpenAI(texts, key, task)
  } catch (err) {
    console.error('[embeddings] не вдалося отримати вектори:', err)
    return null
  }
}

/** Embedding одного пошукового запиту (з коротким in-memory кешем). */
export async function embedQuery(text: string, userId?: string): Promise<number[] | null> {
  const input = foodEmbeddingText(text)
  if (!input) return null
  const cached = getCached(input)
  if (cached) return cached
  const batch = await embedTexts([input], { task: 'query', userId })
  const vector = batch?.[0] ?? null
  if (vector) setCached(input, vector)
  return vector
}

/** Записує вектор у колонку pgvector. */
export async function saveFoodEmbedding(foodItemId: string, values: number[]): Promise<void> {
  const vecSql = Prisma.raw(`'${toVectorLiteral(values)}'::vector`)
  await prisma.$executeRaw`
    UPDATE "FoodItem"
    SET embedding = ${vecSql}
    WHERE id = ${foodItemId}
  `
}

/** Чи вже є embedding у рядка. */
export async function foodItemHasEmbedding(foodItemId: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ present: boolean | null }>>`
    SELECT (embedding IS NOT NULL) AS present FROM "FoodItem" WHERE id = ${foodItemId}
  `
  return Boolean(rows[0]?.present)
}

/**
 * Генерує й зберігає embedding, якщо його ще немає.
 * Мовчки виходить, якщо ключа немає або виклик не вдався.
 */
export async function ensureFoodEmbedding(foodItemId: string, userId?: string): Promise<void> {
  const key = await resolveEmbeddingKey(userId)
  if (!key) return
  if (await foodItemHasEmbedding(foodItemId)) return
  const item = await prisma.foodItem.findUnique({
    where: { id: foodItemId },
    select: { id: true, name: true },
  })
  if (!item) return
  const text = foodEmbeddingText(item.name)
  if (!text) return
  const batch = await embedTexts([text], { task: 'document', userId })
  const vector = batch?.[0]
  if (!vector) return
  await saveFoodEmbedding(item.id, vector)
}

/**
 * Fire-and-forget після коміту транзакції створення/оновлення страви.
 * Дедуплікує паралельні виклики для того самого id.
 */
export function scheduleEnsureEmbedding(
  foodItemId: string | null | undefined,
  userId?: string,
): void {
  if (!foodItemId) return
  if (inflight.has(foodItemId)) return
  inflight.add(foodItemId)
  void ensureFoodEmbedding(foodItemId, userId)
    .catch((err) => console.error('[embeddings] ensureFoodEmbedding:', foodItemId, err))
    .finally(() => inflight.delete(foodItemId))
}

export interface BackfillResult {
  scanned: number
  embedded: number
  skipped: number
}

/**
 * Рахує embeddings для страв без вектора (пачками).
 * Повертає лічильники; якщо ключа немає — embedded=0.
 */
export async function backfillFoodEmbeddings(batchSize = 50): Promise<BackfillResult> {
  const key = await resolveEmbeddingKey()
  if (!key) return { scanned: 0, embedded: 0, skipped: 0 }

  const rows = await prisma.$queryRaw<Array<{ id: string; name: string }>>`
    SELECT id, name FROM "FoodItem" WHERE embedding IS NULL
  `
  const scanned = rows.length
  if (scanned === 0) return { scanned: 0, embedded: 0, skipped: 0 }

  let embedded = 0
  let skipped = 0
  const size = Math.min(Math.max(batchSize, 1), 100)

  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size)
    const texts = chunk.map((r) => foodEmbeddingText(r.name))
    const vectors = await embedTexts(texts, { task: 'document' })
    if (!vectors) {
      skipped += chunk.length
      continue
    }
    for (let j = 0; j < chunk.length; j++) {
      const row = chunk[j]!
      const vector = vectors[j]
      if (!vector) {
        skipped++
        continue
      }
      try {
        await saveFoodEmbedding(row.id, vector)
        embedded++
      } catch (err) {
        skipped++
        console.error('[embeddings] saveFoodEmbedding:', row.id, err)
      }
    }
  }

  return { scanned, embedded, skipped }
}
