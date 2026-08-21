-- Семантичний пошук страв: pgvector замість JSON-заглушки FoodItem.embedding.
-- Потрібне розширення vector (https://github.com/pgvector/pgvector).
-- Розмірність 1536 відповідає OpenAI text-embedding-3-small та Gemini
-- gemini-embedding-001 з outputDimensionality=1536.

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "FoodItem" DROP COLUMN IF EXISTS "embedding";

ALTER TABLE "FoodItem" ADD COLUMN "embedding" vector(1536);

CREATE INDEX "FoodItem_embedding_hnsw_idx"
  ON "FoodItem"
  USING hnsw ("embedding" vector_cosine_ops);
