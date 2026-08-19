import { reminderCreateSchema } from '../utils/reminderSchemas'
import { prisma } from '../utils/prisma'
import { toReminderResponse } from '../utils/reminderResponse'

// Створює нагадування.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  assertRateLimit(event, {
    prefix: 'reminders/post',
    key: user.id,
    limit: 60,
    windowMs: 60_000,
  })

  const body = await readValidatedBody(event, (b) => reminderCreateSchema.safeParse(b))
  if (!body.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: body.error.issues[0]?.message ?? 'Некоректні дані нагадування',
    })
  }

  const data = body.data
  const reminder = await prisma.reminder.create({
    data: {
      userId: user.id,
      kind: data.kind,
      message: data.message ?? null,
      timeOfDay: data.timeOfDay,
      daysOfWeek: data.daysOfWeek,
      enabled: data.enabled,
    },
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

  return { reminder: toReminderResponse(reminder) }
})
