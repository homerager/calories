import { describe, expect, it } from 'vitest'
import { ageFromBirthDate, calcBMR, calcNorms } from './mifflin'

describe('calcBMR', () => {
  it('Міффлін для чоловіка', () => {
    // 10*80 + 6.25*180 - 5*30 + 5 = 800+1125-150+5 = 1780
    expect(calcBMR('MALE', 80, 180, 30)).toBe(1780)
  })

  it('Міффлін для жінки', () => {
    expect(calcBMR('FEMALE', 60, 165, 28)).toBe(10 * 60 + 6.25 * 165 - 5 * 28 - 161)
  })
})

describe('calcNorms', () => {
  it('підтримка: TDEE без корекції, макро 30/25/45', () => {
    const r = calcNorms({
      sex: 'MALE',
      age: 30,
      heightCm: 180,
      weightKg: 80,
      activityLevel: 'SEDENTARY',
      goal: 'MAINTAIN',
    })
    expect(r.bmr).toBe(1780)
    expect(r.tdee).toBe(Math.round(1780 * 1.2))
    expect(r.dailyKcal).toBe(r.tdee)
    expect(r.proteinGrams + r.fatGrams + r.carbGrams).toBeGreaterThan(0)
  })

  it('схуднення знімає 15% від TDEE', () => {
    const maintain = calcNorms({
      sex: 'FEMALE',
      age: 25,
      heightCm: 165,
      weightKg: 60,
      activityLevel: 'LIGHT',
      goal: 'MAINTAIN',
    })
    const lose = calcNorms({
      sex: 'FEMALE',
      age: 25,
      heightCm: 165,
      weightKg: 60,
      activityLevel: 'LIGHT',
      goal: 'LOSE',
    })
    expect(lose.dailyKcal).toBeLessThan(maintain.dailyKcal)
    const ratio = lose.dailyKcal / maintain.tdee
    expect(ratio).toBeGreaterThan(0.84)
    expect(ratio).toBeLessThan(0.86)
  })
})

describe('ageFromBirthDate', () => {
  it('рахує повні роки за UTC-календарем', () => {
    const birth = new Date('1990-06-15T00:00:00.000Z')
    expect(ageFromBirthDate(birth, new Date('2026-06-15T00:00:00.000Z'))).toBe(36)
    expect(ageFromBirthDate(birth, new Date('2026-06-14T00:00:00.000Z'))).toBe(35)
  })
})
