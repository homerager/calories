import { prisma } from '../utils/prisma'
import { toReminderResponse } from '../utils/reminderResponse'

// Список нагадувань користувача, відсортований за часом спрацювання.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const reminders = await prisma.reminder.findMany({
    where: { userId: user.id },
    orderBy: { timeOfDay: 'asc' },
    select: {
      id: true,
      kind: true,
      message: true,
      timeOfDay: true,
      daysOfWeek: true,
      enabled: true,
      lastSentAt: true,
      createdAt: true,
    },
  })

  return { reminders: reminders.map(toReminderResponse) }
})
