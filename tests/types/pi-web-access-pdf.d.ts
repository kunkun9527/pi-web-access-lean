export interface PDFExtractResult {
  title: string;
  /** The same Markdown written to outputPath. */
  content: string;
  outputPath: string;
}

export interface PDFExtractOptions {
  maxPages?: number;
  outputDir?: string;
  filename?: string;
  signal?: AbortSignal;
  geminiTimeoutMs?: number;
}

export interface PDFConfig {
  enabled: boolean;
  maxSizeMB: number;
  provider: string;
  datalabMode: string;
  datalabTimeoutMs: number;
}

export function extractPDFToMarkdown(
  buffer: ArrayBuffer,
  url: string,
  options?: PDFExtractOptions,
): Promise<PDFExtractResult>;

export function loadPDFConfig(): PDFConfig;
