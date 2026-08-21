import { defineComponent } from 'vue'

export default defineComponent({
  name: 'ErrorBanner',
  props: {
    message: { type: String, required: true },
  },
  setup(props, { slots }) {
    return () => (
      <div class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-200" role="alert">
        <p>{props.message}</p>
        {slots.default?.()}
      </div>
    )
  },
})
