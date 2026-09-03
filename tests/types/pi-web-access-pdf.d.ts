export interface PDFExtractResult {
  title: string;
  pages: number;
  chars: number;
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
