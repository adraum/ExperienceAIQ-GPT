export interface RawReview {
  Date: string;
  Stars: number;
  Review: string;
  Location: string;
  Address?: string;
}

export interface ThemeDefinition {
  theme: string;
  description: string;
}

export interface AnalyzedReview extends RawReview {
  themes: {
    theme: string;
    sentiment: 'positive' | 'negative' | 'neutral';
    snippet: string;
  }[];
}

export interface ThemeSummary {
  theme: string;
  summary: string;
  firmSummaries?: Record<string, string>;
}

export interface CustomThemeInput {
  name: string;
  description: string;
}

export interface AnalysisResult {
  language: string;
  themes: ThemeSummary[];
  analyzedReviews: AnalyzedReview[];
}
