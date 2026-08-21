import { defineComponent } from 'vue'

export default defineComponent({
  name: 'EmptyState',
  props: {
    message: { type: String, required: true },
  },
  setup(props, { slots }) {
    return () => (
      <div class="mt-4 rounded-lg bg-gray-50 px-3 py-6 text-center text-sm text-gray-600">
        <p>{props.message}</p>
        {slots.default?.()}
      </div>
    )
  },
})
