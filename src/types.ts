export interface SchemaFieldCheck {
  field: string;
  exists: boolean;
  value?: string;
  status: 'critical' | 'warning' | 'good';
  description: string;
}

export interface SchemaAnalysis {
  type: string;
  isValid: boolean;
  rawData: any;
  extractedData: Record<string, any>;
  completenessCheck: SchemaFieldCheck[];
  missingFieldsCount: number;
}

export interface KeywordResult {
  keyword: string;
  count: number;
  density: number;
  status: 'too-low' | 'good' | 'stuffed';
  recommendation: string;
}

export interface TopKeyword {
  word: string;
  count: number;
  density: number;
}

export interface SeoCheckItem {
  name: string;
  status: 'good' | 'warning' | 'danger';
  value: string | number;
  message: string;
  recommendation: string;
}

export interface SeoAudit {
  title: string;
  titleLength: number;
  metaDescription: string;
  metaDescriptionLength: number;
  h1Count: number;
  h1s: string[];
  h2Count: number;
  h2s: string[];
  totalImages: number;
  imagesWithAlt: number;
  imagesWithoutAlt: number;
  altPercentage: number;
  score: number; // 0 to 100
  checks: SeoCheckItem[];
}

export interface ReadabilityScore {
  readingEase: number;
  gradeLevel: number;
  easeLabel: string;
  easeDescription: string;
  gradeLabel: string;
  sentencesCount: number;
  wordsCount: number;
  syllablesCount: number;
}

export interface AnalysisReport {
  url: string;
  success: boolean;
  error?: string;
  wordCount: number;
  extractedText: string;
  schema: SchemaAnalysis | null;
  keywordAnalysis: KeywordResult | null;
  topKeywords: TopKeyword[];
  seoAudit: SeoAudit;
  timestamp: string;
  readability?: ReadabilityScore;
}
