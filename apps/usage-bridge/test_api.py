"""
Basic tests for the Usage Bridge API service.
"""

import pytest
from fastapi.testclient import TestClient
from datetime import datetime

from main import app
from models import UsageConfig, UsageStats

client = TestClient(app)


def test_health_endpoint():
    """Test health check endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    
    data = response.json()
    assert "status" in data
    assert "claude_monitor_available" in data
    assert "uptime_seconds" in data


def test_root_endpoint():
    """Test root endpoint."""
    response = client.get("/")
    assert response.status_code == 200
    
    data = response.json()
    assert data["service"] == "Claude Usage Monitor Bridge"
    assert "version" in data
    assert "endpoints" in data


def test_get_usage_config():
    """Test getting usage configuration."""
    response = client.get("/usage/config")
    assert response.status_code == 200
    
    data = response.json()
    # Validate required fields
    assert "plan" in data
    assert "view" in data
    assert "timezone" in data
    assert "theme" in data
    assert "refresh_rate" in data


def test_update_usage_config():
    """Test updating usage configuration."""
    config_data = {
        "plan": "custom",
        "custom_limit_tokens": 50000,
        "view": "realtime",
        "timezone": "UTC",
        "time_format": "24h",
        "theme": "dark",
        "refresh_rate": 5,
        "refresh_per_second": 1.0,
        "reset_hour": 0
    }
    
    response = client.post("/usage/config", json=config_data)
    assert response.status_code == 200
    
    data = response.json()
    assert data["plan"] == "custom"
    assert data["custom_limit_tokens"] == 50000
    assert data["view"] == "realtime"


def test_invalid_config_validation():
    """Test configuration validation with invalid data."""
    invalid_config = {
        "plan": "invalid_plan",
        "view": "realtime",
        "refresh_rate": -1  # Invalid negative value
    }
    
    response = client.post("/usage/config", json=invalid_config)
    assert response.status_code == 422


def test_get_usage_stats():
    """Test getting usage statistics."""
    response = client.get("/usage/stats")
    assert response.status_code == 200
    
    data = response.json()
    # Should have basic structure even if Claude Monitor is not available
    assert "current_session" in data
    assert "recent_sessions" in data
    assert "predictions" in data
    assert "burn_rate" in data
    assert "totals" in data


def test_get_usage_stats_with_params():
    """Test getting usage statistics with query parameters."""
    response = client.get("/usage/stats?plan=pro&timezone=UTC&view=daily")
    assert response.status_code == 200
    
    data = response.json()
    assert "current_session" in data
    assert "recent_sessions" in data


def test_get_usage_sessions():
    """Test getting usage session history."""
    response = client.get("/usage/sessions")
    assert response.status_code == 200
    
    data = response.json()
    assert isinstance(data, list)


def test_get_usage_sessions_with_hours_back():
    """Test getting usage session history with custom hours back."""
    response = client.get("/usage/sessions?hours_back=48")
    assert response.status_code == 200
    
    data = response.json()
    assert isinstance(data, list)


def test_invalid_hours_back():
    """Test invalid hours_back parameter."""
    response = client.get("/usage/sessions?hours_back=0")
    assert response.status_code == 422


def test_validate_config_endpoint():
    """Test configuration validation endpoint."""
    config_data = {
        "plan": "pro",
        "view": "realtime",
        "timezone": "UTC",
        "theme": "light",
        "refresh_rate": 10
    }
    
    response = client.get("/usage/validate-config", params=config_data)
    assert response.status_code == 200
    
    data = response.json()
    # Should return validation result
    assert isinstance(data, dict)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])