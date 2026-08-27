# Calories

Веб-додаток для підрахунку калорій: розпізнавання їжі за фото/описом (AI), щоденник харчування, норми БЖВ та статистика.

## Стек

- **Nuxt 4** + **Vue 3** (компоненти у форматі **TSX**)
- **TypeScript** (strict)
- **Tailwind CSS** (`@nuxtjs/tailwindcss`)
- **Nitro** server routes (`server/api/**`)
- **Nitro** server routes (`server/api/**`)
- **PostgreSQL** + **Prisma 7**

## Вимоги

- Node.js **20+** (рекомендовано 22)
- PostgreSQL (локально або керований хост)

## Швидкий старт

```bash
# 1. Встановити залежності
npm install

# 2. Скопіювати змінні оточення та заповнити
cp .env.example .env

# 3. Запустити dev-сервер
npm run dev
```

Застосунок буде доступний на http://localhost:3001.

## Скрипти

| Команда             | Опис                              |
| ------------------- | --------------------------------- |
| `npm run dev`       | Dev-сервер із HMR (порт 3001)     |
| `npm run build`     | Production-збірка                 |
| `npm run preview`   | Локальний перегляд збірки         |
| `npm run start`     | Запуск зібраного сервера (`.output`, порт 3001) |
| `npm run typecheck` | Перевірка типів (`vue-tsc`)       |
| `npm run lint`      | Лінтинг (ESLint)                  |
| `npm run test`      | Юніт-тести (Vitest)               |
| `npm run db:embed`  | Backfill embeddings для довідника |

## Запуск зібраного сервера

Після `npm run build` запускайте продакшн-сервер через `npm run start`, а не
`node .output/server/index.mjs` напряму. Скрипт підвантажує `server-preload.mjs`
(через `node --import`), який:

- завантажує `.env`;
- задає коректний абсолютний `import.meta.url` — інакше на **Windows** зібраний
  сервер падає з `TypeError [ERR_INVALID_FILE_URL_PATH]: File URL path must be
  absolute` (Nitro лишає плейсхолдер `file:///_entry.js`, а клієнт Prisma не може
  його розібрати; на Linux помилки немає);
- ставить порт `3001` за замовчуванням.

### Продакшн через PM2

У корені є [`ecosystem.config.cjs`](./ecosystem.config.cjs). На сервері мають бути
присутні `.output/`, `server-preload.mjs`, `node_modules/` та `.env` (або задайте
секрети в `env` конфігу PM2).

```bash
npm run build
pm2 start ecosystem.config.cjs        # запуск
pm2 restart calories                  # рестарт після оновлення
pm2 logs calories                     # логи
pm2 save && pm2 startup               # автозапуск після ребуту
```

cd /var/www/calories
npx prisma migrate deploy
npm run build
pm2 stop calories || true
pm2 delete calories || true
pm2 start npm --name calories -- run start
pm2 save

git pull
npm run build
pm2 restart calories --update-env

## Структура проєкту

```
app/
  assets/css/      Tailwind entry
  components/      UI-компоненти (.tsx)
  composables/     Vue composables
  layouts/         Макети (.tsx)
  pages/           Сторінки-роути (.tsx)
  app.vue          Корінь застосунку
server/
  api/             Nitro-ендпоінти
  utils/           crypto, mifflin, rateLimit, prisma-клієнт
  ai/              AI-провайдери (Claude/OpenAI/Gemini)
prisma/            Prisma schema та міграції
nuxt.config.ts     Конфіг Nuxt (Tailwind, vueJsx, runtimeConfig)
tailwind.config.ts Конфіг Tailwind
```

## TSX / JSX

Компоненти пишуться у `.tsx`. Підтримка вмикається через `@vitejs/plugin-vue-jsx`
(конфігурація `vite.vueJsx` у `nuxt.config.ts`) та `jsx: "preserve"` /
`jsxImportSource: "vue"` у `tsconfig.json`.

## Змінні оточення

Дивіться [`.env.example`](./.env.example). Ключові:

- `DATABASE_URL` — рядок підключення PostgreSQL
- `ENCRYPTION_KEY` — 32 байти (hex) для AES-256-GCM
- `NUXT_SESSION_PASSWORD` — секрет сесії (≥ 32 символи)
- OAuth та сервісні AI-ключі — за потреби
- `NUXT_AI_EMBEDDING_PROVIDER` / `NUXT_AI_EMBEDDING_MODEL` — семантичний пошук страв
- `NUXT_REMINDERS_TIMEZONE` — IANA-зона доби журналу, статистики й нагадувань (типово `Europe/Kyiv`)
- `NUXT_APP_URL` — публічний URL для листів скидання пароля
- `NUXT_PUSH_VAPID_*` — Web Push; згенеруйте власні ключі, не комітьте секрети

Процес має бути **один** (PM2 `instances: 1`): rate limit, кеш embeddings і планувальник нагадувань живуть у памʼяті процесу.

## Семантичний пошук страв

«Мої страви» та автопідказки в щоденнику шукають гібридно: спершу збіг за назвою
(ILIKE / нормалізований ключ), паралельно — за змістом (embeddings) на обмеженому
наборі свіжих кандидатів (без повного seq scan таблиці).

**Розширення pgvector не потрібне.** Вектори лежать у звичайній колонці
`FoodItem.embedding DOUBLE PRECISION[]`, зберігаються нормалізованими, а схожість
рахується як скалярний добуток через `unnest(...)` у SQL. Якщо хост дозволяє,
міграція додає `pg_trgm` і GIN-індекси для ILIKE; без прав суперкористувача
розширення пропускається, пошук лишається ILIKE.

Нові страви користувача зберігаються як приватні (`FoodItem.ownerUserId`) і не
потрапляють у чужий довідник. Seed-каталог лишається глобальним.

Embeddings рахує модель із env: Gemini `gemini-embedding-001` або OpenAI
`text-embedding-3-small` (Anthropic embeddings не має). Вектори з’являються при
створенні страви, а для наявного довідника — через `npm run db:embed`
(також викликається в кінці `npm run db:seed`).

Без AI-ключа пошук працює лише за назвою. Зміна провайдера/моделі потребує повторного
`npm run db:embed` — у базі один спільний векторний простір; backfill автоматично
перераховує рядки з іншою розмірністю.

Календарний день журналу зберігається як UTC-північ `YYYY-MM-DD`. Вода, активність
і «сьогодні» на сервері рахуються в `NUXT_REMINDERS_TIMEZONE`.
