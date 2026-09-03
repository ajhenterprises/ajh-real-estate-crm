import "server-only";
import pdf from "pdf-parse";

/** Text-layer extraction only — a scanned/image-only PDF with no text layer returns an empty string, same as a contract in a format we don't parse. */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  const result = await pdf(buffer);
  return result.text;
}
