# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Multi-Agent Observability System** that provides real-time monitoring and visualization for Claude Code agents through comprehensive hook event tracking. The project is designed to integrate with **Claude-Code-Usage-Monitor** (located at `../Claude-Code-Usage-Monitor`) to create a unified web dashboard for comprehensive Claude Code monitoring.

## Architecture

The system follows a distributed architecture:
```
Claude Agents ’ Hook Scripts ’ HTTP POST ’ Bun Server ’ SQLite ’ WebSocket ’ Vue Client
                                         “
                               Python Bridge ’ Claude Monitor ’ Usage Data
```

### Key Components
- **Server** (`apps/server/`): Bun TypeScript server with HTTP/WebSocket endpoints and SQLite database
- **Client** (`apps/client/`): Vue 3 TypeScript application with real-time visualization
- **Hook System** (`.claude/hooks/`): Python scripts that intercept Claude Code lifecycle events
- **Usage Bridge** (planned): Python FastAPI service for integrating Claude-Code-Usage-Monitor

## Development Commands

### System Management
```bash
# Start entire system (server + client)
./scripts/start-system.sh

# Stop all processes  
./scripts/reset-system.sh

# Test system functionality
./scripts/test-system.sh
```

### Server Development
```bash
cd apps/server

# Development with hot reload
bun run dev

# Production start
bun run start

# Type checking
bun run typecheck
```

### Client Development  
```bash
cd apps/client

# Development server
bun run dev

# Build for production
bun run build

# Preview production build
bun run preview
```

### Testing
```bash
# Test event endpoint manually
curl -X POST http://localhost:4000/events \
  -H "Content-Type: application/json" \
  -d '{"source_app":"test","session_id":"test-123","hook_event_type":"PreToolUse","payload":{"tool_name":"Bash","tool_input":{"command":"ls"}}}'

# Test hook scripts
cd apps/demo-cc-agent
echo '{"session_id":"test","tool_name":"Bash","tool_input":{"command":"echo test"}}' | \
  uv run .claude/hooks/send_event.py --source-app demo --event-type PreToolUse
```

## Technology Stack

### Server (apps/server/)
- **Runtime**: Bun (not Node.js)
- **Language**: TypeScript
- **Database**: SQLite with WAL mode
- **API**: Native Bun.serve() with WebSocket support
- **Key Dependencies**: sqlite, sqlite3

**Important**: Always use Bun commands instead of npm/node:
- `bun run dev` instead of `npm run dev`
- `bun install` instead of `npm install`
- `bun src/index.ts` instead of `node src/index.ts`

### Client (apps/client/)
- **Framework**: Vue 3 with Composition API
- **Build Tool**: Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Key Features**: WebSocket real-time updates, theme management, event filtering

### Hook System (.claude/hooks/)
- **Language**: Python 3.8+ with uv package manager
- **Purpose**: Intercepts Claude Code lifecycle events and sends them to the observability server
- **Key Scripts**: 
  - `send_event.py`: Universal event sender
  - `pre_tool_use.py`: Tool validation & blocking
  - `post_tool_use.py`: Result logging
  - `user_prompt_submit.py`: User prompt logging

## Claude-Code-Usage-Monitor Integration

The project is designed to integrate with the Claude-Code-Usage-Monitor located at `../Claude-Code-Usage-Monitor`. This integration should be **dynamic** - properties are read from the monitor project (read-only) rather than copied.

### Integration Architecture (PDK.md Implementation)

The planned integration involves:

1. **Python Bridge Service** (`apps/usage-bridge/`):
   - FastAPI service that integrates Claude-Code-Usage-Monitor as a library
   - Provides REST endpoints for usage statistics and configuration
   - Acts as a proxy between the web UI and the terminal-based monitor

2. **Database Extensions**:
   - `usage_config` table for storing web UI configuration
   - `usage_snapshots` table for historical usage data
   - Links usage data with existing event data via session IDs

3. **Web UI Components**:
   - Usage dashboard with progress bars and real-time statistics
   - Configuration panel for all monitor parameters
   - Session correlation linking events with usage data

### Key Integration Points

- **Dynamic Configuration**: Monitor parameters are read from the Claude-Code-Usage-Monitor project, not hardcoded
- **Real-time Updates**: Usage data flows through WebSocket alongside event data
- **Session Correlation**: Events and usage data are linked by session ID for comprehensive monitoring

## Database Schema

### Core Tables (existing)
```sql
events (
  id INTEGER PRIMARY KEY,
  source_app TEXT,
  session_id TEXT,
  hook_event_type TEXT,
  payload TEXT, -- JSON
  timestamp INTEGER,
  summary TEXT
)
```

### Planned Usage Tables
```sql
usage_config (
  id INTEGER PRIMARY KEY,
  plan TEXT DEFAULT 'custom',
  custom_limit_tokens INTEGER,
  view TEXT DEFAULT 'realtime',
  timezone TEXT DEFAULT 'auto',
  -- ... other configuration fields
)

usage_snapshots (
  id INTEGER PRIMARY KEY,
  session_id TEXT,
  data TEXT, -- JSON serialized UsageStats
  timestamp INTEGER,
  FOREIGN KEY (session_id) REFERENCES events(session_id)
)
```

## API Endpoints

### Current Server Endpoints
- `POST /events` - Receive events from Claude agents
- `GET /events/recent` - Paginated event retrieval with filtering
- `GET /events/filter-options` - Available filter values for UI
- `WS /stream` - Real-time event broadcasting via WebSocket

### Planned Usage Endpoints
- `GET /api/usage/stats` - Current usage statistics (proxied from Python bridge)
- `POST /api/usage/config` - Update usage configuration
- `GET /api/usage/sessions` - Usage sessions with event correlation

## Configuration

### Environment Variables
Copy `.env.sample` to `.env` and configure:
- `ANTHROPIC_API_KEY` - Required for AI features
- `ENGINEER_NAME` - For logging/identification
- `GEMINI_API_KEY` - Optional, for multi-model support
- `OPENAI_API_KEY` - Optional, for AI features
- `ELEVEN_API_KEY` - Optional, for audio features

### Client Configuration
In `apps/client/.env`:
- `VITE_MAX_EVENTS_TO_DISPLAY=100` - Maximum events to display

### Hook Configuration
The `.claude/settings.json` file configures which hooks run for different Claude Code events. Each project using the observability system should copy the `.claude` directory and update the `--source-app` parameter to identify their project.

## Development Guidelines

### Code Architecture
- **Server**: Follows modular architecture with separation of concerns
- **Client**: Uses Vue 3 Composition API with TypeScript
- **Hooks**: Python scripts with error handling and validation
- **Database**: SQLite with proper indexing and WAL mode for concurrent access

### Event Types
| Event Type | Purpose | Special Display |
|------------|---------|-----------------|
| PreToolUse | Before tool execution | Tool name & details |
| PostToolUse | After tool completion | Tool results |
| Notification | User interactions | Notification message |
| Stop | Response completion | Summary & chat history |
| SubagentStop | Subagent finished | Subagent details |
| UserPromptSubmit | User prompt submission | Prompt content (italic) |

### Security Features
- Blocks dangerous commands (`rm -rf`, etc.)
- Prevents access to sensitive files (`.env`, private keys)
- Input validation on all endpoints
- No external dependencies for core functionality

## Troubleshooting

### Common Issues
1. **Hook scripts not working**: Use absolute paths in `.claude/settings.json` or run `/convert_paths_absolute` command
2. **Port conflicts**: Use `./scripts/reset-system.sh` to stop all processes
3. **Database issues**: SQLite database is in `apps/server/events.db` (gitignored)
4. **WebSocket connection issues**: Ensure server is running on port 4000

### Development Setup Issues
- **Bun not found**: Install Bun from https://bun.sh/
- **uv not found**: Install uv from https://docs.astral.sh/uv/
- **Python dependencies**: Ensure Python 3.8+ is available for hook scripts

## Project Integration

To integrate this observability system into other Claude Code projects:

1. Copy the entire `.claude` directory to the target project
2. Update `--source-app` parameter in all hook commands in `.claude/settings.json`
3. Ensure the observability server is running (`./scripts/start-system.sh`)
4. Events will automatically flow to the dashboard at http://localhost:5173

This creates comprehensive monitoring across multiple Claude Code projects with centralized visualization and real-time updates.