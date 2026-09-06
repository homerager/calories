-- Особистий рецепт на приватній страві користувача (не глобальний довідник).
ALTER TABLE "FoodItem" ADD COLUMN "recipeJson" JSONB;
