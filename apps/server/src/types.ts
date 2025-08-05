export interface HookEvent {
  id?: number;
  source_app: string;
  session_id: string;
  hook_event_type: string;
  payload: Record<string, any>;
  chat?: any[];
  summary?: string;
  timestamp?: number;
}

export interface FilterOptions {
  source_apps: string[];
  session_ids: string[];
  hook_event_types: string[];
}

// Theme-related interfaces for server-side storage and API
export interface ThemeColors {
  primary: string;
  primaryHover: string;
  primaryLight: string;
  primaryDark: string;
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  bgQuaternary: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textQuaternary: string;
  borderPrimary: string;
  borderSecondary: string;
  borderTertiary: string;
  accentSuccess: string;
  accentWarning: string;
  accentError: string;
  accentInfo: string;
  shadow: string;
  shadowLg: string;
  hoverBg: string;
  activeBg: string;
  focusRing: string;
}

export interface Theme {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  colors: ThemeColors;
  isPublic: boolean;
  authorId?: string;
  authorName?: string;
  createdAt: number;
  updatedAt: number;
  tags: string[];
  downloadCount?: number;
  rating?: number;
  ratingCount?: number;
}

export interface ThemeSearchQuery {
  query?: string;
  tags?: string[];
  authorId?: string;
  isPublic?: boolean;
  sortBy?: 'name' | 'created' | 'updated' | 'downloads' | 'rating';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface ThemeShare {
  id: string;
  themeId: string;
  shareToken: string;
  expiresAt?: number;
  isPublic: boolean;
  allowedUsers: string[];
  createdAt: number;
  accessCount: number;
}

export interface ThemeRating {
  id: string;
  themeId: string;
  userId: string;
  rating: number; // 1-5
  comment?: string;
  createdAt: number;
}

export interface ThemeValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  validationErrors?: ThemeValidationError[];
}

// Usage monitoring types (matching Python bridge API)
export interface UsageEntry {
  timestamp: number;
  input_tokens: number;
  output_tokens: number;
  cache_creation_tokens: number;
  cache_read_tokens: number;
  cost_usd: number;
  model: string;
  message_id: string;
  request_id: string;
}

export interface TokenCounts {
  input_tokens: number;
  output_tokens: number;
  cache_creation_tokens: number;
  cache_read_tokens: number;
  total_tokens: number;
}

export interface BurnRate {
  tokens_per_minute: number;
  cost_per_hour: number;
}

export interface SessionBlock {
  id: string;
  start_time: number;
  end_time: number;
  is_active: boolean;
  token_counts: TokenCounts;
  cost_usd: number;
  burn_rate?: BurnRate;
  models: string[];
  sent_messages_count: number;
  per_model_stats: Record<string, any>;
}

export interface UsageConfig {
  id?: number;
  plan: 'pro' | 'max5' | 'max20' | 'custom';
  custom_limit_tokens?: number;
  view: 'realtime' | 'daily' | 'monthly' | 'session';
  timezone: string;
  time_format: '12h' | '24h' | 'auto';
  theme: 'light' | 'dark' | 'classic' | 'auto';
  refresh_rate: number;  // 1-60 seconds
  refresh_per_second: number;  // 0.1-20.0 Hz
  reset_hour?: number;  // 0-23
  created_at?: number;
  updated_at?: number;
}

export interface UsagePredictions {
  tokens_run_out?: number;  // timestamp
  limit_resets_at?: number;  // timestamp
}

export interface UsageTotals {
  cost_percentage: number;
  token_percentage: number;
  message_percentage: number;
  time_to_reset_percentage: number;
}

export interface UsageStats {
  current_session?: SessionBlock;
  recent_sessions: SessionBlock[];
  predictions: UsagePredictions;
  burn_rate: BurnRate;
  totals: UsageTotals;
}

export interface UsageSnapshot {
  id?: number;
  session_id: string;
  snapshot_data: string;  // JSON serialized UsageStats
  snapshot_type: 'stats' | 'config' | 'session';
  timestamp: number;
}