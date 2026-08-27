import { afterEach, describe, expect, it } from 'vitest'
import {
  addDaysToKey,
  asDayStart,
  calendarKeyInZone,
  dayKeyFromStored,
  dayStartFromKey,
  instantForDay,
  nextDayStart,
  resolveDayStart,
  startOfWeekFromKey,
  todayKey,
  zonedDayBounds,
} from './day'

const KYIV = 'Europe/Kyiv'

describe('dayStartFromKey / dayKeyFromStored', () => {
  it('крутить YYYY-MM-DD через UTC-північ без зсуву доби', () => {
    const start = dayStartFromKey('2026-08-27')
    expect(start.toISOString()).toBe('2026-08-27T00:00:00.000Z')
    expect(dayKeyFromStored(start)).toBe('2026-08-27')
  })

  it('nextDayStart додає одну UTC-добу', () => {
    expect(nextDayStart(dayStartFromKey('2026-08-27')).toISOString()).toBe('2026-08-28T00:00:00.000Z')
  })

  it('asDayStart зрізає час до UTC-півночі', () => {
    const noon = new Date('2026-08-27T12:34:56.000Z')
    expect(asDayStart(noon).toISOString()).toBe('2026-08-27T00:00:00.000Z')
  })
})

describe('calendarKeyInZone', () => {
  it('після півночі в Києві це вже наступний календарний день (UTC ще попередній)', () => {
    const justAfterKyivMidnight = new Date('2026-08-26T21:30:00.000Z') // 00:30 Kyiv (UTC+3)
    expect(calendarKeyInZone(justAfterKyivMidnight, KYIV)).toBe('2026-08-27')
    expect(justAfterKyivMidnight.toISOString().slice(0, 10)).toBe('2026-08-26')
  })
})

describe('zonedDayBounds', () => {
  it('покриває літній Київ (UTC+3)', () => {
    const { start, end } = zonedDayBounds('2026-08-27', KYIV)
    expect(start.toISOString()).toBe('2026-08-26T21:00:00.000Z')
    expect(end.toISOString()).toBe('2026-08-27T21:00:00.000Z')
  })

  it('покриває зимовий Київ (UTC+2)', () => {
    const { start, end } = zonedDayBounds('2026-01-15', KYIV)
    expect(start.toISOString()).toBe('2026-01-14T22:00:00.000Z')
    expect(end.toISOString()).toBe('2026-01-15T22:00:00.000Z')
  })
})

describe('resolveDayStart', () => {
  it('бере клієнтський ключ як UTC-північ, ігноруючи TZ процесу', () => {
    expect(resolveDayStart('2026-03-01').toISOString()).toBe('2026-03-01T00:00:00.000Z')
  })
})

describe('startOfWeekFromKey / addDaysToKey', () => {
  it('понеділок тижня для середи', () => {
    expect(dayKeyFromStored(startOfWeekFromKey('2026-08-26'))).toBe('2026-08-24')
  })

  it('зсув ключа', () => {
    expect(addDaysToKey('2026-08-27', -1)).toBe('2026-08-26')
  })
})

describe('instantForDay', () => {
  const now = new Date('2026-08-27T10:00:00.000Z') // 13:00 Kyiv

  it('сьогодні — поточний момент', () => {
    expect(instantForDay(undefined, now, KYIV).getTime()).toBe(now.getTime())
    expect(instantForDay('2026-08-27', now, KYIV).getTime()).toBe(now.getTime())
  })

  it('інший день — всередині тієї доби в зоні', () => {
    const at = instantForDay('2026-08-20', now, KYIV)
    const { start, end } = zonedDayBounds('2026-08-20', KYIV)
    expect(at.getTime()).toBeGreaterThanOrEqual(start.getTime())
    expect(at.getTime()).toBeLessThan(end.getTime())
  })
})

describe('todayKey', () => {
  const prev = process.env.NUXT_REMINDERS_TIMEZONE
  afterEach(() => {
    if (prev === undefined) delete process.env.NUXT_REMINDERS_TIMEZONE
    else process.env.NUXT_REMINDERS_TIMEZONE = prev
  })

  it('читає зону з env', () => {
    process.env.NUXT_REMINDERS_TIMEZONE = 'UTC'
    expect(todayKey(new Date('2026-08-27T00:30:00.000Z'))).toBe('2026-08-27')
  })
})
