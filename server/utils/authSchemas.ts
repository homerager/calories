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
