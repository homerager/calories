import { prisma } from '../utils/prisma'
import { toMenuPlanResponse } from '../utils/menuResponse'

// Повертає останнє збережене меню користувача (з позиціями), або null.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const plan = await prisma.menuPlan.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    include: { items: { orderBy: [{ dayIndex: 'asc' }] } },
  })

  return { plan: plan ? toMenuPlanResponse(plan) : null }
})
