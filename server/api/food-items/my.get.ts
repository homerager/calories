import { getQuery } from 'h3'
import { getUserDishes } from '../../utils/myDishes'
import { searchUserDishes } from '../../utils/foodSearch'

// Особиста база «Мої страви»: страви, що вже були у прийомах їжі користувача.
// ?q= — гібридний (лексика + семантика) пошук серед них.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const q = getQuery(event)
  const rawLimit = Number(q.limit)
  const take = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), 100) : 30
  const term = typeof q.q === 'string' ? q.q.trim() : ''

  if (term.length >= 2) {
    assertRateLimit(event, {
      prefix: 'food-items/my-search',
      key: user.id,
      limit: 60,
      windowMs: 60_000,
    })
    const items = await searchUserDishes(user.id, term, take)
    return { items }
  }

  const items = await getUserDishes(user.id, take)
  return { items }
})
