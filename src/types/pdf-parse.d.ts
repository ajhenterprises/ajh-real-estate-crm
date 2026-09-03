declare module "pdf-parse" {
  interface PdfParseResult {
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: unknown;
    version: string;
    text: string;
  }

  function pdf(dataBuffer: Buffer): Promise<PdfParseResult>;
  export = pdf;
}
