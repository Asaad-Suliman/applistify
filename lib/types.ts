export type Platform = "ios" | "android" | "both";
export type Language = "es" | "fr" | "de" | "ja" | "ar";

export interface Profile {
  id: string;
  email: string;
  runs_used: number;
  created_at: string;
  updated_at: string;
}

export interface Optimization {
  id: string;
  user_id: string;
  app_name: string;
  category: string;
  features: string;
  target_audience: string;
  competitors: string | null;
  platform: Platform;
  created_at: string;
}

export interface Variant {
  id: string;
  optimization_id: string;
  user_id: string;
  variant_index: 1 | 2 | 3;
  title: string;
  subtitle: string;
  description: string;
  keywords: string[];
  screenshot_text: string[];
  created_at: string;
}

export interface Localization {
  id: string;
  variant_id: string;
  user_id: string;
  language: Language;
  title: string;
  subtitle: string;
  description: string;
  keywords: string[];
  created_at: string;
}

export interface OptimizationInput {
  app_name: string;
  category: string;
  features: string;
  target_audience: string;
  competitors?: string;
  platform: Platform;
}
