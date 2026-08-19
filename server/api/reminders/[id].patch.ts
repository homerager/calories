import { getRouterParam } from 'h3'
import { reminderUpdateSchema } from '../../utils/reminderSchemas'
import { prisma } from '../../utils/prisma'
import { toReminderResponse } from '../../utils/reminderResponse'

// Редагування нагадування (у т.ч. перемикання enabled).
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  assertRateLimit(event, {
    prefix: 'reminders/patch',
    key: user.id,
    limit: 60,
    windowMs: 60_000,
  })

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'Не вказано id нагадування' })
  }

  const existing = await prisma.reminder.findUnique({
    where: { id },
    select: { id: true, userId: true },
  })

  // 404 і для чужого запису, щоб не розкривати його існування.
  if (!existing || existing.userId !== user.id) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Нагадування не знайдено' })
  }

  const body = await readValidatedBody(event, (b) => reminderUpdateSchema.safeParse(b))
  if (!body.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: body.error.issues[0]?.message ?? 'Некоректні дані нагадування',
    })
  }

  const data = body.data
  const reminder = await prisma.reminder.update({
    where: { id },
    data: {
      ...(data.kind !== undefined ? { kind: data.kind } : {}),
      ...(data.message !== undefined ? { message: data.message ?? null } : {}),
      ...(data.timeOfDay !== undefined ? { timeOfDay: data.timeOfDay } : {}),
      ...(data.daysOfWeek !== undefined ? { daysOfWeek: data.daysOfWeek } : {}),
      ...(data.enabled !== undefined ? { enabled: data.enabled } : {}),
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
