import { prisma } from '../utils/prisma'
import { menuDishSelect, toRecipeListItem } from '../utils/recipe'

// Глобальний каталог страв (з тижневих меню).

export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const rows = await prisma.menuDish.findMany({
    orderBy: { name: 'asc' },
    select: menuDishSelect,
  })

  return { items: rows.map(toRecipeListItem) }
})
