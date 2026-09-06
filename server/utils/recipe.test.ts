import { describe, expect, it } from 'vitest'
import { macrosForPortion, parseRecipeJson, toRecipeResponse } from './recipe'

describe('parseRecipeJson', () => {
  it('приймає валідний рецепт', () => {
    const details = parseRecipeJson({
      ingredients: [{ name: 'Борошно', amount: '200 г' }],
      steps: ['Замісити тісто'],
      tips: 'Не перемішувати',
    })
    expect(details?.ingredients[0]?.name).toBe('Борошно')
    expect(details?.steps).toEqual(['Замісити тісто'])
  })

  it('відхиляє порожні інгредієнти', () => {
    expect(parseRecipeJson({ ingredients: [], steps: [], tips: '' })).toBeNull()
    expect(parseRecipeJson(null)).toBeNull()
    expect(parseRecipeJson({ foo: 1 })).toBeNull()
  })
})

describe('toRecipeResponse', () => {
  it('мапить рядок MenuDish у DTO', () => {
    const dto = toRecipeResponse({
      id: 'd1',
      name: 'Сирники',
      slot: 'BREAKFAST',
      portionGrams: 150,
      kcal: 330,
      protein: 18,
      fat: 12,
      carb: 36,
      detailsJson: {
        ingredients: [{ name: 'Сир', amount: '300 г' }],
        steps: ['Сформувати'],
        tips: '',
      },
      foodItemId: null,
      updatedAt: new Date('2026-09-06T12:00:00.000Z'),
    })
    expect(dto.id).toBe('d1')
    expect(dto.portionGrams).toBe(150)
    expect(dto.hasRecipe).toBe(true)
    expect(dto.details?.ingredients[0]?.name).toBe('Сир')
  })
})

describe('macrosForPortion', () => {
  it('масштабує поживність з базової порції', () => {
    expect(
      macrosForPortion({ portionGrams: 200, kcal: 400, protein: 20, fat: 10, carb: 40 }, 100),
    ).toEqual({
      kcal: 200,
      protein: 10,
      fat: 5,
      carb: 20,
    })
  })
})
