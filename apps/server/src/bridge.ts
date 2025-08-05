/**
 * Python Bridge Integration Module
 * 
 * Handles communication with the Python usage-bridge service
 * Provides proxy functionality and fallback to mock data
 */

import type { 
  PythonBridgeConfig, 
  ProxyRequestOptions, 
  ProxyResponse,
  UsageStatsResponse,
  UsageSessionsResponse,
  UsageConfig
} from './types';

// Bridge configuration
export const BRIDGE_CONFIG: PythonBridgeConfig = {
  url: process.env.USAGE_BRIDGE_URL || 'http://localhost:8001',
  timeout: parseInt(process.env.USAGE_BRIDGE_TIMEOUT || '5000'),
  retries: parseInt(process.env.USAGE_BRIDGE_RETRIES || '2'),
  enabled: process.env.USAGE_BRIDGE_ENABLED !== 'false'
};

/**
 * Makes a request to the Python bridge service with retry logic
 */
export async function proxyToBridge<T = any>(options: ProxyRequestOptions): Promise<ProxyResponse<T>> {
  if (!BRIDGE_CONFIG.enabled) {
    return {
      success: false,
      error: 'Python bridge is disabled',
      status: 503,
      fromBridge: false
    };
  }

  const { method, path, body, params, timeout = BRIDGE_CONFIG.timeout } = options;
  const url = new URL(path, BRIDGE_CONFIG.url);
  
  // Add query parameters
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= BRIDGE_CONFIG.retries + 1; attempt++) {
    try {
      console.log(`🔄 Bridge request attempt ${attempt}/${BRIDGE_CONFIG.retries + 1}: ${method} ${url.toString()}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(url.toString(), {
        method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Multi-Agent-Observability-Bridge/1.0'
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      let data: T | undefined;
      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        if (text) {
          try {
            data = JSON.parse(text);
          } catch {
            // If it's not JSON, wrap it in a data object
            data = { message: text } as T;
          }
        }
      }
      
      if (response.ok) {
        console.log(`✅ Bridge request successful: ${method} ${path}`);
        return {
          success: true,
          data,
          status: response.status,
          fromBridge: true
        };
      } else {
        console.log(`⚠️ Bridge request failed with status ${response.status}: ${method} ${path}`);
        return {
          success: false,
          error: `Bridge returned ${response.status}: ${response.statusText}`,
          data,
          status: response.status,
          fromBridge: true
        };
      }
      
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.log(`❌ Bridge request error (attempt ${attempt}):`, lastError.message);
      
      if (attempt < BRIDGE_CONFIG.retries + 1) {
        // Wait before retry (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  return {
    success: false,
    error: `Bridge request failed after ${BRIDGE_CONFIG.retries + 1} attempts: ${lastError?.message || 'Unknown error'}`,
    status: 0,
    fromBridge: false
  };
}

/**
 * Get usage statistics from bridge or fallback to mock data
 */
export async function getBridgeUsageStats(configOverride?: Partial<UsageConfig>): Promise<ProxyResponse<UsageStatsResponse>> {
  const params: Record<string, string> = {};
  
  // Convert config override to query parameters
  if (configOverride) {
    Object.entries(configOverride).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params[key] = String(value);
      }
    });
  }
  
  const result = await proxyToBridge<UsageStatsResponse>({
    method: 'GET',
    path: '/usage/stats',
    params
  });
  
  // If bridge is unavailable, return mock data
  if (!result.success && !result.fromBridge) {
    return {
      success: true,
      data: generateMockUsageStats(configOverride),
      status: 200,
      fromBridge: false
    };
  }
  
  return result;
}

/**
 * Get usage sessions from bridge or fallback to mock data
 */
export async function getBridgeUsageSessions(
  sessionId?: string,
  limit: number = 100,
  hoursBack: number = 24
): Promise<ProxyResponse<UsageSessionsResponse>> {
  const params: Record<string, string> = {
    limit: String(limit),
    hours_back: String(hoursBack)
  };
  
  if (sessionId) {
    params.session_id = sessionId;
  }
  
  const result = await proxyToBridge<UsageSessionsResponse>({
    method: 'GET',
    path: '/usage/sessions',
    params
  });
  
  // If bridge is unavailable, return mock data
  if (!result.success && !result.fromBridge) {
    return {
      success: true,
      data: generateMockUsageSessions(sessionId, limit, hoursBack),
      status: 200,
      fromBridge: false
    };
  }
  
  return result;
}

/**
 * Update usage configuration via bridge
 */
export async function updateBridgeUsageConfig(updates: Partial<UsageConfig>): Promise<ProxyResponse<{ success: boolean; data: UsageConfig }>> {
  return await proxyToBridge({
    method: 'POST',
    path: '/usage/config',
    body: updates
  });
}

/**
 * Generate mock usage statistics for fallback
 */
function generateMockUsageStats(configOverride?: Partial<UsageConfig>): UsageStatsResponse {
  const now = Date.now();
  const twoHoursAgo = now - (2 * 60 * 60 * 1000);
  
  return {
    current_session: {
      id: `session-${now}`,
      start_time: twoHoursAgo,
      end_time: now,
      is_active: true,
      token_counts: {
        input_tokens: 1250,
        output_tokens: 850,
        cache_creation_tokens: 0,
        cache_read_tokens: 200,
        total_tokens: 2300
      },
      cost_usd: 0.034,
      burn_rate: {
        tokens_per_minute: 19.2,
        cost_per_hour: 0.61
      },
      models: ['claude-3-5-sonnet-20241022'],
      sent_messages_count: 12,
      per_model_stats: {
        'claude-3-5-sonnet-20241022': {
          tokens: 2300,
          cost: 0.034,
          messages: 12
        }
      }
    },
    recent_sessions: [],
    predictions: {
      tokens_run_out: configOverride?.plan === 'custom' && configOverride?.custom_limit_tokens 
        ? now + (8 * 60 * 60 * 1000) 
        : undefined,
      limit_resets_at: now + (22 * 60 * 60 * 1000)
    },
    burn_rate: {
      tokens_per_minute: 19.2,
      cost_per_hour: 0.61
    },
    totals: {
      cost_percentage: configOverride?.plan === 'pro' ? 68.0 : 34.0,
      token_percentage: configOverride?.plan === 'pro' ? 72.5 : 46.0,
      message_percentage: 15.0,
      time_to_reset_percentage: 8.3
    },
    config_applied: configOverride
  };
}

/**
 * Generate mock usage sessions for fallback
 */
function generateMockUsageSessions(
  sessionId?: string,
  limit: number = 100,
  hoursBack: number = 24
): UsageSessionsResponse {
  return {
    sessions: [],
    total_count: 0,
    hours_back: hoursBack,
    limit: limit,
    session_id: sessionId || null
  };
}

/**
 * Check if the Python bridge is available
 */
export async function checkBridgeHealth(): Promise<boolean> {
  if (!BRIDGE_CONFIG.enabled) {
    return false;
  }
  
  try {
    const result = await proxyToBridge({
      method: 'GET',
      path: '/health',
      timeout: 2000
    });
    return result.success;
  } catch {
    return false;
  }
}

/**
 * Get bridge status and configuration
 */
export function getBridgeStatus() {
  return {
    enabled: BRIDGE_CONFIG.enabled,
    url: BRIDGE_CONFIG.url,
    timeout: BRIDGE_CONFIG.timeout,
    retries: BRIDGE_CONFIG.retries
  };
}