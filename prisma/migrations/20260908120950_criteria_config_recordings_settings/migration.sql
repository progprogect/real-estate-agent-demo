-- AlterTable
ALTER TABLE "CriterionConfig" ADD COLUMN     "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "ratingMax" INTEGER NOT NULL DEFAULT 5,
ALTER COLUMN "hint" SET DEFAULT '';

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Recording" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'general',
    "fieldKey" TEXT,
    "verbatim" TEXT NOT NULL,
    "durationS" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recording_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Recording_visitId_index_key" ON "Recording"("visitId", "index");

-- AddForeignKey
ALTER TABLE "Recording" ADD CONSTRAINT "Recording_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
