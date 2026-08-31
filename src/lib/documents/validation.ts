/**
 * Upload constraints for transaction documents. Centralized so the form's
 * `accept` attribute, the server-side check, and next.config.ts's Server
 * Action body size limit all agree on the same ceiling.
 */

// PDF plus common transaction-document formats. Intentionally excludes
// anything executable — no .exe/.js/.sh/etc, and no generic
// application/octet-stream fallback that would accept arbitrary binaries.
export const ALLOWED_DOCUMENT_MIME_TYPES: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
};

export const ALLOWED_DOCUMENT_EXTENSIONS = Object.values(ALLOWED_DOCUMENT_MIME_TYPES).join(",");

// Comfortably under the 20mb Server Action body limit in next.config.ts,
// leaving room for multipart/form-data overhead.
export const MAX_DOCUMENT_SIZE_BYTES = 15 * 1024 * 1024;

export function isAllowedDocumentMimeType(mimeType: string): boolean {
  return mimeType in ALLOWED_DOCUMENT_MIME_TYPES;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
