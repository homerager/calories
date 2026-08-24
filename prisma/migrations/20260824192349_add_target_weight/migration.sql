-- AlterTable
ALTER TABLE "FoodItem" ALTER COLUMN "embedding" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "targetWeightEnc" TEXT;
