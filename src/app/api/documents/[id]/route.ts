import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getDocumentById } from "@/lib/repos/documents";
import { getStorageAdapter } from "@/lib/storage";

/**
 * The only way a document's bytes ever reach a browser. The URL carries the
 * Document's database id, never the storage key — so even a leaked link is
 * useless without a valid session that also owns the underlying
 * transaction/client/contact. `Cache-Control: private, no-store` keeps
 * shared caches and disk caches from retaining a copy.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/documents/[id]">) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await ctx.params;
  const document = await getDocumentById(session.user.id, id);
  if (!document) {
    return new Response("Not found", { status: 404 });
  }

  let bytes: Buffer;
  try {
    bytes = await getStorageAdapter().get(document.storagePath);
  } catch (error) {
    // A row with no file behind it (e.g. deleted out-of-band, or a DB
    // delete that failed after a successful file delete — see
    // src/lib/documents/mutations.ts) should read as "not found," not
    // crash the request.
    const isFileNotFoundError =
      typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "ENOENT";
    if (!isFileNotFoundError) throw error;
    return new Response("Not found", { status: 404 });
  }

  const asAttachment = request.nextUrl.searchParams.get("download") === "1";
  const safeFilename = document.filename.replace(/["\r\n]/g, "");

  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": document.mimeType,
      "Content-Length": String(document.fileSize),
      "Content-Disposition": `${asAttachment ? "attachment" : "inline"}; filename="${safeFilename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
