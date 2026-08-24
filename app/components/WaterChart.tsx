import { defineComponent, computed, type PropType } from 'vue'
import { Bar } from 'vue-chartjs'
import type { ChartData, ChartOptions } from 'chart.js'
import '~/utils/chartSetup'
import type { StatsDay } from '../composables/useStats'

// Інтерактивний графік добового споживання води на Chart.js: стовпчики — мілілітри
// за день, пунктирна лінія — денна ціль.

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
    const chartData = computed(() => {
      const goal = props.goalMl
      const datasets: unknown[] = [
        {
          type: 'bar' as const,
          label: 'Вода',
          data: props.days.map((d) => d.waterMl),
          backgroundColor: '#38bdf8',
          borderRadius: 4,
          maxBarThickness: 40,
        },
      ]
      if (goal != null && goal > 0) {
        datasets.push({
          type: 'line' as const,
          label: 'Ціль',
          data: props.days.map(() => goal),
          borderColor: '#f59e0b',
          borderDash: [5, 4],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
        })
      }

      return {
        labels: props.days.map((d) => formatDate(d.date)),
        datasets,
      } as ChartData<'bar', number[], string>
    })

    const chartOptions = computed<ChartOptions<'bar'>>(() => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: props.goalMl != null && props.goalMl > 0,
          position: 'top',
          labels: { boxWidth: 12, font: { size: 11 } },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${ctx.formattedValue} мл`,
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: (v) => `${v}` },
          grid: { color: '#f1f5f9' },
        },
        x: {
          grid: { display: false },
        },
      },
    }))

    return () => {
      if (props.days.length === 0) {
        return (
          <div class="flex h-64 items-center justify-center rounded-xl border border-dashed border-gray-200 text-sm text-gray-400">
            Ще немає даних за цей період.
          </div>
        )
      }

      return (
        <div class="h-64">
          <Bar data={chartData.value} options={chartOptions.value} />
        </div>
      )
    }
  },
})
