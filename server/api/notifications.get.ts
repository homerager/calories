import { prisma } from '../utils/prisma'

// Останні сповіщення користувача + кількість непрочитаних.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { id: true, title: true, body: true, createdAt: true, readAt: true },
    }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
  ])

  return {
    notifications: items.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      createdAt: n.createdAt.toISOString(),
      readAt: n.readAt ? n.readAt.toISOString() : null,
    })),
    unreadCount,
  }
})
