import { defineComponent } from 'vue'

export default defineComponent({
  name: 'LoadingState',
  props: {
    message: { type: String, default: 'Завантаження…' },
  },
  setup(props) {
    return () => (
      <div class="flex items-center justify-center gap-2 py-8 text-sm text-gray-600" role="status" aria-live="polite">
        <svg
          class="h-5 w-5 animate-spin text-brand-600"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <span>{props.message}</span>
      </div>
    )
  },
})
