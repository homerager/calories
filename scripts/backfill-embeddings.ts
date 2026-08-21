import 'dotenv/config'
import { backfillFoodEmbeddings } from '../server/ai/embeddings.ts'

// Рахує embeddings для страв без вектора (після міграції pgvector або зміни моделі).
// Потребує NUXT_AI_OPENAI_API_KEY або NUXT_AI_GEMINI_API_KEY відповідно до
// NUXT_AI_EMBEDDING_PROVIDER.

const result = await backfillFoodEmbeddings()
if (result.scanned === 0 && result.embedded === 0) {
  console.log('Немає страв без embedding (або немає API-ключа для embeddings).')
} else {
  console.log(
    `Backfill embeddings: scanned=${result.scanned} embedded=${result.embedded} skipped=${result.skipped}`,
  )
}
