import { prisma } from "@/lib/db";

const BRAND_SETTINGS_ID = "default";

export interface BrandSettings {
  companyName: string | null;
  logoStoragePath: string | null;
  logoMimeType: string | null;
  primaryColor: string;
  accentColor: string;
}

const DEFAULT_BRAND_SETTINGS: BrandSettings = {
  companyName: null,
  logoStoragePath: null,
  logoMimeType: null,
  primaryColor: "#1c3a5e",
  accentColor: "#2f6fed",
};

/**
 * CRM-wide branding — there is exactly one row (id "default"), never
 * per-user. Returns hard-coded defaults (matching globals.css's own
 * defaults) when no row exists yet, so every caller works before the first
 * save without a null check.
 */
export async function getBrandSettings(): Promise<BrandSettings> {
  const row = await prisma.brandSettings.findUnique({ where: { id: BRAND_SETTINGS_ID } });
  if (!row) return DEFAULT_BRAND_SETTINGS;
  return {
    companyName: row.companyName,
    logoStoragePath: row.logoStoragePath,
    logoMimeType: row.logoMimeType,
    primaryColor: row.primaryColor,
    accentColor: row.accentColor,
  };
}

export async function updateBrandSettings(data: {
  companyName?: string | null;
  logoStoragePath?: string | null;
  logoMimeType?: string | null;
  primaryColor?: string;
  accentColor?: string;
}) {
  await prisma.brandSettings.upsert({
    where: { id: BRAND_SETTINGS_ID },
    update: data,
    create: { id: BRAND_SETTINGS_ID, ...DEFAULT_BRAND_SETTINGS, ...data },
  });
}
