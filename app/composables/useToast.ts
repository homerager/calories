import { ref } from 'vue'

export type ToastKind = 'success' | 'error' | 'info'

export interface ToastItem {
  id: number
  kind: ToastKind
  message: string
}

const toasts = ref<ToastItem[]>([])
let nextId = 1
const timers = new Map<number, ReturnType<typeof setTimeout>>()

const DEFAULT_TIMEOUT: Record<ToastKind, number> = {
  success: 3500,
  info: 4000,
  error: 6000,
}

function dismiss(id: number) {
  const timer = timers.get(id)
  if (timer) {
    clearTimeout(timer)
    timers.delete(id)
  }
  toasts.value = toasts.value.filter((t) => t.id !== id)
}

function show(message: string, kind: ToastKind = 'info', timeoutMs?: number) {
  const id = nextId++
  toasts.value = [...toasts.value, { id, kind, message }]
  const ms = timeoutMs ?? DEFAULT_TIMEOUT[kind]
  if (ms > 0) {
    timers.set(
      id,
      setTimeout(() => dismiss(id), ms),
    )
  }
}

export function useToast() {
  return {
    toasts,
    show,
    success: (message: string) => show(message, 'success'),
    error: (message: string) => show(message, 'error'),
    info: (message: string) => show(message, 'info'),
    dismiss,
  }
}
