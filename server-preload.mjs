import process from 'node:process'
// Завантажуємо змінні з .env для запуску зібраного сервера (.output).
import 'dotenv/config'

// Nitro підставляє у збірці плейсхолдер `file:///_entry.js` замість import.meta.url.
// Через порядок оцінки ESM chunks/_/nitro.mjs виконується раніше за index.mjs і
// лишає цей плейсхолдер. Тоді згенерований клієнт Prisma робить
// `fileURLToPath(import.meta.url)` і на Windows падає з
// "File URL path must be absolute" (немає літери диска).
// Через --import цей модуль виконується ПЕРШИМ, тож задаємо реальний абсолютний
// URL, і nitro.mjs (`|| { url: 'file:///_entry.js' }`) уже його не перезапише.
globalThis._importMeta_ = { url: import.meta.url, env: process.env }

// Той самий порт, що й у dev (можна перевизначити через PORT/NITRO_PORT).
process.env.NITRO_PORT ||= process.env.PORT || '3001'
