import { describe, expect, it } from 'vitest'
import {
  EMBEDDING_DIMENSIONS,
  cosineSimilarity,
  lexicalScore,
  toVectorLiteral,
} from './vector'
import { rankFoodSearchHits } from './foodSearchRank'

function pad(values: number[]): number[] {
  const out = values.slice()
  while (out.length < EMBEDDING_DIMENSIONS) out.push(0)
  return out.slice(0, EMBEDDING_DIMENSIONS)
}

describe('toVectorLiteral', () => {
  it('серіалізує валідний вектор', () => {
    const v = pad([0.1, -2, 3.5])
    const literal = toVectorLiteral(v)
    expect(literal.startsWith('[')).toBe(true)
    expect(literal.endsWith(']')).toBe(true)
    expect(literal).toContain('0.1')
    expect(literal).toContain('-2')
  })

  it('кидає на хибній довжині', () => {
    expect(() => toVectorLiteral([1, 2, 3])).toThrow(/довжини/)
  })

  it('кидає на NaN/Infinity', () => {
    const v = pad([])
    v[0] = Number.NaN
    expect(() => toVectorLiteral(v)).toThrow(/нечислове/)
    v[0] = Infinity
    expect(() => toVectorLiteral(v)).toThrow(/нечислове/)
  })
})

describe('cosineSimilarity', () => {
  it('повертає 1 для однакових векторів', () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1)
  })

  it('повертає 0 для ортогональних', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0)
  })

  it('повертає 0 для різної довжини', () => {
    expect(cosineSimilarity([1], [1, 0])).toBe(0)
  })
})

describe('lexicalScore', () => {
  it('точний збіг (без урахування регістру)', () => {
    expect(lexicalScore('Гречка', 'гречка')).toBe(1)
  })

  it('префікс вищий за підрядок', () => {
    expect(lexicalScore('Гречка варена', 'греч')).toBeGreaterThan(lexicalScore('Варена гречка', 'греч'))
  })

  it('немає збігу → 0', () => {
    expect(lexicalScore('Яблуко', 'гречка')).toBe(0)
  })
})

describe('rankFoodSearchHits', () => {
  const buckwheat = {
    id: '1',
    name: 'Гречка (варена)',
    kcalPer100: 92,
    proteinPer100: 3.4,
    fatPer100: 0.6,
    carbPer100: 20,
  }
  const chicken = {
    id: '2',
    name: 'Куряче філе (варене)',
    kcalPer100: 165,
    proteinPer100: 31,
    fatPer100: 3.6,
    carbPer100: 0,
  }
  const porridge = {
    id: '3',
    name: 'Каша гречана з маслом',
    kcalPer100: 140,
    proteinPer100: 4,
    fatPer100: 6,
    carbPer100: 18,
  }

  it('ставить точний/лексичний збіг вище за слабку семантику', () => {
    const ranked = rankFoodSearchHits({
      query: 'гречка',
      lexical: [buckwheat],
      semantic: [{ ...chicken, similarity: 0.5 }],
      take: 10,
    })
    expect(ranked[0]?.id).toBe('1')
    expect(ranked[0]?.match).toBe('lexical')
  })

  it('підмішує семантичні збіги, яких немає в лексиці', () => {
    const ranked = rankFoodSearchHits({
      query: 'гречана каша',
      lexical: [],
      semantic: [{ ...porridge, similarity: 0.81 }],
      take: 10,
    })
    expect(ranked).toHaveLength(1)
    expect(ranked[0]?.id).toBe('3')
    expect(ranked[0]?.match).toBe('semantic')
    expect(ranked[0]?.similarity).toBeCloseTo(0.81)
  })

  it('відкидає слабкі суто семантичні збіги', () => {
    const ranked = rankFoodSearchHits({
      query: 'суп',
      lexical: [],
      semantic: [{ ...chicken, similarity: 0.2 }],
      take: 10,
    })
    expect(ranked).toHaveLength(0)
  })

  it('деdup за id і зберігає similarity', () => {
    const ranked = rankFoodSearchHits({
      query: 'гречка',
      lexical: [buckwheat],
      semantic: [{ ...buckwheat, similarity: 0.94 }],
      take: 10,
    })
    expect(ranked).toHaveLength(1)
    expect(ranked[0]?.similarity).toBeCloseTo(0.94)
    expect(ranked[0]?.match).toBe('lexical')
  })
})
