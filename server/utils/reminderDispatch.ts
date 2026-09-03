import { prisma } from './prisma'
import { sendPushToUser } from './webPush'
import { sendFcmToUser } from './fcmPush'
import type { ReminderKind } from '../../prisma/generated/client/enums'

// Дефолтні підписи, коли нагадування не має власного тексту (message).
const KIND_DEFAULT_TITLES: Record<ReminderKind, string> = {
  MEAL: 'Час поїсти',
  WATER: 'Час випити води',
  WEIGH_IN: 'Час зважитись',
  CUSTOM: 'Нагадування',
}

// Мапа скорочених англ. назв днів тижня (Intl, локаль en-GB) → JS Date#getDay() (0=Нд..6=Сб).
const WEEKDAY_TO_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

// Нагадування вважаємо вже відправленим, якщо lastSentAt новіший за це вікно —
// захист від подвійного спрацювання планувальника в межах тієї самої хвилини.
const DEDUP_WINDOW_MS = 55 * 60_000

function currentTimeParts(timezone: string, now: Date): { hhmm: string; dayOfWeek: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(now)

  const hour = parts.find((p) => p.type === 'hour')?.value ?? '00'
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00'
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Sun'

  return { hhmm: `${hour}:${minute}`, dayOfWeek: WEEKDAY_TO_INDEX[weekday] ?? 0 }
}

/** Перевіряє всі увімкнені нагадування й розсилає ті, для яких настав час. */
export async function dispatchDueReminders(now: Date = new Date()): Promise<void> {
  const config = useRuntimeConfig()
  const timezone = config.reminders.timezone
  const { hhmm, dayOfWeek } = currentTimeParts(timezone, now)

  const due = await prisma.reminder.findMany({
    where: { enabled: true, timeOfDay: hhmm },
  })

  for (const reminder of due) {
    if (reminder.daysOfWeek.length > 0 && !reminder.daysOfWeek.includes(dayOfWeek)) continue
    if (reminder.lastSentAt && now.getTime() - reminder.lastSentAt.getTime() < DEDUP_WINDOW_MS) continue

    // Атомарно "застовбовуємо" нагадування за попереднім значенням lastSentAt: якщо інший
    // паралельний тік (інший процес чи overlap) уже забрав його — updateMany поверне 0, пропускаємо.
    const claimed = await prisma.reminder.updateMany({
      where: { id: reminder.id, lastSentAt: reminder.lastSentAt },
      data: { lastSentAt: now },
    })
    if (claimed.count === 0) continue

    const title = KIND_DEFAULT_TITLES[reminder.kind]
    const body = reminder.message ?? null

    await prisma.notification.create({
      data: { userId: reminder.userId, reminderId: reminder.id, title, body },
    })

    await sendPushToUser(reminder.userId, { title, body })
    await sendFcmToUser(reminder.userId, { title, body })
  }
}
