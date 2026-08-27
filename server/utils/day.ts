import { DATE_RE } from './foodSchemas'

// Календарні доби без залежності від TZ процесу Node.
//
// MealEntry / DailyAggregate / MenuPlan зберігають «дату» як UTC-північ
// відповідного YYYY-MM-DD (date-as-UTC-midnight). Вода, вправи, «сьогодні»
// на сервері — у IANA-зоні застосунку (NUXT_REMINDERS_TIMEZONE).

const DEFAULT_TZ = 'Europe/Kyiv'

/** IANA-зона журналу/статистики/нагадувань. */
export function appTimezone(): string {
  const raw = process.env.NUXT_REMINDERS_TIMEZONE?.trim()
  return raw || DEFAULT_TZ
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** YYYY-MM-DD з UTC-компонентів (для збережених calendar DateTime). */
export function dayKeyFromStored(date: Date): string {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`
}

/** YYYY-MM-DD моменту в IANA-зоні. */
export function calendarKeyInZone(date: Date, timeZone = appTimezone()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const y = parts.find((p) => p.type === 'year')?.value ?? '1970'
  const m = parts.find((p) => p.type === 'month')?.value ?? '01'
  const d = parts.find((p) => p.type === 'day')?.value ?? '01'
  return `${y}-${m}-${d}`
}

export function todayKey(now = new Date(), timeZone = appTimezone()): string {
  return calendarKeyInZone(now, timeZone)
}

export function isDateKey(value: unknown): value is string {
  return typeof value === 'string' && DATE_RE.test(value)
}

/** UTC-північ календарного дня YYYY-MM-DD. */
export function dayStartFromKey(key: string): Date {
  if (!DATE_RE.test(key)) {
    throw new Error(`Некоректна дата (очікується YYYY-MM-DD): ${key}`)
  }
  return new Date(`${key}T00:00:00.000Z`)
}

/** Нормалізує збережений DateTime до UTC-півночі його UTC-дати. */
export function asDayStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

/** Наступна доба після UTC-півночі календарного дня. */
export function nextDayStart(date: Date): Date {
  const d = asDayStart(date)
  d.setUTCDate(d.getUTCDate() + 1)
  return d
}

export function addDaysToKey(key: string, delta: number): string {
  const d = dayStartFromKey(key)
  d.setUTCDate(d.getUTCDate() + delta)
  return dayKeyFromStored(d)
}

/** Понеділок тижня (UTC-північ) для ключа YYYY-MM-DD. */
export function startOfWeekFromKey(key: string): Date {
  const d = dayStartFromKey(key)
  const mondayOffset = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - mondayOffset)
  return d
}

/**
 * UTC-північ дня з клієнтського YYYY-MM-DD або «сьогодні» в зоні застосунку.
 */
export function resolveDayStart(dateStr?: string | null, now = new Date()): Date {
  if (isDateKey(dateStr)) return dayStartFromKey(dateStr)
  return dayStartFromKey(todayKey(now))
}

function firstInstantOfDay(key: string, timeZone: string): number {
  const utcGuess = Date.parse(`${key}T00:00:00.000Z`)
  let lo = utcGuess - 36 * 3600_000
  let hi = utcGuess + 36 * 3600_000
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2)
    if (calendarKeyInZone(new Date(mid), timeZone) >= key) hi = mid
    else lo = mid + 1
  }
  return lo
}

/** Інтервал [start, end) календарного дня в IANA-зоні (для timestamp-полів). */
export function zonedDayBounds(
  key: string,
  timeZone = appTimezone(),
): { start: Date; end: Date } {
  if (!DATE_RE.test(key)) {
    throw new Error(`Некоректна дата (очікується YYYY-MM-DD): ${key}`)
  }
  const startMs = firstInstantOfDay(key, timeZone)
  const endMs = firstInstantOfDay(addDaysToKey(key, 1), timeZone)
  return { start: new Date(startMs), end: new Date(endMs) }
}

/**
 * Момент для нового запису води/вправи/ваги:
 * сьогодні (або дата не задана) — now; інший день — середина тієї доби в зоні.
 */
export function instantForDay(
  dateStr: string | undefined | null,
  now = new Date(),
  timeZone = appTimezone(),
): Date {
  const today = todayKey(now, timeZone)
  const key = isDateKey(dateStr) ? dateStr : today
  if (key === today) return now
  const { start, end } = zonedDayBounds(key, timeZone)
  return new Date(Math.floor((start.getTime() + end.getTime()) / 2))
}

export function resolveZonedDayBounds(
  dateStr?: string | null,
  now = new Date(),
  timeZone = appTimezone(),
): { key: string; start: Date; end: Date } {
  const key = isDateKey(dateStr) ? dateStr : todayKey(now, timeZone)
  const { start, end } = zonedDayBounds(key, timeZone)
  return { key, start, end }
}
