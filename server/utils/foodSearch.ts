import { Prisma } from '../../prisma/generated/client/client'
import { prisma } from './prisma'
import { normalizeFoodKey } from './crypto'
import { EMBEDDING_DIMENSIONS, toVectorLiteral } from './vector'
import { rankFoodSearchHits, type FoodCatalogRow, type FoodSearchHit } from './foodSearchRank'
import { embedQuery } from '../ai/embeddings'
import type { UserDish } from './myDishes'

// Гібридний пошук страв: лексика (ILIKE / normalizedKey) + косинусна близькість pgvector.

const CATALOG_SELECT = {
  id: true,
  name: true,
  kcalPer100: true,
  proteinPer100: true,
  fatPer100: true,
  carbPer100: true,
} as const

interface SemanticRow extends FoodCatalogRow {
  similarity: number
}

/** Лексичний пошук у довіднику (без AI). */
export async function searchFoodItemsLexical(
  term: string,
  take: number,
  ids?: string[],
): Promise<FoodCatalogRow[]> {
  const normalized = normalizeFoodKey(term)
  return prisma.foodItem.findMany({
    where: {
      ...(ids ? { id: { in: ids } } : {}),
      OR: [
        { name: { contains: term, mode: 'insensitive' } },
        ...(normalized ? [{ normalizedKey: { contains: normalized } }] : []),
      ],
    },
    orderBy: { name: 'asc' },
    take,
    select: CATALOG_SELECT,
  })
}

/** kNN за косинусною відстанню pgvector. Порожньо, якщо немає векторів / розширення. */
export async function searchFoodItemsSemantic(
  vector: number[],
  take: number,
  ids?: string[],
): Promise<SemanticRow[]> {
  if (vector.length !== EMBEDDING_DIMENSIONS) return []
  const safeTake = Math.max(1, Math.min(50, Math.floor(take)))
  const vecSql = Prisma.raw(`'${toVectorLiteral(vector)}'::vector`)
  const idClause =
    ids && ids.length > 0 ? Prisma.sql`AND id IN (${Prisma.join(ids)})` : Prisma.empty
  const limitSql = Prisma.raw(String(safeTake))

  try {
    const rows = await prisma.$queryRaw<Array<SemanticRow & { similarity: unknown }>>`
      SELECT
        id,
        name,
        "kcalPer100",
        "proteinPer100",
        "fatPer100",
        "carbPer100",
        (1 - (embedding <=> ${vecSql}))::double precision AS similarity
      FROM "FoodItem"
      WHERE embedding IS NOT NULL
      ${idClause}
      ORDER BY embedding <=> ${vecSql}
      LIMIT ${limitSql}
    `
    return rows
      .map((r) => ({
        id: r.id,
        name: r.name,
        kcalPer100: Number(r.kcalPer100),
        proteinPer100: Number(r.proteinPer100),
        fatPer100: Number(r.fatPer100),
        carbPer100: Number(r.carbPer100),
        similarity: Number(r.similarity),
      }))
      .filter((r) => Number.isFinite(r.similarity))
  } catch (err) {
    console.error('[foodSearch] семантичний пошук не вдався:', err)
    return []
  }
}

/**
 * Гібридний пошук: лексика завжди, семантика — якщо вдалось отримати embedding запиту.
 * `ids` обмежує вибірку (напр. лише страви користувача).
 */
export async function searchFoodItems(options: {
  query: string
  take?: number
  ids?: string[]
  userId?: string
}): Promise<FoodSearchHit[]> {
  const query = options.query.trim()
  if (query.length < 2) return []

  const take = Math.min(Math.max(options.take ?? 20, 1), 50)
  const ids = options.ids
  if (ids && ids.length === 0) return []

  const lexical = await searchFoodItemsLexical(query, take, ids)

  let semantic: SemanticRow[] = []
  const vector = await embedQuery(query, options.userId)
  if (vector) {
    semantic = await searchFoodItemsSemantic(vector, take, ids)
  }

  return rankFoodSearchHits({ query, lexical, semantic, take })
}

/**
 * Семантичний/гібридний пошук серед страв, які користувач уже їв.
 * Повертає той самий контракт, що й «Мої страви», плюс match/similarity.
 */
export async function searchUserDishes(
  userId: string,
  query: string,
  take = 30,
): Promise<Array<UserDish & { similarity: number | null; match: FoodSearchHit['match'] }>> {
  const grouped = await prisma.mealEntry.groupBy({
    by: ['foodItemId'],
    where: { userId, foodItemId: { not: null } },
    _count: { _all: true },
    _max: { date: true },
  })

  const stats = grouped.filter((g): g is typeof g & { foodItemId: string } => g.foodItemId != null)
  if (stats.length === 0) return []

  const ids = stats.map((g) => g.foodItemId)
  const hits = await searchFoodItems({ query, take, ids, userId })
  if (hits.length === 0) return []

  const hitIds = hits.map((h) => h.id)
  const latest = await prisma.mealEntry.findMany({
    where: { userId, foodItemId: { in: hitIds } },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    distinct: ['foodItemId'],
    select: { foodItemId: true, portionGrams: true },
  })
  const portionById = new Map(latest.map((e) => [e.foodItemId, e.portionGrams]))
  const statsById = new Map(stats.map((g) => [g.foodItemId, g]))

  return hits.map((h) => {
    const g = statsById.get(h.id)
    return {
      foodItemId: h.id,
      name: h.name,
      per100: {
        kcal: h.kcalPer100,
        protein: h.proteinPer100,
        fat: h.fatPer100,
        carb: h.carbPer100,
      },
      timesUsed: g?._count._all ?? 0,
      lastUsedAt: g?._max.date ? g._max.date.toISOString() : null,
      lastPortionGrams: portionById.get(h.id) ?? 100,
      similarity: h.similarity,
      match: h.match,
    }
  })
}
