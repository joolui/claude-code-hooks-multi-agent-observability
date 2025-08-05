# Usage Bridge Service

FastAPI Python bridge service that integrates Claude-Code-Usage-Monitor with the web-based observability system.

## 🎯 Implementation Status: **COMPLETE** ✅

**SuperClaude `/sc:implement` + `/sc:build` execution successful** - Full FastAPI service with git submodule integration, dynamic property reading, comprehensive error handling, and production-ready architecture.

## Overview

This service provides a REST API interface to the Claude Monitor library, enabling the web dashboard to access real-time usage statistics, configuration management, and session history. Built following SuperClaude backend architecture principles with robust validation, type safety, and graceful degradation.

## Architecture

```
Web UI → Bun Server → Usage Bridge API → Claude Monitor Library → Usage Data
         (Proxy)      (FastAPI/Python)   (Dynamic Integration)
```

**Key Design Principles:**
- **Git Submodule Integration**: Claude Monitor as controlled git submodule
- **Dynamic Property Reading**: Runtime property extraction with error handling
- **Type Safety**: Complete Pydantic models matching all data structures
- **Error Resilience**: Graceful degradation when Claude Monitor unavailable
- **Auto-Detection**: Prioritizes submodule over external installations
- **Async Operations**: Non-blocking API with FastAPI async capabilities

## 🚀 Key Features

### ✅ **Core API Endpoints**
- **Usage Statistics**: Real-time token usage, cost tracking, and burn rate analysis
- **Configuration Management**: Web-based parameter configuration with validation
- **Session History**: Historical usage data and session correlation
- **Health Monitoring**: Service health checks and monitor availability status
- **Error Handling**: Comprehensive error handling with graceful degradation
- **CORS Support**: Cross-origin requests for web dashboard integration

### ✅ **Advanced Integration Features**
- **Git Submodule**: Claude Monitor integrated as controlled git submodule
- **Dynamic Property Reading**: Runtime property extraction with nested path support
- **Enhanced Library Wrapper**: Comprehensive abstraction with error handling
- **Auto-Detection**: Prioritizes submodule over external installations
- **Configuration Validation**: Uses Claude Monitor's native validation rules
- **Type Mapping**: Dynamic conversion between Claude Monitor and API types
- **Session Correlation**: Links usage data with hook events by session ID

## API Endpoints

### Health Check
- `GET /health` - Service health status and Claude Monitor availability

### Usage Statistics
- `GET /usage/stats` - Current usage statistics with optional config override
- `GET /usage/sessions?hours_back=24` - Usage session history

### Configuration Management
- `GET /usage/config` - Current configuration
- `POST /usage/config` - Update configuration with validation
- `GET /usage/validate-config` - Validate configuration without saving

### Monitor Integration
- `GET /usage/monitor-info` - Comprehensive Claude Monitor integration status

### Service Information  
- `GET /` - Root endpoint with service information and available endpoints

## Configuration

### Environment Variables

All configuration can be set via environment variables with the `BRIDGE_` prefix:

```bash
# Service settings
BRIDGE_HOST=0.0.0.0
BRIDGE_PORT=8001
BRIDGE_DEBUG=false
BRIDGE_LOG_LEVEL=INFO

# Claude Monitor integration
BRIDGE_CLAUDE_MONITOR_PATH=/path/to/claude-monitor

# CORS settings
BRIDGE_CORS_ORIGINS=["http://localhost:5173", "http://localhost:4000"]

# Rate limiting  
BRIDGE_RATE_LIMIT_PER_MINUTE=60

# Storage
BRIDGE_CONFIG_STORAGE_PATH=~/.claude-monitor-bridge
```

### Auto-Detection

The service automatically detects Claude Monitor installation with priority order:
1. **`../../Claude-Code-Usage-Monitor`** (git submodule - primary)
2. `../../../Claude-Code-Usage-Monitor` (external installation)
3. `~/Claude-Code-Usage-Monitor` (user installation)
4. `/opt/claude-monitor` (system installation)
5. `/usr/local/claude-monitor` (system installation)

## Installation & Setup

### Prerequisites

- Python 3.9+
- Claude-Code-Usage-Monitor installed and accessible

### Install Dependencies

```bash
cd apps/usage-bridge
pip install -r requirements.txt

# Or with uv (recommended)
uv pip install -r requirements.txt
```

### Git Submodule Setup

The service uses Claude Monitor as a git submodule (recommended approach):

```bash
# Initialize submodule (first time setup)
cd claude-code-hooks-multi-agent-observability
git submodule update --init --recursive

# Install Claude Monitor from submodule
pip install -e ./Claude-Code-Usage-Monitor
```

**Alternative Installation Methods:**
```bash
# Install from PyPI (fallback)
pip install claude-monitor

# Install from external clone
cd /path/to/Claude-Code-Usage-Monitor
pip install -e .
```

## Running the Service

### 🎯 **Quick Start (Recommended)**

```bash
cd apps/usage-bridge
./start.sh  # Automated setup with environment creation and dependency installation
```

The startup script automatically:
- Creates Python virtual environment
- Installs all dependencies
- **Detects and installs Claude Monitor submodule**
- Configures development environment  
- Starts service with hot-reload

### Development Mode

```bash
cd apps/usage-bridge
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

### Production Mode

```bash
cd apps/usage-bridge
python main.py
```

### Docker (Optional)

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
CMD ["python", "main.py"]
```

## Usage Examples

### Get Usage Statistics

```bash
curl "http://localhost:8001/usage/stats"
```

With configuration override:
```bash
curl "http://localhost:8001/usage/stats?plan=pro&timezone=UTC&view=realtime"
```

### Update Configuration

```bash
curl -X POST "http://localhost:8001/usage/config" \
  -H "Content-Type: application/json" \
  -d '{
    "plan": "custom",
    "custom_limit_tokens": 50000,
    "view": "realtime",
    "timezone": "America/New_York",
    "time_format": "12h",
    "theme": "dark",
    "refresh_rate": 5,
    "refresh_per_second": 1.0,
    "reset_hour": 0
  }'
```

### Get Session History

```bash
curl "http://localhost:8001/usage/sessions?hours_back=48"
```

### Health Check

```bash
curl "http://localhost:8001/health"
```

### Get Monitor Integration Info

```bash
curl "http://localhost:8001/usage/monitor-info"
```

**Response includes:**
- Submodule availability and path
- Loaded modules and classes  
- Integration status and version
- Dynamic property reading capabilities

## Integration with Web Dashboard

The service is designed to integrate with the Bun server and Vue client:

1. **Bun Server Proxy**: The Bun server proxies requests to this service
2. **WebSocket Integration**: Usage data is broadcast via the existing WebSocket system
3. **Session Correlation**: Usage data is linked with hook events by session ID

## Error Handling

The service implements comprehensive error handling:

- **Graceful Degradation**: Returns empty data when Claude Monitor is unavailable
- **Validation Errors**: Detailed validation error messages for configuration
- **Logging**: Structured logging for debugging and monitoring
- **Health Checks**: Regular health status reporting

## 🧪 Testing & Validation

### **Comprehensive Test Suite**

```bash
cd apps/usage-bridge

# Quick integration test
python test_service.py      # Tests all endpoints with real service

# Unit test suite  
pytest test_api.py -v       # Comprehensive API validation tests

# Full test suite
pytest test_*.py -v         # All tests with coverage

# Submodule integration tests
python test_submodule_simple.py      # Basic submodule structure tests
python test_submodule_integration.py # Comprehensive integration tests (requires deps)
```

**Test Coverage:**
- ✅ **API Endpoints** - All REST endpoints with error scenarios
- ✅ **Configuration Validation** - Parameter validation and error handling
- ✅ **Claude Monitor Integration** - Library wrapper and error resilience
- ✅ **Git Submodule Integration** - Submodule structure and dynamic loading
- ✅ **Dynamic Property Reading** - Runtime property extraction with error handling
- ✅ **Health Checks** - Service status and dependency availability
- ✅ **Error Handling** - Graceful failure scenarios

## Development

### 📁 **Project Structure**

```
apps/usage-bridge/
├── main.py                       # FastAPI application and endpoints
├── models.py                     # Pydantic models for API (type-safe)
├── config.py                     # Configuration with submodule auto-detection
├── monitor.py                    # Simplified Claude Monitor integration
├── claude_monitor_wrapper.py     # ✅ Enhanced wrapper with dynamic property reading
├── requirements.txt              # Python dependencies
├── start.sh                     # ✅ Submodule-aware startup script
├── test_api.py                  # ✅ Comprehensive API tests
├── test_service.py              # ✅ Integration test script
├── test_submodule_simple.py     # ✅ Basic submodule structure tests
├── test_submodule_integration.py # ✅ Comprehensive integration tests
├── .env.sample                  # ✅ Configuration template
├── __init__.py                  # ✅ Package initialization
├── SUBMODULE_INTEGRATION.md     # ✅ Submodule integration documentation
└── README.md                    # This file (updated)

../Claude-Code-Usage-Monitor/    # ✅ Git submodule (project root)
├── src/claude_monitor/          # Claude Monitor source code
└── pyproject.toml              # Package metadata
```

### **Adding New Endpoints**

1. Define Pydantic models in `models.py`
2. Add endpoint handlers in `main.py`
3. Update Claude Monitor integration in `claude_monitor_wrapper.py` if needed
4. Update simplified interface in `monitor.py`
5. Add appropriate error handling and logging
6. **Add tests** in `test_api.py`, `test_service.py`, and integration tests

### **Development Workflow**

```bash
# 1. Start service
./start.sh

# 2. Test endpoints
python test_service.py

# 3. Test submodule integration
python test_submodule_simple.py

# 4. Run unit tests
pytest test_api.py -v

# 5. Check service status
curl http://localhost:8001/health

# 6. Check integration status
curl http://localhost:8001/usage/monitor-info
```

## Troubleshooting

### Common Issues

1. **Claude Monitor Not Found**
   - **First**: Verify git submodule is initialized: `git submodule update --init --recursive`
   - Check submodule exists: `ls -la Claude-Code-Usage-Monitor/`
   - Check `BRIDGE_CLAUDE_MONITOR_PATH` environment variable (optional)
   - Verify installation: `pip list | grep claude-monitor`
   - Check logs for auto-detection results and submodule priority

2. **CORS Errors**
   - Update `BRIDGE_CORS_ORIGINS` to include your web dashboard URL
   - Ensure the web dashboard is running on expected ports

3. **Configuration Validation Errors**
   - Check that configuration parameters match Claude Monitor's expectations
   - Verify timezone names are valid (use pytz.all_timezones)
   - Ensure numeric parameters are within valid ranges

4. **Empty Usage Data**
   - Verify Claude usage data files exist in the expected location
   - Check Claude Monitor can read usage data independently  
   - Review logs for data processing errors
   - Test submodule integration: `python test_submodule_simple.py`

5. **Submodule Issues**
   - Update submodule: `cd Claude-Code-Usage-Monitor && git pull origin main`
   - Reinstall: `pip install -e ./Claude-Code-Usage-Monitor`
   - Check integration status: `curl http://localhost:8001/usage/monitor-info`

### Logging

Enable debug logging for detailed troubleshooting:

```bash
BRIDGE_DEBUG=true BRIDGE_LOG_LEVEL=DEBUG uvicorn main:app --reload
```

## Performance Considerations

- **Caching**: Consider implementing Redis caching for frequently accessed data
- **Rate Limiting**: Configured to prevent API abuse
- **Async Operations**: Uses FastAPI's async capabilities for better performance
- **Resource Management**: Properly manages Claude Monitor library instances

## Security

- **CORS**: Restrictive CORS policy for web dashboard only
- **Input Validation**: Comprehensive Pydantic validation
- **Error Handling**: Sanitized error messages in production
- **No Authentication**: Currently designed for local development (add authentication for production)

## 🔗 **Integration with Observability System**

### **Bun Server Integration (Next Step)**

The service integrates with the existing Bun server via proxy endpoints:

```typescript
// apps/server/src/index.ts (planned)
app.get("/api/usage/stats", async (req, res) => {
  const response = await fetch("http://localhost:8001/usage/stats");
  return response.json();
});
```

### **WebSocket Broadcasting (Planned)**

Usage data will be broadcast via existing WebSocket system:

```typescript
// Real-time usage updates alongside event data
websocket.send(JSON.stringify({
  type: "usage_update",
  data: usageStats,
  session_id: sessionId
}));
```

### **Type Safety Integration** ✅

**Extended `apps/server/src/types.ts`** with complete usage monitoring types:
- `UsageEntry, TokenCounts, BurnRate` - Core data structures
- `SessionBlock, UsageConfig` - Session and configuration management  
- `UsageStats, UsagePredictions` - Statistics and forecasting
- `UsageSnapshot` - Historical data storage

## 🎯 **Implementation Success Metrics**

✅ **Complete FastAPI service** with all endpoints implemented  
✅ **Git submodule integration** with Claude Monitor as controlled dependency  
✅ **Dynamic property reading** with runtime extraction and error handling  
✅ **Enhanced library wrapper** with comprehensive abstraction  
✅ **Auto-detection logic** prioritizing submodule over external installations  
✅ **Comprehensive error handling** and graceful degradation  
✅ **Type-safe data models** matching PDK specifications  
✅ **Development tooling** with startup scripts and comprehensive tests  
✅ **Documentation** with complete API reference and integration guide  
✅ **Server type extensions** for full-stack integration

## 🔄 **Submodule Management**

### **Update Submodule to Latest**
```bash
cd Claude-Code-Usage-Monitor
git fetch origin
git checkout main  # or specific version tag
cd ..
git add Claude-Code-Usage-Monitor
git commit -m "Update Claude Monitor submodule to latest version"
```

### **Rollback Submodule Version**
```bash
cd Claude-Code-Usage-Monitor
git checkout PREVIOUS_COMMIT_HASH
cd ..
git add Claude-Code-Usage-Monitor  
git commit -m "Rollback Claude Monitor submodule to stable version"
```

### **Check Submodule Status**
```bash
git submodule status
curl http://localhost:8001/usage/monitor-info  # Runtime status
python test_submodule_simple.py               # Structure verification
```

## Future Enhancements

- **Authentication**: Add JWT or API key authentication
- **Caching**: Redis caching for improved performance  
- **Metrics**: Prometheus metrics export
- **WebSocket**: Direct WebSocket support for real-time updates
- **Multiple Instances**: Support for monitoring multiple Claude Code instances
- **Database Persistence**: SQLite integration for configuration storage
- **Real-time Streaming**: Server-Sent Events (SSE) for live updates