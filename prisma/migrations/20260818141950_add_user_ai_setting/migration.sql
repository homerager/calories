-- CreateTable
CREATE TABLE "UserAiSetting" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "preferredProvider" "AiProvider",
    "openaiModel" TEXT,
    "anthropicModel" TEXT,
    "geminiModel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAiSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserAiSetting_userId_key" ON "UserAiSetting"("userId");

-- AddForeignKey
ALTER TABLE "UserAiSetting" ADD CONSTRAINT "UserAiSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
