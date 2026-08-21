-- Семантичний пошук страв: замінюємо JSON-заглушку FoodItem.embedding на масив
-- double precision[].
--
-- Свідомо БЕЗ pgvector: `CREATE EXTENSION vector` потребує прав суперкористувача,
-- яких немає на керованих PostgreSQL-хостах (помилка 42501). Схожість рахується
-- як скалярний добуток нормалізованих векторів через unnest — працює на будь-якому
-- PostgreSQL без розширень.
--
-- (Ім'я папки міграції історичне — воно вже зафіксоване в _prisma_migrations.)

ALTER TABLE "FoodItem" DROP COLUMN IF EXISTS "embedding";

ALTER TABLE "FoodItem" ADD COLUMN "embedding" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[];
