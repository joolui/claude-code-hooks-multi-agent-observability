#!/bin/bash
# Usage Bridge Service Startup Script

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting Usage Bridge Service${NC}"

# Check if virtual environment exists
if [[ ! -d ".venv" ]]; then
    echo -e "${YELLOW}⚠️  Virtual environment not found. Creating...${NC}"
    python3 -m venv .venv
fi

# Activate virtual environment
echo -e "${BLUE}📦 Activating virtual environment${NC}"
source .venv/bin/activate

# Install/upgrade dependencies
echo -e "${BLUE}📥 Installing dependencies${NC}"
pip install -q --upgrade pip
pip install -q -r requirements.txt

# Check if Claude Monitor is available (prioritize submodule)
CLAUDE_MONITOR_SUBMODULE="${SCRIPT_DIR}/../../Claude-Code-Usage-Monitor"
CLAUDE_MONITOR_EXTERNAL="${SCRIPT_DIR}/../../../Claude-Code-Usage-Monitor"

if [[ -d "$CLAUDE_MONITOR_SUBMODULE/src/claude_monitor" ]]; then
    echo -e "${GREEN}✅ Claude Monitor submodule found at: $CLAUDE_MONITOR_SUBMODULE${NC}"
    # Install Claude Monitor from submodule in development mode
    pip install -q -e "$CLAUDE_MONITOR_SUBMODULE"
elif [[ -d "$CLAUDE_MONITOR_EXTERNAL/src/claude_monitor" ]]; then
    echo -e "${GREEN}✅ Claude Monitor found at: $CLAUDE_MONITOR_EXTERNAL${NC}"
    # Install Claude Monitor in development mode
    pip install -q -e "$CLAUDE_MONITOR_EXTERNAL"
else
    echo -e "${YELLOW}⚠️  Claude Monitor not found at expected paths:${NC}"
    echo -e "${YELLOW}   - Submodule: $CLAUDE_MONITOR_SUBMODULE${NC}"
    echo -e "${YELLOW}   - External: $CLAUDE_MONITOR_EXTERNAL${NC}"
    echo -e "${YELLOW}   Service will run but return empty data${NC}"
fi

# Set environment variables for development
export BRIDGE_DEBUG=true
export BRIDGE_LOG_LEVEL=INFO
export BRIDGE_HOST=0.0.0.0
export BRIDGE_PORT=8001

# Check if port is already in use
if lsof -Pi :8001 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${RED}❌ Port 8001 is already in use${NC}"
    echo -e "${YELLOW}   Kill existing process: lsof -ti:8001 | xargs kill -9${NC}"
    exit 1
fi

echo -e "${GREEN}🌐 Starting FastAPI server on http://localhost:8001${NC}"
echo -e "${BLUE}📚 API documentation available at: http://localhost:8001/docs${NC}"
echo -e "${BLUE}🔍 Health check: http://localhost:8001/health${NC}"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop the service${NC}"
echo ""

# Start the service
uvicorn main:app --host "$BRIDGE_HOST" --port "$BRIDGE_PORT" --reload