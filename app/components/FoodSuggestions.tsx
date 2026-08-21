import { defineComponent, type PropType } from 'vue'
import type { FoodSearchHit } from '~/composables/useDiary'

const MATCH_LABEL: Record<FoodSearchHit['match'], string> = {
  exact: 'точний збіг',
  lexical: 'за назвою',
  semantic: 'схожа страва',
}

export default defineComponent({
  name: 'FoodSuggestions',
  props: {
    items: { type: Array as PropType<FoodSearchHit[]>, required: true },
    activeIndex: { type: Number, default: -1 },
    listId: { type: String, default: 'food-suggestions' },
  },
  emits: {
    select: (_item: FoodSearchHit) => true,
  },
  setup(props, { emit }) {
    return () => {
      if (props.items.length === 0) return null
      return (
        <ul
          id={props.listId}
          role="listbox"
          class="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
        >
          {props.items.map((item, i) => {
            const active = i === props.activeIndex
            return (
              <li
                id={`${props.listId}-${i}`}
                key={item.id}
                role="option"
                aria-selected={active}
                class={
                  active
                    ? 'flex cursor-pointer items-baseline justify-between gap-3 bg-brand-50 px-3 py-2 text-sm text-brand-900'
                    : 'flex cursor-pointer items-baseline justify-between gap-3 px-3 py-2 text-sm text-gray-900 hover:bg-gray-50'
                }
                onMousedown={(e: MouseEvent) => {
                  e.preventDefault()
                  emit('select', item)
                }}
              >
                <span class="min-w-0 truncate font-medium">{item.name}</span>
                <span class="shrink-0 text-xs text-gray-500">
                  {Math.round(item.kcalPer100)} ккал/100 г
                  {item.match === 'semantic' ? (
                    <span class="ml-2 text-brand-700">{MATCH_LABEL[item.match]}</span>
                  ) : null}
                </span>
              </li>
            )
          })}
        </ul>
      )
    }
  },
})
