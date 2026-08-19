import { getQuery } from 'h3'
import { getUserDishes } from '../../utils/myDishes'

// Особиста база «Мої страви»: страви, що вже були у прийомах їжі користувача.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const q = getQuery(event)
  const rawLimit = Number(q.limit)
  const take = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), 100) : 30

  const items = await getUserDishes(user.id, take)
  return { items }
})
