export interface TaxBracket {
  index: number;
  lower: number;
  upper: number | null;
  marginalRate: number;
  baseTax: number;
  threshold: number;
}

export interface TaxRules {
  slug: string;
  effectiveFrom: string;
  brackets: TaxBracket[];
  sourceUrl: string;
}

export interface IngestionTarget {
  slug: string;
  sourceUrl: string;
  fixturePath: string;
  generatedPath: string;
  goldenPath: string;
  summaryPath: string;
}

export interface IngestionStateEntry {
  contentHash: string;
  effectiveFrom: string;
  lastFetched: string;
  summary: string;
}

export type IngestionState = Record<string, IngestionStateEntry>;
