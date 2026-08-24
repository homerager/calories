import { defineComponent, computed, type PropType } from 'vue'
import type { StatsDay } from '../composables/useStats'

// Легкий SVG-графік добового споживання води за період (без зовнішніх залежностей).
// Стовпчики — мілілітри за день; пунктирна лінія — денна ціль.

const VIEW_W = 640
const VIEW_H = 240
const PAD = { top: 16, right: 16, bottom: 28, left: 44 }

function formatDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00.000Z`)
  return d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' })
}

export default defineComponent({
  name: 'WaterChart',
  props: {
    days: {
      type: Array as PropType<StatsDay[]>,
      required: true,
    },
    goalMl: {
      type: Number as PropType<number | null>,
      default: null,
    },
  },
  setup(props) {
    const plotW = VIEW_W - PAD.left - PAD.right
    const plotH = VIEW_H - PAD.top - PAD.bottom

    const model = computed(() => {
      const days = props.days
      if (days.length === 0) return null

      const maxMl = Math.max(...days.map((d) => d.waterMl), props.goalMl ?? 0, 1)
      const top = maxMl * 1.1
      const scaleY = (v: number) => PAD.top + (1 - v / top) * plotH

      const slot = plotW / days.length
      const barW = Math.max(2, Math.min(48, slot * 0.6))

      const bars = days.map((d, i) => {
        const cx = PAD.left + slot * i + slot / 2
        const y = scaleY(d.waterMl)
        const h = PAD.top + plotH - y
        return { day: d, cx, x: cx - barW / 2, y, h, index: i }
      })

      const goalY = props.goalMl != null && props.goalMl > 0 ? scaleY(props.goalMl) : null

      return { bars, barW, goalY, top }
    })

    return () => {
      const m = model.value
      if (!m) {
        return (
          <div class="flex h-48 items-center justify-center rounded-xl border border-dashed border-gray-200 text-sm text-gray-400">
            Ще немає даних за цей період.
          </div>
        )
      }

      const showEveryLabel = m.bars.length <= 10
      const midValue = m.top / 2

      return (
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          class="h-auto w-full"
          role="img"
          aria-label="Графік вживання води"
        >
          {/* Сітка + підписи мілілітрів */}
          {[m.top, midValue, 0].map((v, i) => {
            const y = PAD.top + (plotH / 2) * i
            return (
              <g key={`grid-${i}`}>
                <line
                  x1={PAD.left}
                  y1={y}
                  x2={VIEW_W - PAD.right}
                  y2={y}
                  stroke="#f1f5f9"
                  stroke-width="1"
                />
                <text x={PAD.left - 6} y={y + 4} text-anchor="end" class="fill-gray-400 text-[11px]">
                  {Math.round(v)}
                </text>
              </g>
            )
          })}

          {/* Стовпчики */}
          {m.bars.map((b) => (
            <g key={b.day.date}>
              <rect
                x={b.x}
                y={b.y}
                width={m.barW}
                height={Math.max(0, b.h)}
                rx="3"
                class="fill-sky-400"
              >
                <title>
                  {formatDate(b.day.date)}: {Math.round(b.day.waterMl)} мл
                </title>
              </rect>
              {(showEveryLabel || b.index % Math.ceil(m.bars.length / 8) === 0) && (
                <text
                  x={b.cx}
                  y={VIEW_H - 8}
                  text-anchor="middle"
                  class="fill-gray-400 text-[10px]"
                >
                  {formatDate(b.day.date)}
                </text>
              )}
            </g>
          ))}

          {/* Лінія цілі */}
          {m.goalY != null && (
            <g>
              <line
                x1={PAD.left}
                y1={m.goalY}
                x2={VIEW_W - PAD.right}
                y2={m.goalY}
                stroke="#f59e0b"
                stroke-width="1.5"
                stroke-dasharray="5 4"
              />
              <text
                x={VIEW_W - PAD.right}
                y={m.goalY - 4}
                text-anchor="end"
                class="fill-amber-500 text-[10px]"
              >
                ціль {Math.round(props.goalMl!)}
              </text>
            </g>
          )}
        </svg>
      )
    }
  },
})
