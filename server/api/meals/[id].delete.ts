import { getRouterParam } from 'h3'
import { prisma } from '../../utils/prisma'
import { getDailyTotals, recomputeDailyAggregate, startOfDay } from '../../utils/aggregates'

// Видаляє запис прийому їжі користувача та перераховує денний агрегат.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'Не вказано id запису' })
  }

  const entry = await prisma.mealEntry.findUnique({
    where: { id },
    select: { id: true, userId: true, date: true },
  })

  // 404 і для чужого запису, щоб не розкривати його існування.
  if (!entry || entry.userId !== user.id) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Запис не знайдено' })
  }

  const dayStart = startOfDay(entry.date)

  await prisma.$transaction(async (tx) => {
    await tx.mealEntry.delete({ where: { id } })
    await recomputeDailyAggregate(user.id, dayStart, tx)
  })

  const totals = await getDailyTotals(user.id, dayStart)
  return { ok: true, date: dayStart.toISOString().slice(0, 10), totals }
})
