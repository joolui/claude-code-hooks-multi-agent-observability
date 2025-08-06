# Multi-Agent Observability Client

A Vue 3 TypeScript application providing real-time monitoring and visualization for Claude Code agents through comprehensive hook event tracking and usage statistics management.

## Features

### 🚀 **Real-Time Monitoring**
- **Event Timeline**: Live visualization of Claude Code hook events with filtering and search
- **Usage Dashboard**: Real-time usage statistics with progress bars and alerts
- **WebSocket Integration**: Dual WebSocket streams for events and usage data
- **Live Pulse Chart**: Visual representation of system activity and performance

### 📊 **Usage Management**
- **Multi-Plan Support**: Pro, Max 5, Max 20, and custom plan configurations
- **Usage Progress Bars**: Color-coded progress indicators for cost, tokens, and messages
- **Configuration Panel**: Comprehensive settings for refresh rates, timezones, and notifications
- **Persistent Configuration**: Local storage with import/export capabilities

### 🎨 **User Interface**
- **Theme Management**: Multiple themes with custom theme creation
- **Responsive Design**: Mobile-first design with adaptive layouts
- **Accessibility**: WCAG 2.1 AA compliant with screen reader support
- **Tab Navigation**: Keyboard-accessible tabbed interface

## Technology Stack

- **Framework**: Vue 3 with Composition API
- **Language**: TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Real-time**: WebSocket connections with automatic reconnection
- **State Management**: Vue 3 reactive system with composables

## Architecture

### Component Structure
```
src/
├── components/
│   ├── EventTimeline.vue          # Main event visualization
│   ├── UsageDashboard.vue         # Usage statistics dashboard
│   ├── UsageProgressBars.vue      # Progress indicators with accessibility
│   ├── UsageConfigPanel.vue       # Configuration management
│   ├── FilterPanel.vue            # Event filtering controls
│   ├── LivePulseChart.vue         # Real-time activity visualization
│   └── ThemeManager.vue           # Theme customization
├── composables/
│   ├── useWebSocket.ts            # Event stream WebSocket
│   ├── useUsageWebSocket.ts       # Usage data WebSocket (legacy)
│   ├── useUsageData.ts            # Usage statistics management
│   ├── useUsageConfig.ts          # Configuration persistence
│   ├── useThemes.ts               # Theme management
│   └── index.ts                   # Centralized exports
└── types/
    └── index.ts                   # TypeScript type definitions
```

### WebSocket Integration
The application maintains two WebSocket connections:
1. **Event Stream** (`ws://localhost:4000/stream`) - Real-time hook events
2. **Usage Stream** (`ws://localhost:4000/usage/stream`) - Usage statistics and metrics

## Composables API

### `useUsageData()`
Manages real-time usage statistics with comprehensive error handling.

```typescript
const {
  // State
  currentStats,      // Current usage statistics
  historicalData,    // Historical usage snapshots
  realTimeMetrics,   // Live performance metrics
  planInfo,          // Current plan information
  isConnected,       // WebSocket connection status
  error,             // Error messages
  
  // Methods
  refreshData,       // Manual data refresh
  connect,           // Establish WebSocket connection
  disconnect,        // Close WebSocket connection
  clearError         // Clear error state
} = useUsageData()
```

### `useUsageConfig()`
Provides persistent configuration management with validation.

```typescript
const {
  // Configuration
  config,            // Reactive configuration object
  planOptions,       // Available plan options
  currentPlan,       // Current selected plan
  validationErrors,  // Form validation errors
  
  // State
  isValid,           // Configuration validity
  hasUnsavedChanges, // Dirty state tracking
  
  // Methods
  updateConfig,      // Update configuration
  validateAndSave,   // Validate and persist
  exportConfig,      // Export configuration JSON
  importConfig,      // Import configuration JSON
  resetToDefaults    // Reset to default values
} = useUsageConfig()
```

### Configuration Options

The usage configuration supports comprehensive customization:

```typescript
interface UsageConfig {
  // Plan Configuration
  plan: 'pro' | 'max5' | 'max20' | 'custom'
  customTokenLimit: number
  customMessageLimit: number
  customCostLimit: number
  
  // View Configuration
  viewMode: 'realtime' | 'daily' | 'monthly'
  timezone: string
  timeFormat: '12h' | '24h'
  
  // Refresh Configuration
  refreshRate: number        // milliseconds
  autoRefresh: boolean
  
  // Notification Configuration
  enableWarnings: boolean
  warningThreshold: number   // percentage
  enableCriticalAlerts: boolean
  criticalThreshold: number  // percentage
  
  // Advanced Configuration
  enableHistoricalData: boolean
  historicalDataDays: number
  enableRealTimeMetrics: boolean
  enableWebSocketConnection: boolean
  webSocketUrl: string
}
```

## Development

### Prerequisites
- **Bun** (recommended) or Node.js 18+
- Modern browser with WebSocket support

### Setup
```bash
# Install dependencies
bun install

# Start development server
bun run dev

# Build for production
bun run build

# Preview production build
bun run preview
```

### Environment Variables
Create a `.env` file in the client directory:
```env
VITE_MAX_EVENTS_TO_DISPLAY=100
VITE_WEBSOCKET_URL=ws://localhost:4000/stream
VITE_USAGE_WEBSOCKET_URL=ws://localhost:4000/usage/stream
```

## Usage Dashboard Features

### Progress Bars
- **Color-coded Status**: Green (safe), Yellow (warning), Red (critical)
- **Accessibility**: WCAG 2.1 AA compliant with ARIA labels and screen reader support
- **Real-time Updates**: Live progress tracking with percentage overlays
- **Time to Reset**: Visual countdown with precise time remaining

### Configuration Panel
- **Plan Selection**: Radio button interface with plan details
- **Custom Limits**: Configurable token, message, and cost limits
- **View Modes**: Real-time, daily, and monthly update frequencies
- **Timezone Support**: Global timezone selection with auto-detection
- **Refresh Rates**: Configurable update intervals from 1s to 5min

### Real-time Metrics
- **Active Sessions**: Current connected users
- **Request Rate**: API calls per minute
- **Response Time**: Average response latency
- **Error Rate**: Percentage of failed requests
- **Uptime**: System availability statistics

## Error Handling & Resilience

### WebSocket Reconnection
- **Exponential Backoff**: Progressive delay between reconnection attempts
- **Maximum Retries**: Configurable retry limits with fallback behavior
- **Connection Health**: Heartbeat monitoring with ping/pong messages
- **Graceful Degradation**: Cached data when WebSocket is unavailable

### Data Validation
- **Real-time Validation**: Immediate feedback on configuration changes
- **Type Safety**: Comprehensive TypeScript interfaces
- **Error Recovery**: Automatic rollback on validation failures
- **User Feedback**: Clear error messages and success notifications

## Integration with Multi-Agent System

This client is designed to work with the Multi-Agent Observability Server:

### Event Types Supported
- **PreToolUse**: Before tool execution with tool details
- **PostToolUse**: After tool completion with results
- **UserPromptSubmit**: User prompt submissions
- **Notification**: System notifications and alerts
- **Stop**: Response completion with summaries
- **SubagentStop**: Subagent completion events

### Usage Data Integration
- **Session Correlation**: Links usage data with event sessions
- **Historical Tracking**: Long-term usage pattern analysis
- **Real-time Monitoring**: Live usage statistics and alerts
- **Configuration Sync**: Persistent settings across sessions

## Accessibility Features

### WCAG 2.1 AA Compliance
- **Screen Reader Support**: Comprehensive ARIA labels and live regions
- **Keyboard Navigation**: Full keyboard accessibility with focus management
- **High Contrast**: Support for high contrast and reduced motion preferences  
- **Color Independence**: Information conveyed through multiple channels
- **Responsive Text**: Scalable typography and layout

### Interactive Features
- **Live Announcements**: Progress updates announced to screen readers
- **Status Indicators**: Visual and auditory feedback for system state
- **Error Handling**: Accessible error messages and recovery options
- **Navigation**: Consistent tab order and navigation patterns

## Performance Optimizations

### Efficient Data Handling
- **Event Batching**: Grouped WebSocket message processing
- **Memory Management**: Automatic cleanup of historical data
- **Lazy Loading**: Progressive component loading
- **Caching**: Strategic caching of configuration and theme data

### Resource Management
- **Connection Pooling**: Efficient WebSocket connection reuse
- **Update Throttling**: Configurable refresh rates to manage CPU usage
- **Token Optimization**: Minimal data transfer with compression
- **Background Processing**: Non-blocking data processing

## Contributing

### Code Style
- **Vue 3 Composition API**: Modern reactive patterns
- **TypeScript**: Strict type checking enabled
- **ESLint + Prettier**: Consistent code formatting
- **Conventional Commits**: Structured commit message format

### Testing
- **Unit Tests**: Component and composable testing
- **Integration Tests**: WebSocket and API integration
- **Accessibility Tests**: Screen reader and keyboard navigation
- **Performance Tests**: Memory usage and rendering performance

### Development Guidelines
1. Follow existing component patterns and naming conventions
2. Maintain accessibility standards in all UI components  
3. Add TypeScript types for all new interfaces
4. Test WebSocket integration with both success and failure scenarios
5. Document new composables and their usage patterns

## License

This project is part of the Multi-Agent Observability System and follows the same licensing terms as the parent project.