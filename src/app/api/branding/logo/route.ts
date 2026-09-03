import { auth } from "@/lib/auth";
import { getBrandSettings } from "@/lib/settings/brand";
import { getStorageAdapter } from "@/lib/storage";

/**
 * The only way the brokerage logo's bytes reach a browser. Long
 * `Cache-Control` is safe here — unlike documents, this is one shared,
 * non-sensitive brand asset, and every save picks a brand-new storage key
 * (see updateBrandingAction), so a cached copy is never stale.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const settings = await getBrandSettings();
  if (!settings.logoStoragePath || !settings.logoMimeType) {
    return new Response("Not found", { status: 404 });
  }

  let bytes: Buffer;
  try {
    bytes = await getStorageAdapter().get(settings.logoStoragePath);
  } catch (error) {
    const isFileNotFoundError =
      typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "ENOENT";
    if (!isFileNotFoundError) throw error;
    return new Response("Not found", { status: 404 });
  }

  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": settings.logoMimeType,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
