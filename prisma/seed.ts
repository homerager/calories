import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './generated/client/client.ts'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL is not set')
}

const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

// Нормалізація назви у ключ пошуку схожих страв (lower, trim, згортання пробілів).
function normalizeKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[’'`.,;:!?()"]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Довідник поширених продуктів (на 100 г).
type SeedFood = {
  name: string
  kcalPer100: number
  proteinPer100: number
  fatPer100: number
  carbPer100: number
}

const foods: SeedFood[] = [
  { name: 'Куряче філе (варене)', kcalPer100: 165, proteinPer100: 31, fatPer100: 3.6, carbPer100: 0 },
  { name: 'Куряче філе (сире)', kcalPer100: 120, proteinPer100: 23, fatPer100: 2.6, carbPer100: 0 },
  { name: 'Яловичина (варена)', kcalPer100: 250, proteinPer100: 26, fatPer100: 15, carbPer100: 0 },
  { name: 'Свинина (смажена)', kcalPer100: 290, proteinPer100: 27, fatPer100: 20, carbPer100: 0 },
  { name: 'Лосось (запечений)', kcalPer100: 208, proteinPer100: 20, fatPer100: 13, carbPer100: 0 },
  { name: 'Тунець (консервований у воді)', kcalPer100: 116, proteinPer100: 26, fatPer100: 1, carbPer100: 0 },
  { name: 'Яйце куряче (варене)', kcalPer100: 155, proteinPer100: 13, fatPer100: 11, carbPer100: 1.1 },
  { name: 'Сир твердий', kcalPer100: 350, proteinPer100: 25, fatPer100: 27, carbPer100: 2 },
  { name: 'Сир кисломолочний 5%', kcalPer100: 121, proteinPer100: 17, fatPer100: 5, carbPer100: 3 },
  { name: 'Молоко 2.5%', kcalPer100: 52, proteinPer100: 2.8, fatPer100: 2.5, carbPer100: 4.7 },
  { name: 'Йогурт натуральний', kcalPer100: 60, proteinPer100: 4, fatPer100: 3, carbPer100: 4.5 },
  { name: 'Вершкове масло', kcalPer100: 717, proteinPer100: 0.9, fatPer100: 81, carbPer100: 0.1 },
  { name: 'Олія соняшникова', kcalPer100: 884, proteinPer100: 0, fatPer100: 100, carbPer100: 0 },
  { name: 'Олія оливкова', kcalPer100: 884, proteinPer100: 0, fatPer100: 100, carbPer100: 0 },
  { name: 'Рис білий (варений)', kcalPer100: 130, proteinPer100: 2.7, fatPer100: 0.3, carbPer100: 28 },
  { name: 'Гречка (варена)', kcalPer100: 92, proteinPer100: 3.4, fatPer100: 0.6, carbPer100: 20 },
  { name: 'Вівсянка (варена на воді)', kcalPer100: 88, proteinPer100: 3, fatPer100: 1.7, carbPer100: 15 },
  { name: 'Макарони (варені)', kcalPer100: 131, proteinPer100: 5, fatPer100: 1.1, carbPer100: 25 },
  { name: 'Картопля (варена)', kcalPer100: 87, proteinPer100: 2, fatPer100: 0.1, carbPer100: 20 },
  { name: 'Картопля смажена', kcalPer100: 192, proteinPer100: 2.8, fatPer100: 9.5, carbPer100: 23 },
  { name: 'Хліб пшеничний', kcalPer100: 265, proteinPer100: 9, fatPer100: 3.2, carbPer100: 49 },
  { name: 'Хліб житній', kcalPer100: 250, proteinPer100: 8, fatPer100: 3.3, carbPer100: 48 },
  { name: 'Банан', kcalPer100: 89, proteinPer100: 1.1, fatPer100: 0.3, carbPer100: 23 },
  { name: 'Яблуко', kcalPer100: 52, proteinPer100: 0.3, fatPer100: 0.2, carbPer100: 14 },
  { name: 'Апельсин', kcalPer100: 47, proteinPer100: 0.9, fatPer100: 0.1, carbPer100: 12 },
  { name: 'Помідор', kcalPer100: 18, proteinPer100: 0.9, fatPer100: 0.2, carbPer100: 3.9 },
  { name: 'Огірок', kcalPer100: 15, proteinPer100: 0.7, fatPer100: 0.1, carbPer100: 3.6 },
  { name: 'Морква', kcalPer100: 41, proteinPer100: 0.9, fatPer100: 0.2, carbPer100: 10 },
  { name: 'Броколі (варена)', kcalPer100: 35, proteinPer100: 2.4, fatPer100: 0.4, carbPer100: 7 },
  { name: 'Салат листовий', kcalPer100: 15, proteinPer100: 1.4, fatPer100: 0.2, carbPer100: 2.9 },
  { name: 'Авокадо', kcalPer100: 160, proteinPer100: 2, fatPer100: 15, carbPer100: 9 },
  { name: 'Горіхи волоські', kcalPer100: 654, proteinPer100: 15, fatPer100: 65, carbPer100: 14 },
  { name: 'Мигдаль', kcalPer100: 579, proteinPer100: 21, fatPer100: 50, carbPer100: 22 },
  { name: 'Квасоля (варена)', kcalPer100: 127, proteinPer100: 9, fatPer100: 0.5, carbPer100: 23 },
  { name: 'Сочевиця (варена)', kcalPer100: 116, proteinPer100: 9, fatPer100: 0.4, carbPer100: 20 },
  { name: 'Цукор', kcalPer100: 387, proteinPer100: 0, fatPer100: 0, carbPer100: 100 },
  { name: 'Мед', kcalPer100: 304, proteinPer100: 0.3, fatPer100: 0, carbPer100: 82 },
  { name: 'Шоколад чорний', kcalPer100: 546, proteinPer100: 4.9, fatPer100: 31, carbPer100: 61 },
  { name: 'Кава без цукру', kcalPer100: 2, proteinPer100: 0.1, fatPer100: 0, carbPer100: 0 },
  { name: 'Гриби печериці (смажені)', kcalPer100: 50, proteinPer100: 3.7, fatPer100: 3, carbPer100: 2.4 },
]

async function main() {
  console.log(`Seeding ${foods.length} food items...`)

  for (const food of foods) {
    const normalizedKey = normalizeKey(food.name)
    const existing = await prisma.foodItem.findFirst({
      where: { normalizedKey, ownerUserId: null },
    })
    if (existing) {
      await prisma.foodItem.update({
        where: { id: existing.id },
        data: {
          name: food.name,
          kcalPer100: food.kcalPer100,
          proteinPer100: food.proteinPer100,
          fatPer100: food.fatPer100,
          carbPer100: food.carbPer100,
          source: 'MANUAL',
        },
      })
    } else {
      await prisma.foodItem.create({
        data: {
          name: food.name,
          normalizedKey,
          kcalPer100: food.kcalPer100,
          proteinPer100: food.proteinPer100,
          fatPer100: food.fatPer100,
          carbPer100: food.carbPer100,
          source: 'MANUAL',
        },
      })
    }
  }

  console.log('Seed completed.')

  const { backfillFoodEmbeddings } = await import('../server/ai/embeddings.ts')
  const result = await backfillFoodEmbeddings()
  if (result.embedded > 0) {
    console.log(
      `Embeddings: scanned=${result.scanned} embedded=${result.embedded} skipped=${result.skipped}`,
    )
  } else {
    console.log('Embeddings пропущено (немає ключа NUXT_AI_*_API_KEY або всі вектори вже є).')
  }
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
