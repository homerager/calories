import { describe, expect, it } from 'vitest'
import {
  changePasswordSchema,
  credentialsSchema,
  deleteAccountSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './authSchemas'

describe('credentialsSchema', () => {
  it('приймає валідний email+пароль і нормалізує email', () => {
    const r = credentialsSchema.safeParse({ email: '  User@Ex.COM ', password: 'abcdefgh' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.email).toBe('user@ex.com')
  })

  it('відхиляє короткий пароль', () => {
    const r = credentialsSchema.safeParse({ email: 'a@b.co', password: 'short' })
    expect(r.success).toBe(false)
  })
})

describe('deleteAccountSchema', () => {
  it('вимагає рівно DELETE', () => {
    expect(deleteAccountSchema.safeParse({ confirm: 'DELETE' }).success).toBe(true)
    expect(deleteAccountSchema.safeParse({ confirm: 'delete' }).success).toBe(false)
  })
})

describe('forgot / reset / change', () => {
  it('forgot потребує email', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'not-an-email' }).success).toBe(false)
    expect(forgotPasswordSchema.safeParse({ email: 'a@b.co' }).success).toBe(true)
  })

  it('reset потребує токен і довгий пароль', () => {
    expect(resetPasswordSchema.safeParse({ token: 'abc', password: 'abcdefgh' }).success).toBe(false)
    expect(
      resetPasswordSchema.safeParse({ token: '1234567890ab', password: 'abcdefgh' }).success,
    ).toBe(true)
  })

  it('change password потребує новий пароль ≥ 8', () => {
    expect(changePasswordSchema.safeParse({ newPassword: '123' }).success).toBe(false)
    expect(changePasswordSchema.safeParse({ newPassword: '12345678' }).success).toBe(true)
  })
})
