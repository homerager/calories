import { z } from 'zod'

// Спільні схеми валідації для email+пароль автентифікації.

export const credentialsSchema = z.object({
  email: z
    .string({ message: 'Вкажіть email' })
    .trim()
    .toLowerCase()
    .email('Некоректний email'),
  password: z
    .string({ message: 'Вкажіть пароль' })
    .min(8, 'Пароль має містити щонайменше 8 символів')
    .max(200, 'Пароль задовгий'),
})

export type Credentials = z.infer<typeof credentialsSchema>

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Вкажіть поточний пароль').max(200).optional(),
  newPassword: z
    .string({ message: 'Вкажіть новий пароль' })
    .min(8, 'Пароль має містити щонайменше 8 символів')
    .max(200, 'Пароль задовгий'),
})

export const forgotPasswordSchema = z.object({
  email: z.string({ message: 'Вкажіть email' }).trim().toLowerCase().email('Некоректний email'),
})

export const resetPasswordSchema = z.object({
  token: z.string().min(10, 'Некоректне посилання').max(200),
  password: z
    .string({ message: 'Вкажіть новий пароль' })
    .min(8, 'Пароль має містити щонайменше 8 символів')
    .max(200, 'Пароль задовгий'),
})

export const deleteAccountSchema = z.object({
  confirm: z.string().refine((v) => v === 'DELETE', { message: 'Введіть DELETE для підтвердження' }),
  password: z.string().min(1).max(200).optional(),
})
