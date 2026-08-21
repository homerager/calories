import {
  MIN_SEMANTIC_SIMILARITY,
  lexicalScore,
} from './vector'

// Чисте ранжування гібридного пошуку страв (без Prisma / мережі).

export type FoodMatchKind = 'exact' | 'lexical' | 'semantic'

export interface FoodCatalogRow {
  id: string
  name: string
  kcalPer100: number
  proteinPer100: number
  fatPer100: number
  carbPer100: number
}

export interface FoodSearchHit extends FoodCatalogRow {
  similarity: number | null
  match: FoodMatchKind
}

interface RankedHit extends FoodSearchHit {
  score: number
}

interface SemanticRow extends FoodCatalogRow {
  similarity: number
}

/**
 * Зливає лексичні та семантичні кандидати, ранжує й обрізає до `take`.
 */
export function rankFoodSearchHits(params: {
  query: string
  lexical: FoodCatalogRow[]
  semantic: SemanticRow[]
  take: number
  minSemanticSimilarity?: number
}): FoodSearchHit[] {
  const q = params.query.trim().toLowerCase()
  const minSem = params.minSemanticSimilarity ?? MIN_SEMANTIC_SIMILARITY
  const byId = new Map<string, RankedHit>()

  const upsert = (row: FoodCatalogRow, similarity: number | null) => {
    const lex = lexicalScore(row.name, q)
    const sim = similarity ?? 0
    const score = Math.max(lex, sim)
    const match: FoodMatchKind = lex >= 1 ? 'exact' : lex > 0 ? 'lexical' : 'semantic'
    const existing = byId.get(row.id)
    if (!existing) {
      byId.set(row.id, { ...row, similarity, match, score })
      return
    }
    if (score > existing.score) {
      existing.score = score
      existing.match = match
    }
    if (similarity != null && (existing.similarity == null || similarity > existing.similarity)) {
      existing.similarity = similarity
    }
  }

  for (const row of params.lexical) upsert(row, null)
  for (const row of params.semantic) {
    if (row.similarity < minSem && !byId.has(row.id)) continue
    upsert(row, row.similarity)
  }

  return [...byId.values()]
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'uk'))
    .slice(0, params.take)
    .map(({ score: _score, ...hit }) => hit)
}
