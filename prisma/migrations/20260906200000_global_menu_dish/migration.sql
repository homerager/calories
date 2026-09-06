-- Глобальний каталог страв за контрактом MenuItem (порція + БЖВ + рецепт).
CREATE TABLE "MenuDish" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedKey" TEXT NOT NULL,
    "slot" "MealSlot",
    "portionGrams" DOUBLE PRECISION NOT NULL,
    "kcal" DOUBLE PRECISION NOT NULL,
    "protein" DOUBLE PRECISION NOT NULL,
    "fat" DOUBLE PRECISION NOT NULL,
    "carb" DOUBLE PRECISION NOT NULL,
    "detailsJson" JSONB,
    "foodItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuDish_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MenuDish_normalizedKey_key" ON "MenuDish"("normalizedKey");
CREATE INDEX "MenuDish_name_idx" ON "MenuDish"("name");
CREATE INDEX "MenuDish_foodItemId_idx" ON "MenuDish"("foodItemId");

ALTER TABLE "MenuDish" ADD CONSTRAINT "MenuDish_foodItemId_fkey" FOREIGN KEY ("foodItemId") REFERENCES "FoodItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Перенос унікальних страв із тижневих меню (перевага рядкам із рецептом).
INSERT INTO "MenuDish" (
  "id", "name", "normalizedKey", "slot", "portionGrams", "kcal", "protein", "fat", "carb",
  "detailsJson", "foodItemId", "createdAt", "updatedAt"
)
SELECT DISTINCT ON (key)
  'md_' || md5(key),
  s."name",
  s.key,
  s.slot,
  s."portionGrams",
  s.kcal,
  s.protein,
  s.fat,
  s.carb,
  s."detailsJson",
  s."foodItemId",
  NOW(),
  NOW()
FROM (
  SELECT
    "name",
    lower(trim(regexp_replace(regexp_replace("name", '[’''`.,;:!?()"]', '', 'g'), '\s+', ' ', 'g'))) AS key,
    slot,
    "portionGrams",
    kcal,
    protein,
    fat,
    carb,
    "detailsJson",
    "foodItemId"
  FROM "MenuItem"
) s
WHERE s.key <> ''
ORDER BY s.key, (s."detailsJson" IS NOT NULL) DESC;

ALTER TABLE "FoodItem" DROP COLUMN IF EXISTS "recipeJson";
