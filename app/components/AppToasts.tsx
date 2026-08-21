import { defineComponent } from 'vue'
import { useToast, type ToastKind } from '~/composables/useToast'

const KIND_CLASS: Record<ToastKind, string> = {
  success: 'bg-brand-50 text-brand-900 ring-brand-200',
  error: 'bg-red-50 text-red-900 ring-red-200',
  info: 'bg-white text-gray-900 ring-gray-200',
}

const KIND_LABEL: Record<ToastKind, string> = {
  success: 'Успіх',
  error: 'Помилка',
  info: 'Повідомлення',
}

export default defineComponent({
  name: 'AppToasts',
  setup() {
    const { toasts, dismiss } = useToast()

    return () => (
      <div
        class="pointer-events-none fixed inset-x-0 top-0 z-50 flex flex-col items-end gap-2 p-4 sm:inset-x-auto sm:right-4 sm:top-4 sm:w-96"
        aria-live="polite"
        aria-relevant="additions"
      >
        {toasts.value.map((t) => (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            class={`pointer-events-auto flex w-full items-start gap-3 rounded-xl px-4 py-3 text-sm shadow-lg ring-1 ${KIND_CLASS[t.kind]}`}
          >
            <span class="sr-only">{KIND_LABEL[t.kind]}:</span>
            <p class="min-w-0 flex-1">{t.message}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              class="shrink-0 rounded-md p-0.5 opacity-70 transition hover:bg-black/5 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-brand-300"
              aria-label="Закрити сповіщення"
            >
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    )
  },
})
