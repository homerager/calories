-- Календарні дати → UTC-північ YYYY-MM-DD (зона Europe/Kyiv, як NUXT_REMINDERS_TIMEZONE).
-- Приватні страви (ownerUserId), улюблені, токени скидання пароля.
-- pg_trgm для ILIKE (якщо розширення доступне).

-- ── Дати журналу ─────────────────────────────────────────────
-- Prisma DateTime = timestamp without time zone (UTC-наївний).
-- Беремо календарний день у Києві й записуємо як 00:00 UTC цього дня.

UPDATE "MealEntry"
SET "date" = ((((("date" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Kyiv')::date)::timestamp));

UPDATE "MenuPlan"
SET "startDate" = ((((("startDate" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Kyiv')::date)::timestamp));

UPDATE "DailyAggregate"
SET "date" = ((((("date" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Kyiv')::date)::timestamp));

-- Злити дублікати агрегатів після нормалізації дат.
WITH merged AS (
  SELECT
    "userId",
    "date",
    SUM("totalKcal") AS "totalKcal",
    SUM("totalProtein") AS "totalProtein",
    SUM("totalFat") AS "totalFat",
    SUM("totalCarb") AS "totalCarb",
    MIN(id) AS keep_id
  FROM "DailyAggregate"
  GROUP BY "userId", "date"
  HAVING COUNT(*) > 1
),
updated AS (
  UPDATE "DailyAggregate" AS a
  SET
    "totalKcal" = m."totalKcal",
    "totalProtein" = m."totalProtein",
    "totalFat" = m."totalFat",
    "totalCarb" = m."totalCarb"
  FROM merged m
  WHERE a.id = m.keep_id
  RETURNING a.id
)
DELETE FROM "DailyAggregate" AS a
USING merged m
WHERE a."userId" = m."userId"
  AND a."date" = m."date"
  AND a.id <> m.keep_id;

-- ── FoodItem: власник ────────────────────────────────────────
ALTER TABLE "FoodItem" ADD COLUMN "ownerUserId" TEXT;

ALTER TABLE "FoodItem" ADD CONSTRAINT "FoodItem_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "FoodItem_normalizedKey_key";

CREATE UNIQUE INDEX "FoodItem_global_normalizedKey_key"
  ON "FoodItem" ("normalizedKey")
  WHERE "ownerUserId" IS NULL;

CREATE UNIQUE INDEX "FoodItem_owner_normalizedKey_key"
  ON "FoodItem" ("ownerUserId", "normalizedKey")
  WHERE "ownerUserId" IS NOT NULL;

CREATE INDEX "FoodItem_normalizedKey_idx" ON "FoodItem"("normalizedKey");
CREATE INDEX "FoodItem_ownerUserId_idx" ON "FoodItem"("ownerUserId");

-- ── Улюблені ─────────────────────────────────────────────────
CREATE TABLE "FoodFavorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "foodItemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FoodFavorite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FoodFavorite_userId_foodItemId_key" ON "FoodFavorite"("userId", "foodItemId");
CREATE INDEX "FoodFavorite_userId_idx" ON "FoodFavorite"("userId");

ALTER TABLE "FoodFavorite" ADD CONSTRAINT "FoodFavorite_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FoodFavorite" ADD CONSTRAINT "FoodFavorite_foodItemId_fkey"
  FOREIGN KEY ("foodItemId") REFERENCES "FoodItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Скидання пароля ──────────────────────────────────────────
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── pg_trgm (може бути заборонено на керованому хості) ───────
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'pg_trgm skipped: insufficient privilege';
  WHEN undefined_file THEN
    RAISE NOTICE 'pg_trgm skipped: extension files not installed';
END
$$;

DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "FoodItem_name_trgm_idx"
    ON "FoodItem" USING gin ("name" gin_trgm_ops);
  CREATE INDEX IF NOT EXISTS "FoodItem_normalizedKey_trgm_idx"
    ON "FoodItem" USING gin ("normalizedKey" gin_trgm_ops);
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pg_trgm indexes skipped: %', SQLERRM;
END
$$;
