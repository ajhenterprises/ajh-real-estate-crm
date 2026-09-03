"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { getStorageAdapter } from "@/lib/storage";
import { updateBrandSettings } from "@/lib/settings/brand";

// Logos only — a much narrower set than transaction documents
// (src/lib/documents/validation.ts), since this is a small brand asset
// rendered inline in the app chrome, never a scanned/uploaded record.
const ALLOWED_LOGO_MIME_TYPES: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/svg+xml": ".svg",
  "image/webp": ".webp",
};

const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024;

const hexColor = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Enter a color as a hex code, e.g. #1c3a5e");

const brandingSchema = z.object({
  companyName: z.preprocess((v) => (v === "" ? undefined : v), z.string().trim().max(200).optional()),
  primaryColor: hexColor,
  accentColor: hexColor,
});

export interface UpdateBrandingState {
  error?: string;
  success?: boolean;
}

export async function updateBrandingAction(
  _prevState: UpdateBrandingState | undefined,
  formData: FormData,
): Promise<UpdateBrandingState> {
  await requireSession();

  const parsed = brandingSchema.safeParse({
    companyName: formData.get("companyName"),
    primaryColor: formData.get("primaryColor"),
    accentColor: formData.get("accentColor"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const logoFile = formData.get("logo");
  let logoStoragePath: string | undefined;
  let logoMimeType: string | undefined;

  if (logoFile instanceof File && logoFile.size > 0) {
    if (logoFile.size > MAX_LOGO_SIZE_BYTES) {
      return { error: "That logo is too large. The maximum size is 2 MB." };
    }
    const extension = ALLOWED_LOGO_MIME_TYPES[logoFile.type];
    if (!extension) {
      return { error: "That file type isn't supported. Upload a PNG, JPEG, WebP, or SVG." };
    }

    const key = `branding/logo-${randomUUID()}${extension}`;
    const body = Buffer.from(await logoFile.arrayBuffer());
    await getStorageAdapter().put({ key, body, contentType: logoFile.type });
    logoStoragePath = key;
    logoMimeType = logoFile.type;
  }

  await updateBrandSettings({
    companyName: parsed.data.companyName ?? null,
    primaryColor: parsed.data.primaryColor,
    accentColor: parsed.data.accentColor,
    ...(logoStoragePath ? { logoStoragePath, logoMimeType } : {}),
  });

  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { success: true };
}
