import { defineComponent, computed, type PropType } from 'vue'
import { Line } from 'vue-chartjs'
import type { ChartData, ChartOptions } from 'chart.js'
import '~/utils/chartSetup'
import type { WeightPoint } from '../composables/useProfile'

// Інтерактивний графік динаміки ваги на Chart.js (тултіпи, наведення, легкий зум за замовчуванням).

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' })
}

export default defineComponent({
  name: 'WeightChart',
  props: {
    points: {
      type: Array as PropType<WeightPoint[]>,
      required: true,
    },
  },
  setup(props) {
    const chartData = computed<ChartData<'line', number[], string>>(() => ({
      labels: props.points.map((p) => formatDate(p.measuredAt)),
      datasets: [
        {
          label: 'Вага',
          data: props.points.map((p) => p.weightKg),
          borderColor: '#2c6f2c',
          backgroundColor: 'rgba(58, 141, 58, 0.12)',
          pointBackgroundColor: '#2c6f2c',
          pointBorderColor: '#fff',
          pointRadius: 3,
          pointHoverRadius: 5,
          borderWidth: 2,
          tension: 0.3,
          fill: true,
        },
      ],
    }))

    const chartOptions = computed<ChartOptions<'line'>>(() => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.formattedValue} кг`,
          },
        },
      },
      scales: {
        y: {
          ticks: { callback: (v) => `${v} кг` },
          grid: { color: '#e2e8f0' },
        },
        x: {
          grid: { display: false },
        },
      },
    }))

    return () => {
      if (props.points.length === 0) {
        return (
          <div class="flex h-64 items-center justify-center rounded-xl border border-dashed border-gray-200 text-sm text-gray-400">
            Ще немає записів ваги — додайте перше зважування.
          </div>
        )
      }

      return (
        <div class="h-64">
          <Line data={chartData.value} options={chartOptions.value} />
        </div>
      )
    }
  },
})
