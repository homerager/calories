import { defineComponent, reactive, ref, Teleport } from 'vue'

// Назва страви з обрізанням (truncate) і popover повної назви при наведенні,
// що показується лише якщо текст реально не вміщається. Popover телепортується
// у body з fixed-позиціонуванням, щоб не обрізатись контейнерами з overflow.
export default defineComponent({
  name: 'DishName',
  inheritAttrs: false,
  props: {
    text: { type: String, required: true },
    spanClass: { type: [String, Array, Object], default: '' },
  },
  emits: ['click'],
  setup(props, { emit }) {
    const elRef = ref<HTMLElement | null>(null)
    const show = ref(false)
    const pos = reactive({ x: 0, y: 0 })

    function maybeShow() {
      const el = elRef.value
      if (!el) return
      // Показуємо popover лише коли текст обрізано.
      if (el.scrollWidth > el.clientWidth + 1) {
        const r = el.getBoundingClientRect()
        pos.x = r.left
        pos.y = r.top - 6
        show.value = true
      }
    }

    function hide() {
      show.value = false
    }

    return () => (
      <>
        <span
          ref={elRef}
          class={['block truncate', props.spanClass]}
          title={props.text}
          onMouseenter={maybeShow}
          onMouseleave={hide}
          onClick={() => emit('click')}
        >
          {props.text}
        </span>
        {show.value ? (
          <Teleport to="body">
            <div
              class="pointer-events-none fixed z-50 max-w-xs -translate-y-full whitespace-normal break-words rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg"
              style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
            >
              {props.text}
            </div>
          </Teleport>
        ) : null}
      </>
    )
  },
})
