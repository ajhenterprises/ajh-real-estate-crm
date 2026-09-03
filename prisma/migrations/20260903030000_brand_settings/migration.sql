-- CreateTable
CREATE TABLE "brand_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "companyName" TEXT,
    "logoStoragePath" TEXT,
    "logoMimeType" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#1c3a5e',
    "accentColor" TEXT NOT NULL DEFAULT '#2f6fed',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_settings_pkey" PRIMARY KEY ("id")
);
