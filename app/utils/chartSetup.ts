import {
  Chart,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  BarController,
  LineController,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js'

// Реєстрація тільки потрібних елементів Chart.js (замість 'chart.js/auto'),
// щоб не тягнути зайве у бандл. Побічний ефект імпорту — безпечний під час SSR
// (Chart.register нічого не чіпає в DOM), сам canvas малюється лише на клієнті.
Chart.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  BarController,
  LineController,
  Filler,
  Tooltip,
  Legend,
)
