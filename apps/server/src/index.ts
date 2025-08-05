import { 
  initDatabase, 
  insertEvent, 
  getFilterOptions, 
  getRecentEvents,
  getUsageConfig,
  updateUsageConfig,
  resetUsageConfig,
  getUsageSnapshots,
  insertUsageSnapshot
} from './db';
import type { HookEvent, UsageConfig, WebSocketMessage } from './types';
import { 
  getBridgeUsageStats, 
  getBridgeUsageSessions, 
  updateBridgeUsageConfig,
  checkBridgeHealth,
  getBridgeStatus
} from './bridge';
import { 
  createTheme, 
  updateThemeById, 
  getThemeById, 
  searchThemes, 
  deleteThemeById, 
  exportThemeById, 
  importTheme,
  getThemeStats 
} from './theme';

// Initialize database
initDatabase();

// Store WebSocket clients
const wsClients = new Set<any>();

// Helper function to broadcast messages to all WebSocket clients
function broadcastToClients(message: WebSocketMessage): void {
  const messageStr = JSON.stringify(message);
  wsClients.forEach(client => {
    try {
      client.send(messageStr);
    } catch (err) {
      // Client disconnected, remove from set
      wsClients.delete(client);
    }
  });
}

// Helper function to determine if an event should trigger a usage update broadcast
function shouldTriggerUsageUpdate(event: HookEvent): boolean {
  // Trigger usage updates for these event types
  const triggerEvents = [
    'PreToolUse',      // Tool usage can affect token counts
    'PostToolUse',     // Tool completion
    'Stop',            // Response completion
    'SubagentStop',    // Subagent completion
    'UserPromptSubmit' // New user interaction
  ];
  
  return triggerEvents.includes(event.hook_event_type);
}

// Helper function to broadcast usage updates
async function broadcastUsageUpdate(sessionId: string): Promise<void> {
  try {
    // Get current usage stats for the session
    const usageResult = await getBridgeUsageStats();
    
    if (usageResult.success && usageResult.data) {
      const usageMessage: WebSocketMessage = {
        type: 'usage_update',
        data: usageResult.data,
        timestamp: Date.now(),
        session_id: sessionId
      };
      
      broadcastToClients(usageMessage);
      
      // Store usage snapshot for historical data
      if (usageResult.fromBridge && usageResult.data.current_session?.id) {
        try {
          insertUsageSnapshot({
            session_id: sessionId,
            snapshot_data: JSON.stringify(usageResult.data),
            snapshot_type: 'stats',
            timestamp: Date.now()
          });
        } catch (snapshotError) {
          console.warn('Failed to store usage snapshot during broadcast:', snapshotError);
        }
      }
    }
  } catch (error) {
    console.error('Error broadcasting usage update:', error);
    
    // Send error message to clients
    const errorMessage: WebSocketMessage = {
      type: 'error',
      data: {
        error: 'Failed to retrieve usage update',
        detail: error instanceof Error ? error.message : 'Unknown error'
      },
      timestamp: Date.now(),
      session_id: sessionId
    };
    
    broadcastToClients(errorMessage);
  }
}

// Create Bun server with HTTP and WebSocket support
const server = Bun.serve({
  port: 4000,
  
  async fetch(req: Request) {
    const url = new URL(req.url);
    
    // Handle CORS
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    
    // Handle preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers });
    }
    
    // POST /events - Receive new events
    if (url.pathname === '/events' && req.method === 'POST') {
      try {
        const event: HookEvent = await req.json();
        
        // Validate required fields
        if (!event.source_app || !event.session_id || !event.hook_event_type || !event.payload) {
          return new Response(JSON.stringify({ error: 'Missing required fields' }), {
            status: 400,
            headers: { ...headers, 'Content-Type': 'application/json' }
          });
        }
        
        // Insert event into database
        const savedEvent = insertEvent(event);
        
        // Broadcast event to all WebSocket clients
        const eventMessage: WebSocketMessage = { 
          type: 'event', 
          data: savedEvent,
          timestamp: Date.now(),
          session_id: savedEvent.session_id
        };
        broadcastToClients(eventMessage);
        
        // If this is a session start/end event or significant milestone, also broadcast usage update
        if (shouldTriggerUsageUpdate(event)) {
          broadcastUsageUpdate(savedEvent.session_id);
        }
        
        return new Response(JSON.stringify(savedEvent), {
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Error processing event:', error);
        return new Response(JSON.stringify({ error: 'Invalid request' }), {
          status: 400,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
    }
    
    // GET /events/filter-options - Get available filter options
    if (url.pathname === '/events/filter-options' && req.method === 'GET') {
      const options = getFilterOptions();
      return new Response(JSON.stringify(options), {
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }
    
    // GET /events/recent - Get recent events
    if (url.pathname === '/events/recent' && req.method === 'GET') {
      const limit = parseInt(url.searchParams.get('limit') || '100');
      const events = getRecentEvents(limit);
      return new Response(JSON.stringify(events), {
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }
    
    // Theme API endpoints
    
    // POST /api/themes - Create a new theme
    if (url.pathname === '/api/themes' && req.method === 'POST') {
      try {
        const themeData = await req.json();
        const result = await createTheme(themeData);
        
        const status = result.success ? 201 : 400;
        return new Response(JSON.stringify(result), {
          status,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Error creating theme:', error);
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Invalid request body' 
        }), {
          status: 400,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
    }
    
    // GET /api/themes - Search themes
    if (url.pathname === '/api/themes' && req.method === 'GET') {
      const query = {
        query: url.searchParams.get('query') || undefined,
        isPublic: url.searchParams.get('isPublic') ? url.searchParams.get('isPublic') === 'true' : undefined,
        authorId: url.searchParams.get('authorId') || undefined,
        sortBy: url.searchParams.get('sortBy') as any || undefined,
        sortOrder: url.searchParams.get('sortOrder') as any || undefined,
        limit: url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : undefined,
        offset: url.searchParams.get('offset') ? parseInt(url.searchParams.get('offset')!) : undefined,
      };
      
      const result = await searchThemes(query);
      return new Response(JSON.stringify(result), {
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }
    
    // GET /api/themes/:id - Get a specific theme
    if (url.pathname.startsWith('/api/themes/') && req.method === 'GET') {
      const id = url.pathname.split('/')[3];
      if (!id) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Theme ID is required' 
        }), {
          status: 400,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
      
      const result = await getThemeById(id);
      const status = result.success ? 200 : 404;
      return new Response(JSON.stringify(result), {
        status,
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }
    
    // PUT /api/themes/:id - Update a theme
    if (url.pathname.startsWith('/api/themes/') && req.method === 'PUT') {
      const id = url.pathname.split('/')[3];
      if (!id) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Theme ID is required' 
        }), {
          status: 400,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
      
      try {
        const updates = await req.json();
        const result = await updateThemeById(id, updates);
        
        const status = result.success ? 200 : 400;
        return new Response(JSON.stringify(result), {
          status,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Error updating theme:', error);
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Invalid request body' 
        }), {
          status: 400,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
    }
    
    // DELETE /api/themes/:id - Delete a theme
    if (url.pathname.startsWith('/api/themes/') && req.method === 'DELETE') {
      const id = url.pathname.split('/')[3];
      if (!id) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Theme ID is required' 
        }), {
          status: 400,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
      
      const authorId = url.searchParams.get('authorId');
      const result = await deleteThemeById(id, authorId || undefined);
      
      const status = result.success ? 200 : (result.error?.includes('not found') ? 404 : 403);
      return new Response(JSON.stringify(result), {
        status,
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }
    
    // GET /api/themes/:id/export - Export a theme
    if (url.pathname.match(/^\/api\/themes\/[^\/]+\/export$/) && req.method === 'GET') {
      const id = url.pathname.split('/')[3];
      
      const result = await exportThemeById(id);
      if (!result.success) {
        const status = result.error?.includes('not found') ? 404 : 400;
        return new Response(JSON.stringify(result), {
          status,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
      
      return new Response(JSON.stringify(result.data), {
        headers: { 
          ...headers, 
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${result.data.theme.name}.json"`
        }
      });
    }
    
    // POST /api/themes/import - Import a theme
    if (url.pathname === '/api/themes/import' && req.method === 'POST') {
      try {
        const importData = await req.json();
        const authorId = url.searchParams.get('authorId');
        
        const result = await importTheme(importData, authorId || undefined);
        
        const status = result.success ? 201 : 400;
        return new Response(JSON.stringify(result), {
          status,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Error importing theme:', error);
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Invalid import data' 
        }), {
          status: 400,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
    }
    
    // GET /api/themes/stats - Get theme statistics
    if (url.pathname === '/api/themes/stats' && req.method === 'GET') {
      const result = await getThemeStats();
      return new Response(JSON.stringify(result), {
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }
    
    // Usage API endpoints
    
    // GET /api/usage/stats - Get current usage statistics via Python bridge proxy
    if (url.pathname === '/api/usage/stats' && req.method === 'GET') {
      try {
        // Parse query parameters for configuration override
        const configOverride: Partial<UsageConfig> = {};
        const plan = url.searchParams.get('plan');
        const customLimitTokens = url.searchParams.get('custom_limit_tokens');
        const view = url.searchParams.get('view');
        const timezone = url.searchParams.get('timezone');
        const theme = url.searchParams.get('theme');
        const timeFormat = url.searchParams.get('time_format');
        const refreshRate = url.searchParams.get('refresh_rate');
        const refreshPerSecond = url.searchParams.get('refresh_per_second');
        const resetHour = url.searchParams.get('reset_hour');
        
        if (plan && ['pro', 'max5', 'max20', 'custom'].includes(plan)) {
          configOverride.plan = plan as 'pro' | 'max5' | 'max20' | 'custom';
        }
        if (customLimitTokens && !isNaN(parseInt(customLimitTokens))) {
          const tokens = parseInt(customLimitTokens);
          if (tokens > 0) configOverride.custom_limit_tokens = tokens;
        }
        if (view && ['realtime', 'daily', 'monthly', 'session'].includes(view)) {
          configOverride.view = view as 'realtime' | 'daily' | 'monthly' | 'session';
        }
        if (timezone) configOverride.timezone = timezone;
        if (theme && ['light', 'dark', 'classic', 'auto'].includes(theme)) {
          configOverride.theme = theme as 'light' | 'dark' | 'classic' | 'auto';
        }
        if (timeFormat && ['12h', '24h', 'auto'].includes(timeFormat)) {
          configOverride.time_format = timeFormat as '12h' | '24h' | 'auto';
        }
        if (refreshRate && !isNaN(parseInt(refreshRate))) {
          const rate = parseInt(refreshRate);
          if (rate >= 1 && rate <= 60) configOverride.refresh_rate = rate;
        }
        if (refreshPerSecond && !isNaN(parseFloat(refreshPerSecond))) {
          const rate = parseFloat(refreshPerSecond);
          if (rate >= 0.1 && rate <= 20.0) configOverride.refresh_per_second = rate;
        }
        if (resetHour && !isNaN(parseInt(resetHour))) {
          const hour = parseInt(resetHour);
          if (hour >= 0 && hour <= 23) configOverride.reset_hour = hour;
        }
        
        // Get usage statistics from Python bridge with fallback to mock data
        const result = await getBridgeUsageStats(configOverride);
        
        if (!result.success) {
          console.error('Bridge error:', result.error);
          return new Response(JSON.stringify({ 
            error: 'Failed to retrieve usage statistics',
            detail: result.error,
            fromBridge: result.fromBridge
          }), {
            status: result.status || 500,
            headers: { ...headers, 'Content-Type': 'application/json' }
          });
        }
        
        // Store snapshot if data came from bridge
        if (result.fromBridge && result.data?.current_session?.id) {
          try {
            insertUsageSnapshot({
              session_id: result.data.current_session.id,
              snapshot_data: JSON.stringify(result.data),
              snapshot_type: 'stats',
              timestamp: Date.now()
            });
          } catch (snapshotError) {
            console.warn('Failed to store usage snapshot:', snapshotError);
          }
        }
        
        return new Response(JSON.stringify(result.data), {
          headers: { 
            ...headers, 
            'Content-Type': 'application/json',
            'X-Data-Source': result.fromBridge ? 'bridge' : 'mock'
          }
        });
      } catch (error) {
        console.error('Error getting usage stats:', error);
        return new Response(JSON.stringify({ 
          error: 'Failed to retrieve usage statistics',
          detail: error instanceof Error ? error.message : 'Unknown error'
        }), {
          status: 500,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
    }
    
    // GET /api/usage/config - Get current usage configuration
    if (url.pathname === '/api/usage/config' && req.method === 'GET') {
      try {
        const config = getUsageConfig();
        if (!config) {
          return new Response(JSON.stringify({ 
            error: 'No usage configuration found',
            detail: 'Database may need to be migrated'
          }), {
            status: 404,
            headers: { ...headers, 'Content-Type': 'application/json' }
          });
        }
        
        return new Response(JSON.stringify(config), {
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Error getting usage config:', error);
        return new Response(JSON.stringify({ 
          error: 'Failed to retrieve usage configuration',
          detail: error instanceof Error ? error.message : 'Unknown error'
        }), {
          status: 500,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
    }
    
    // GET /api/usage/bridge/status - Get Python bridge status
    if (url.pathname === '/api/usage/bridge/status' && req.method === 'GET') {
      try {
        const isHealthy = await checkBridgeHealth();
        const status = getBridgeStatus();
        
        return new Response(JSON.stringify({
          ...status,
          healthy: isHealthy,
          timestamp: Date.now()
        }), {
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Error checking bridge status:', error);
        return new Response(JSON.stringify({ 
          error: 'Failed to check bridge status',
          detail: error instanceof Error ? error.message : 'Unknown error'
        }), {
          status: 500,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
    }
    
    // POST /api/usage/config - Update usage configuration via bridge and local database
    if (url.pathname === '/api/usage/config' && req.method === 'POST') {
      try {
        const updates: Partial<UsageConfig> = await req.json();
        
        // Validate the updates
        const validationErrors: string[] = [];
        
        if (updates.plan && !['pro', 'max5', 'max20', 'custom'].includes(updates.plan)) {
          validationErrors.push('plan must be one of: pro, max5, max20, custom');
        }
        
        if (updates.custom_limit_tokens !== undefined && updates.custom_limit_tokens !== null) {
          if (!Number.isInteger(updates.custom_limit_tokens) || updates.custom_limit_tokens <= 0) {
            validationErrors.push('custom_limit_tokens must be a positive integer');
          }
        }
        
        if (updates.view && !['realtime', 'daily', 'monthly', 'session'].includes(updates.view)) {
          validationErrors.push('view must be one of: realtime, daily, monthly, session');
        }
        
        if (updates.time_format && !['12h', '24h', 'auto'].includes(updates.time_format)) {
          validationErrors.push('time_format must be one of: 12h, 24h, auto');
        }
        
        if (updates.theme && !['light', 'dark', 'classic', 'auto'].includes(updates.theme)) {
          validationErrors.push('theme must be one of: light, dark, classic, auto');
        }
        
        if (updates.refresh_rate !== undefined) {
          if (!Number.isInteger(updates.refresh_rate) || updates.refresh_rate < 1 || updates.refresh_rate > 60) {
            validationErrors.push('refresh_rate must be an integer between 1 and 60');
          }
        }
        
        if (updates.refresh_per_second !== undefined) {
          if (typeof updates.refresh_per_second !== 'number' || updates.refresh_per_second < 0.1 || updates.refresh_per_second > 20.0) {
            validationErrors.push('refresh_per_second must be a number between 0.1 and 20.0');
          }
        }
        
        if (updates.reset_hour !== undefined && updates.reset_hour !== null) {
          if (!Number.isInteger(updates.reset_hour) || updates.reset_hour < 0 || updates.reset_hour > 23) {
            validationErrors.push('reset_hour must be an integer between 0 and 23');
          }
        }
        
        if (validationErrors.length > 0) {
          return new Response(JSON.stringify({ 
            error: 'Validation failed',
            validation_errors: validationErrors
          }), {
            status: 400,
            headers: { ...headers, 'Content-Type': 'application/json' }
          });
        }
        
        // Try to update configuration via Python bridge first
        const bridgeResult = await updateBridgeUsageConfig(updates);
        
        if (bridgeResult.success && bridgeResult.data) {
          // Bridge update succeeded, also update local database
          const localSuccess = updateUsageConfig(updates);
          if (!localSuccess) {
            console.warn('Bridge config updated but local database update failed');
          }
          
          return new Response(JSON.stringify({
            success: true,
            message: 'Configuration updated successfully via bridge',
            data: bridgeResult.data.data,
            fromBridge: true
          }), {
            headers: { ...headers, 'Content-Type': 'application/json' }
          });
        }
        
        // Bridge failed or unavailable, update local database only
        console.log('Bridge unavailable, updating local configuration only');
        const success = updateUsageConfig(updates);
        if (!success) {
          return new Response(JSON.stringify({ 
            error: 'Failed to update configuration',
            detail: 'Database update failed'
          }), {
            status: 500,
            headers: { ...headers, 'Content-Type': 'application/json' }
          });
        }
        
        // Return the updated configuration
        const updatedConfig = getUsageConfig();
        return new Response(JSON.stringify({
          success: true,
          message: 'Configuration updated successfully (local only)',
          data: updatedConfig,
          fromBridge: false
        }), {
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Error updating usage config:', error);
        return new Response(JSON.stringify({ 
          error: 'Invalid request body',
          detail: error instanceof Error ? error.message : 'Failed to parse JSON'
        }), {
          status: 400,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
    }
    
    // GET /api/usage/sessions - Get usage session history via Python bridge proxy
    if (url.pathname === '/api/usage/sessions' && req.method === 'GET') {
      try {
        const hoursBack = parseInt(url.searchParams.get('hours_back') || '24');
        const limit = parseInt(url.searchParams.get('limit') || '100');
        const sessionId = url.searchParams.get('session_id') || undefined;
        
        // Validate parameters
        if (isNaN(hoursBack) || hoursBack < 1 || hoursBack > 720) { // Max 30 days
          return new Response(JSON.stringify({ 
            error: 'Invalid hours_back parameter',
            detail: 'hours_back must be between 1 and 720 (30 days)'
          }), {
            status: 400,
            headers: { ...headers, 'Content-Type': 'application/json' }
          });
        }
        
        if (isNaN(limit) || limit < 1 || limit > 1000) {
          return new Response(JSON.stringify({ 
            error: 'Invalid limit parameter',
            detail: 'limit must be between 1 and 1000'
          }), {
            status: 400,
            headers: { ...headers, 'Content-Type': 'application/json' }
          });
        }
        
        // Try to get sessions from Python bridge first
        const bridgeResult = await getBridgeUsageSessions(sessionId, limit, hoursBack);
        
        if (bridgeResult.success && bridgeResult.data) {
          return new Response(JSON.stringify(bridgeResult.data), {
            headers: { 
              ...headers, 
              'Content-Type': 'application/json',
              'X-Data-Source': bridgeResult.fromBridge ? 'bridge' : 'mock'
            }
          });
        }
        
        // Fallback to local database if bridge is unavailable
        console.log('Bridge unavailable, falling back to local snapshots');
        const snapshots = getUsageSnapshots(sessionId, limit, hoursBack);
        
        // Transform snapshots to session format
        const sessions = snapshots.map(snapshot => {
          try {
            const data = JSON.parse(snapshot.snapshot_data);
            return {
              id: snapshot.id,
              session_id: snapshot.session_id,
              snapshot_type: snapshot.snapshot_type,
              timestamp: snapshot.timestamp,
              data: data
            };
          } catch (parseError) {
            console.error('Error parsing snapshot data:', parseError);
            return {
              id: snapshot.id,
              session_id: snapshot.session_id,
              snapshot_type: snapshot.snapshot_type,
              timestamp: snapshot.timestamp,
              data: null,
              error: 'Failed to parse snapshot data'
            };
          }
        });
        
        return new Response(JSON.stringify({
          sessions,
          total_count: sessions.length,
          hours_back: hoursBack,
          limit: limit,
          session_id: sessionId || null
        }), {
          headers: { 
            ...headers, 
            'Content-Type': 'application/json',
            'X-Data-Source': 'database'
          }
        });
      } catch (error) {
        console.error('Error getting usage sessions:', error);
        return new Response(JSON.stringify({ 
          error: 'Failed to retrieve usage sessions',
          detail: error instanceof Error ? error.message : 'Unknown error'
        }), {
          status: 500,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
    }
    
    // POST /api/usage/config/reset - Reset usage configuration to defaults
    if (url.pathname === '/api/usage/config/reset' && req.method === 'POST') {
      try {
        const success = resetUsageConfig();
        if (!success) {
          return new Response(JSON.stringify({ 
            error: 'Failed to reset configuration',
            detail: 'Database update failed'
          }), {
            status: 500,
            headers: { ...headers, 'Content-Type': 'application/json' }
          });
        }
        
        const resetConfig = getUsageConfig();
        return new Response(JSON.stringify({
          success: true,
          message: 'Configuration reset to defaults successfully',
          data: resetConfig
        }), {
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Error resetting usage config:', error);
        return new Response(JSON.stringify({ 
          error: 'Failed to reset configuration',
          detail: error instanceof Error ? error.message : 'Unknown error'
        }), {
          status: 500,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
    }
    
    // WebSocket upgrade
    if (url.pathname === '/stream') {
      const success = server.upgrade(req);
      if (success) {
        return undefined;
      }
    }
    
    // Default response
    return new Response('Multi-Agent Observability Server', {
      headers: { ...headers, 'Content-Type': 'text/plain' }
    });
  },
  
  websocket: {
    async open(ws) {
      console.log('WebSocket client connected');
      wsClients.add(ws);
      
      // Send recent events on connection
      const events = getRecentEvents(50);
      const initialMessage: WebSocketMessage = {
        type: 'initial',
        data: { events },
        timestamp: Date.now()
      };
      ws.send(JSON.stringify(initialMessage));
      
      // Also send current usage stats if available
      try {
        const usageResult = await getBridgeUsageStats();
        if (usageResult.success && usageResult.data) {
          const usageMessage: WebSocketMessage = {
            type: 'usage_update',
            data: usageResult.data,
            timestamp: Date.now()
          };
          ws.send(JSON.stringify(usageMessage));
        }
      } catch (error) {
        console.warn('Failed to send initial usage data:', error);
      }
    },
    
    async message(ws, message) {
      try {
        const parsedMessage = JSON.parse(message.toString());
        console.log('Received WebSocket message:', parsedMessage);
        
        // Handle client requests for usage updates
        if (parsedMessage.type === 'request_usage_update') {
          const sessionId = parsedMessage.session_id;
          await broadcastUsageUpdate(sessionId || 'unknown');
        }
        
        // Handle ping/pong for connection health
        if (parsedMessage.type === 'ping') {
          const pongMessage: WebSocketMessage = {
            type: 'pong',
            data: { timestamp: Date.now() },
            timestamp: Date.now()
          };
          ws.send(JSON.stringify(pongMessage));
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    },
    
    close(ws) {
      console.log('WebSocket client disconnected');
      wsClients.delete(ws);
    },
    
    error(ws, error) {
      console.error('WebSocket error:', error);
      wsClients.delete(ws);
    }
  }
});

console.log(`🚀 Server running on http://localhost:${server.port}`);
console.log(`📊 WebSocket endpoint: ws://localhost:${server.port}/stream`);
console.log(`📮 POST events to: http://localhost:${server.port}/events`);
console.log(`⚡ Usage API endpoints (with Python bridge integration):`);
console.log(`   GET  /api/usage/stats - Current usage statistics (proxied to bridge)`);
console.log(`   GET  /api/usage/config - Usage configuration`);
console.log(`   POST /api/usage/config - Update configuration (bridge + local)`);
console.log(`   POST /api/usage/config/reset - Reset configuration`);
console.log(`   GET  /api/usage/sessions - Session history (bridge + fallback)`);
console.log(`   GET  /api/usage/bridge/status - Python bridge health status`);
console.log(`🌉 Python bridge: ${getBridgeStatus().enabled ? getBridgeStatus().url : 'disabled'}`);

// Check bridge health on startup
checkBridgeHealth().then(isHealthy => {
  console.log(`🔗 Bridge status: ${isHealthy ? '✅ healthy' : '❌ unavailable'}`);
});