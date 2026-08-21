import { getQuery } from 'h3'
import { searchFoodItems } from '../../utils/foodSearch'

// Пошук у довіднику страв: лексика + семантика (pgvector), якщо є embeddings.
// ?q=назва&limit=20  Повертає поживність на 100 г і тип збігу.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  assertRateLimit(event, {
    prefix: 'food-items/search',
    key: user.id,
    limit: 60,
    windowMs: 60_000,
  })

  const q = getQuery(event)
  const term = typeof q.q === 'string' ? q.q.trim() : ''
  if (term.length < 2) {
    return { items: [] }
  }

  const rawLimit = Number(q.limit)
  const take = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), 50) : 20

  const items = await searchFoodItems({ query: term, take, userId: user.id })
  return { items }
})
