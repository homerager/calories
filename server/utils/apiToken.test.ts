import { describe, expect, it } from 'vitest'
import { hashApiToken, newApiToken } from './apiToken'

describe('newApiToken', () => {
  it('має префікс cal_ і достатню довжину', () => {
    const t = newApiToken()
    expect(t.startsWith('cal_')).toBe(true)
    // 32 байти у base64url — 43 символи + префікс.
    expect(t.length).toBe('cal_'.length + 43)
  })

  it('щоразу різний', () => {
    const seen = new Set(Array.from({ length: 50 }, () => newApiToken()))
    expect(seen.size).toBe(50)
  })
})

describe('hashApiToken', () => {
  it('детермінований SHA-256 hex (64 символи)', () => {
    const h1 = hashApiToken('cal_example')
    const h2 = hashApiToken('cal_example')
    expect(h1).toBe(h2)
    expect(h1).toMatch(/^[0-9a-f]{64}$/)
  })

  it('різні токени → різні хеші', () => {
    expect(hashApiToken('cal_a')).not.toBe(hashApiToken('cal_b'))
  })

  it('не містить сирого токена', () => {
    const token = newApiToken()
    expect(hashApiToken(token)).not.toContain(token)
  })
})
