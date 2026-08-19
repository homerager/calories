import { z } from 'zod'

// Схеми валідації для Web Push підписок.

export const pushSubscribeSchema = z.object({
  endpoint: z.string().url('Некоректний endpoint підписки'),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
})

export type PushSubscribeInput = z.infer<typeof pushSubscribeSchema>

export const pushUnsubscribeSchema = z.object({
  endpoint: z.string().url('Некоректний endpoint підписки'),
})

export type PushUnsubscribeInput = z.infer<typeof pushUnsubscribeSchema>
