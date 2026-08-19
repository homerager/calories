import { prisma } from '../../utils/prisma'

// Позначає всі сповіщення користувача прочитаними.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  })

  return { ok: true }
})
