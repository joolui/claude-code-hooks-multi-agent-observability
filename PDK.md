# Project Development Kit (PDK): Usage Monitor Integration

## Project Overview

This document outlines the integration of **Claude-Code-Usage-Monitor** (terminal-based Python usage tracking) with **claude-code-hooks-multi-agent-observability** (web-based event monitoring) to create a unified web dashboard for comprehensive Claude Code monitoring.

### Current State
- **Claude-Code-Usage-Monitor**: Terminal application with real-time token usage, cost tracking, burn rate analysis, and ML-based predictions
- **Multi-Agent Observability**: Web application with event timeline, WebSocket updates, and theme management

### Goal
Create a unified web interface that combines:
- Real-time usage statistics and cost tracking
- Event monitoring and session correlation
- Configurable parameters via web UI
- Maintainable architecture that stays synchronized with upstream updates

## Architecture Design

### High-Level Architecture
```
Claude Config Files → Python Bridge → REST API → Bun Server → WebSocket → Vue Client
                                       ↓
                                 SQLite Database (config + events + usage)
```

### Component Structure
```
claude-code-hooks-multi-agent-observability/
├── apps/
│   ├── server/              # Existing Bun server (extended)
│   │   ├── src/
│   │   │   ├── index.ts     # Extended with usage endpoints
│   │   │   ├── db.ts        # Extended with usage_config table
│   │   │   ├── usage.ts     # New: Usage data management
│   │   │   └── types.ts     # Extended with usage types
│   │   └── package.json
│   │
│   ├── client/              # Existing Vue client (extended)
│   │   ├── src/
│   │   │   ├── App.vue      # Extended with usage tab
│   │   │   ├── components/
│   │   │   │   ├── UsageDashboard.vue      # New: Main usage interface
│   │   │   │   ├── UsageProgressBars.vue   # New: Progress visualization
│   │   │   │   ├── UsageConfigPanel.vue    # New: Parameter configuration
│   │   │   │   ├── UsageStats.vue          # New: Real-time statistics
│   │   │   │   └── SessionCorrelation.vue  # New: Event-usage linking
│   │   │   ├── composables/
│   │   │   │   ├── useUsageData.ts         # New: Usage data management
│   │   │   │   └── useUsageConfig.ts       # New: Configuration management
│   │   │   └── types.ts     # Extended with usage types
│   │   └── package.json
│   │
│   └── usage-bridge/        # New Python service
│       ├── main.py          # FastAPI service
│       ├── requirements.txt # Python dependencies
│       ├── models.py        # Pydantic models
│       ├── config.py        # Configuration management
│       └── monitor.py       # Claude monitor integration
│
└── Claude-Code-Usage-Monitor/  # Git submodule (read-only)
```

## Data Models and Types

### Usage Data Types (TypeScript)
```typescript
interface UsageEntry {
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

interface SessionBlock {
  id: string;
  start_time: number;
  end_time: number;
  is_active: boolean;
  token_counts: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_tokens: number;
    cache_read_tokens: number;
    total_tokens: number;
  };
  cost_usd: number;
  burn_rate?: {
    tokens_per_minute: number;
    cost_per_hour: number;
  };
  models: string[];
  sent_messages_count: number;
  per_model_stats: Record<string, any>;
}

interface UsageConfig {
  id?: number;
  plan: 'pro' | 'max5' | 'max20' | 'custom';
  custom_limit_tokens?: number;
  view: 'realtime' | 'daily' | 'monthly';
  timezone: string;
  time_format: '12h' | '24h' | 'auto';
  theme: 'light' | 'dark' | 'classic' | 'auto';
  refresh_rate: number; // 1-60 seconds
  refresh_per_second: number; // 0.1-20.0 Hz
  reset_hour?: number; // 0-23
  created_at: number;
  updated_at: number;
}

interface UsageStats {
  current_session?: SessionBlock;
  recent_sessions: SessionBlock[];
  predictions: {
    tokens_run_out: number; // timestamp
    limit_resets_at: number; // timestamp
  };
  burn_rate: {
    tokens_per_minute: number;
    cost_per_hour: number;
  };
  totals: {
    cost_percentage: number;
    token_percentage: number;
    message_percentage: number;
    time_to_reset_percentage: number;
  };
}
```

## Database Schema Extensions

### New Table: usage_config
```sql
CREATE TABLE IF NOT EXISTS usage_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan TEXT NOT NULL DEFAULT 'custom',
  custom_limit_tokens INTEGER,
  view TEXT NOT NULL DEFAULT 'realtime',
  timezone TEXT NOT NULL DEFAULT 'auto',
  time_format TEXT NOT NULL DEFAULT 'auto',
  theme TEXT NOT NULL DEFAULT 'auto',
  refresh_rate INTEGER NOT NULL DEFAULT 10,
  refresh_per_second REAL NOT NULL DEFAULT 0.75,
  reset_hour INTEGER,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);
```

### New Table: usage_snapshots
```sql
CREATE TABLE IF NOT EXISTS usage_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT,
  data TEXT NOT NULL, -- JSON serialized UsageStats
  timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (session_id) REFERENCES events(session_id)
);
```

## API Endpoints Design

### Python Bridge Service (FastAPI)
**Base URL**: `http://localhost:8001`

```python
# GET /usage/stats - Get current usage statistics
# Query params: plan, timezone, reset_hour, etc.
@app.get("/usage/stats")
async def get_usage_stats(config: UsageConfigQuery) -> UsageStats

# GET /usage/config - Get current configuration
@app.get("/usage/config")
async def get_usage_config() -> UsageConfig

# POST /usage/config - Update configuration
@app.post("/usage/config")
async def update_usage_config(config: UsageConfig) -> UsageConfig

# GET /usage/sessions - Get session history
@app.get("/usage/sessions")
async def get_usage_sessions(hours_back: int = 24) -> List[SessionBlock]
```

### Bun Server Extensions
**Extended endpoints in existing server**:

```typescript
// GET /api/usage/stats - Proxy to Python bridge
// POST /api/usage/config - Store config in SQLite + proxy to Python bridge
// GET /api/usage/sessions - Get usage sessions with event correlation
// WebSocket /stream - Extended to broadcast usage updates
```

## Configuration UI Specifications

### UsageConfigPanel Component
```vue
<template>
  <div class="usage-config-panel">
    <!-- Plan Selection -->
    <div class="config-section">
      <label>Plan Type</label>
      <select v-model="config.plan">
        <option value="pro">Claude Pro (~19K tokens)</option>
        <option value="max5">Claude Max5 (~88K tokens)</option>
        <option value="max20">Claude Max20 (~220K tokens)</option>
        <option value="custom">Custom (P90 auto-detect)</option>
      </select>
      
      <!-- Custom Token Limit (show when plan === 'custom') -->
      <input v-if="config.plan === 'custom'" 
             v-model="config.custom_limit_tokens" 
             type="number" 
             placeholder="Custom token limit" />
    </div>

    <!-- View Mode -->
    <div class="config-section">
      <label>View Mode</label>
      <div class="button-group">
        <button @click="config.view = 'realtime'" 
                :class="{ active: config.view === 'realtime' }">
          Real-time
        </button>
        <button @click="config.view = 'daily'" 
                :class="{ active: config.view === 'daily' }">
          Daily
        </button>
        <button @click="config.view = 'monthly'" 
                :class="{ active: config.view === 'monthly' }">
          Monthly
        </button>
      </div>
    </div>

    <!-- Time Settings -->
    <div class="config-section">
      <label>Timezone</label>
      <select v-model="config.timezone">
        <option value="auto">Auto-detect</option>
        <option value="UTC">UTC</option>
        <option value="America/New_York">US Eastern</option>
        <option value="Europe/London">London</option>
        <option value="Asia/Tokyo">Tokyo</option>
      </select>
      
      <label>Time Format</label>
      <select v-model="config.time_format">
        <option value="auto">Auto</option>
        <option value="12h">12 Hour</option>
        <option value="24h">24 Hour</option>
      </select>
    </div>

    <!-- Refresh Settings -->
    <div class="config-section">
      <label>Data Refresh Rate: {{ config.refresh_rate }}s</label>
      <input type="range" 
             v-model="config.refresh_rate" 
             min="1" 
             max="60" 
             step="1" />
      
      <label>Display Refresh Rate: {{ config.refresh_per_second }}Hz</label>
      <input type="range" 
             v-model="config.refresh_per_second" 
             min="0.1" 
             max="20" 
             step="0.1" />
    </div>

    <!-- Reset Hour -->
    <div class="config-section">
      <label>Daily Reset Hour</label>
      <select v-model="config.reset_hour">
        <option :value="null">Auto (based on timezone)</option>
        <option v-for="hour in 24" :key="hour" :value="hour-1">
          {{ hour-1 }}:00
        </option>
      </select>
    </div>
  </div>
</template>
```

## Usage Dashboard Components

### UsageDashboard.vue - Main Interface
Recreates the terminal interface with web components:
- Session-based dynamic limits display
- Cost usage progress bar (green/yellow/red states)
- Token usage progress bar with percentage
- Messages usage progress bar
- Time to reset countdown
- Model distribution chart
- Burn rate and cost rate real-time display
- Predictions section

### UsageProgressBars.vue - Progress Visualization
```vue
<template>
  <div class="usage-progress-bars">
    <!-- Cost Usage Bar -->
    <div class="progress-item">
      <div class="progress-label">
        <span class="emoji">💰</span>
        <span class="title">Cost Usage:</span>
        <span class="percentage">{{ costPercentage }}%</span>
        <span class="values">${{ currentCost }} / ${{ maxCost }}</span>
      </div>
      <div class="progress-bar" :class="costStatus">
        <div class="progress-fill" :style="{ width: costPercentage + '%' }"></div>
      </div>
    </div>

    <!-- Token Usage Bar -->
    <div class="progress-item">
      <div class="progress-label">
        <span class="emoji">🔢</span>
        <span class="title">Token Usage:</span>
        <span class="percentage">{{ tokenPercentage }}%</span>
        <span class="values">{{ currentTokens }} / {{ maxTokens }}</span>
      </div>
      <div class="progress-bar" :class="tokenStatus">
        <div class="progress-fill" :style="{ width: tokenPercentage + '%' }"></div>
      </div>
    </div>

    <!-- Messages Usage Bar -->
    <div class="progress-item">
      <div class="progress-label">
        <span class="emoji">💬</span>
        <span class="title">Messages Usage:</span>
        <span class="percentage">{{ messagePercentage }}%</span>
        <span class="values">{{ currentMessages }} / {{ maxMessages }}</span>
      </div>
      <div class="progress-bar" :class="messageStatus">
        <div class="progress-fill" :style="{ width: messagePercentage + '%' }"></div>
      </div>
    </div>

    <!-- Time to Reset -->
    <div class="progress-item">
      <div class="progress-label">
        <span class="emoji">⏰</span>
        <span class="title">Time to Reset:</span>
        <span class="time-remaining">{{ timeToReset }}</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill time-fill" :style="{ width: timePercentage + '%' }"></div>
      </div>
    </div>
  </div>
</template>
```

## Implementation Phases

### Phase 1: Foundation (Week 1)
1. **Python Bridge Service**
   - Create FastAPI service in `apps/usage-bridge/`
   - Integrate Claude-Code-Usage-Monitor as library/submodule
   - Implement basic endpoints: `/usage/stats`, `/usage/config`
   - Add configuration management

2. **Database Extensions**
   - Add `usage_config` table to existing SQLite database
   - Add `usage_snapshots` table for historical data
   - Implement migration system

3. **Bun Server Extensions**
   - Add usage endpoints that proxy to Python bridge
   - Extend WebSocket system to broadcast usage updates
   - Add usage data types to existing TypeScript interfaces

### Phase 2: Basic UI (Week 2)
1. **Configuration Panel**
   - Create `UsageConfigPanel.vue` with all parameter controls
   - Implement form validation and persistence
   - Add configuration modal/sidebar to main interface

2. **Usage Tab**
   - Add "Usage Monitor" tab to main navigation
   - Create basic `UsageDashboard.vue` component
   - Implement real-time data fetching via WebSocket

3. **Progress Bars**
   - Create `UsageProgressBars.vue` component
   - Implement color-coded progress visualization
   - Add responsive design for mobile

### Phase 3: Advanced Features (Week 3)
1. **Real-time Statistics**
   - Create `UsageStats.vue` for burn rate and predictions
   - Add model distribution visualization
   - Implement live updates with configurable refresh rates

2. **Session Correlation**
   - Create `SessionCorrelation.vue` component
   - Link hook events with usage data by session ID
   - Add filtering: show events from high-usage sessions

3. **Historical Views**
   - Implement daily and monthly view modes
   - Add usage history charts and tables
   - Create export functionality

### Phase 4: Polish (Week 4)
1. **Theme Integration**
   - Integrate usage components with existing theme system
   - Add usage-specific color schemes
   - Ensure consistent styling across components

2. **Mobile Optimization**
   - Optimize usage dashboard for mobile devices
   - Add responsive layouts and touch interactions
   - Test across different screen sizes

3. **Performance**
   - Implement efficient data caching
   - Optimize WebSocket updates
   - Add loading states and error handling

## Development Setup

### Prerequisites
- **Python 3.9+** with `uv` package manager
- **Bun** for JavaScript/TypeScript
- **Git** with submodule support

### Installation Steps
```bash
# 1. Set up the Python bridge service
cd apps/usage-bridge
uv venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
uv pip install fastapi uvicorn pydantic

# 2. Add Claude-Code-Usage-Monitor as submodule
git submodule add https://github.com/Maciek-roboblog/Claude-Code-Usage-Monitor.git

# 3. Install monitor dependencies in bridge environment
cd Claude-Code-Usage-Monitor
uv pip install -e .

# 4. Install/update existing dependencies
cd ../apps/server
bun install

cd ../apps/client
bun install
```

### Development Commands
```bash
# Start Python bridge service
cd apps/usage-bridge
uvicorn main:app --host 0.0.0.0 --port 8001 --reload

# Start existing observability system
./scripts/start-system.sh

# Or manually:
cd apps/server && bun run dev
cd apps/client && bun run dev
```

## Testing Strategy

### Unit Tests
- **Python Bridge**: Test usage data parsing and API endpoints
- **Vue Components**: Test configuration UI and data visualization
- **Integration**: Test data flow between services

### Integration Tests
- **End-to-End**: Test complete workflow from configuration to visualization
- **WebSocket**: Test real-time updates and connection handling
- **Database**: Test configuration persistence and usage snapshots

### Manual Testing Checklist
- [ ] Configuration UI saves and loads parameters correctly
- [ ] Usage dashboard displays real-time statistics
- [ ] Progress bars update with accurate percentages
- [ ] Session correlation links events with usage data
- [ ] Theme integration works across usage components
- [ ] Mobile interface is responsive and functional
- [ ] All parameter combinations work correctly
- [ ] Error handling gracefully manages service failures

## Maintainability Strategy

### Staying Updated with Upstream
1. **Git Submodules**: Claude-Code-Usage-Monitor as read-only submodule
2. **Library Integration**: Use monitor as Python library, not copy-paste
3. **Parameter Discovery**: Generic configuration system that auto-detects new parameters
4. **API Abstraction**: Python bridge abstracts monitor internals from web UI

### Code Organization
- **Separation of Concerns**: Each service has single responsibility
- **Type Safety**: Comprehensive TypeScript types for all data structures
- **Documentation**: Inline documentation and usage examples
- **Version Control**: Tag releases and maintain changelog

### Future Enhancements
- **Plugin System**: Allow custom usage visualization plugins
- **Multi-Instance**: Monitor multiple Claude Code instances simultaneously
- **Alerting**: Email/webhook notifications for usage thresholds
- **Analytics**: Historical usage analysis and optimization suggestions

## Getting Started Checklist

After restarting Claude Code with MCPs:

1. [ ] Review this PDK document thoroughly
2. [ ] Set up development environment per setup instructions
3. [ ] Create Python bridge service foundation
4. [ ] Extend database schema with usage tables
5. [ ] Add basic usage endpoints to Bun server
6. [ ] Create configuration UI components
7. [ ] Implement usage dashboard with progress bars
8. [ ] Test integration between services
9. [ ] Add real-time updates via WebSocket
10. [ ] Polish UI and add mobile support

This document serves as your complete development guide for integrating the Claude usage monitor with the web-based observability system.