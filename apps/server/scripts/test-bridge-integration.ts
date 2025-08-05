#!/usr/bin/env bun
/**
 * Bridge Integration Test Suite
 * 
 * Tests the Python bridge integration functionality:
 * - Bridge proxy endpoints
 * - Fallback to mock data
 * - WebSocket usage updates
 * - Error handling and validation
 */

const API_BASE = 'http://localhost:4000';
const WS_BASE = 'ws://localhost:4000';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  response?: any;
}

class BridgeIntegrationTester {
  private results: TestResult[] = [];

  private async makeRequest(method: string, path: string, body?: any): Promise<Response> {
    const url = `${API_BASE}${path}`;
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    return fetch(url, options);
  }

  private async testEndpoint(name: string, testFn: () => Promise<void>): Promise<void> {
    try {
      await testFn();
      this.results.push({ name, passed: true });
      console.log(`✅ ${name}`);
    } catch (error) {
      this.results.push({ 
        name, 
        passed: false, 
        error: error instanceof Error ? error.message : String(error) 
      });
      console.log(`❌ ${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async testBridgeStatus(): Promise<void> {
    await this.testEndpoint('GET /api/usage/bridge/status - Bridge status check', async () => {
      const response = await this.makeRequest('GET', '/api/usage/bridge/status');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Validate response structure
      const requiredFields = ['enabled', 'url', 'timeout', 'retries', 'healthy', 'timestamp'];
      for (const field of requiredFields) {
        if (!(field in data)) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      console.log(`    Bridge enabled: ${data.enabled}`);
      console.log(`    Bridge URL: ${data.url}`);
      console.log(`    Bridge healthy: ${data.healthy}`);
    });
  }

  async testBridgeUsageStats(): Promise<void> {
    await this.testEndpoint('GET /api/usage/stats - Bridge proxy with fallback', async () => {
      const response = await this.makeRequest('GET', '/api/usage/stats');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const dataSource = response.headers.get('X-Data-Source');
      
      // Validate response structure
      if (!data.current_session || !data.predictions || !data.burn_rate || !data.totals) {
        throw new Error('Missing required fields in response');
      }

      console.log(`    Data source: ${dataSource}`);
      console.log(`    Session ID: ${data.current_session?.id}`);
      console.log(`    Total tokens: ${data.current_session?.token_counts?.total_tokens}`);
    });

    await this.testEndpoint('GET /api/usage/stats - Bridge proxy with config override', async () => {
      const response = await this.makeRequest('GET', '/api/usage/stats?plan=pro&theme=dark');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const dataSource = response.headers.get('X-Data-Source');
      
      // Check that configuration was applied
      if (data.config_applied && data.config_applied.plan !== 'pro') {
        throw new Error('Config override not applied correctly');
      }

      console.log(`    Data source: ${dataSource}`);
      console.log(`    Config applied: ${JSON.stringify(data.config_applied)}`);
    });
  }

  async testBridgeUsageSessions(): Promise<void> {
    await this.testEndpoint('GET /api/usage/sessions - Bridge proxy with database fallback', async () => {
      const response = await this.makeRequest('GET', '/api/usage/sessions?hours_back=24&limit=10');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const dataSource = response.headers.get('X-Data-Source');
      
      // Validate response structure
      if (!Array.isArray(data.sessions)) {
        throw new Error('sessions is not an array');
      }

      if (typeof data.total_count !== 'number') {
        throw new Error('total_count is not a number');
      }

      console.log(`    Data source: ${dataSource}`);
      console.log(`    Sessions count: ${data.sessions.length}`);
      console.log(`    Total count: ${data.total_count}`);
    });
  }

  async testBridgeConfigUpdate(): Promise<void> {
    await this.testEndpoint('POST /api/usage/config - Bridge config update with local sync', async () => {
      const updateData = {
        plan: 'pro',
        theme: 'dark',
        refresh_rate: 30
      };

      const response = await this.makeRequest('POST', '/api/usage/config', updateData);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`HTTP ${response.status}: ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error('Update reported as failed');
      }

      if (!data.data) {
        throw new Error('Updated config not returned');
      }

      // Check if it came from bridge
      console.log(`    From bridge: ${data.fromBridge}`);
      console.log(`    Message: ${data.message}`);
      console.log(`    Updated plan: ${data.data.plan}`);
    });
  }

  async testWebSocketUsageUpdates(): Promise<void> {
    await this.testEndpoint('WebSocket - Usage update broadcasting', async () => {
      return new Promise((resolve, reject) => {
        const ws = new WebSocket(`${WS_BASE}/stream`);
        let receivedInitial = false;
        let receivedUsageUpdate = false;
        const timeout = 10000; // 10 seconds

        const timer = setTimeout(() => {
          ws.close();
          reject(new Error('WebSocket test timed out'));
        }, timeout);

        ws.onopen = () => {
          console.log('    WebSocket connected');
          
          // Request a usage update
          ws.send(JSON.stringify({
            type: 'request_usage_update',
            session_id: 'test-session-ws'
          }));
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            console.log(`    Received message type: ${message.type}`);

            if (message.type === 'initial') {
              receivedInitial = true;
              console.log(`    Initial events count: ${message.data?.events?.length || 0}`);
            } else if (message.type === 'usage_update') {
              receivedUsageUpdate = true;
              console.log(`    Usage update - session: ${message.data?.current_session?.id}`);
              console.log(`    Usage update - tokens: ${message.data?.current_session?.token_counts?.total_tokens}`);
            }

            // Complete test if we received both types
            if (receivedInitial && receivedUsageUpdate) {
              clearTimeout(timer);
              ws.close();
              resolve();
            }
          } catch (parseError) {
            clearTimeout(timer);
            ws.close();
            reject(new Error(`Failed to parse WebSocket message: ${parseError}`));
          }
        };

        ws.onerror = (error) => {
          clearTimeout(timer);
          reject(new Error(`WebSocket error: ${error}`));
        };

        ws.onclose = () => {
          console.log('    WebSocket disconnected');
        };
      });
    });
  }

  async testErrorHandling(): Promise<void> {
    await this.testEndpoint('Error handling - Invalid bridge requests', async () => {
      // Test with invalid parameters that should trigger validation
      const response = await this.makeRequest('GET', '/api/usage/sessions?hours_back=999999&limit=999999');
      
      if (response.ok) {
        throw new Error('Invalid parameters were accepted');
      }

      if (response.status !== 400) {
        throw new Error(`Expected 400, got ${response.status}`);
      }

      const data = await response.json();
      if (!data.error) {
        throw new Error('Error message not returned');
      }

      console.log(`    Error correctly handled: ${data.error}`);
    });

    await this.testEndpoint('Error handling - Bridge configuration validation', async () => {
      const invalidConfig = {
        plan: 'invalid_plan',
        refresh_rate: 999
      };

      const response = await this.makeRequest('POST', '/api/usage/config', invalidConfig);
      
      if (response.ok) {
        throw new Error('Invalid config was accepted');
      }

      if (response.status !== 400) {
        throw new Error(`Expected 400, got ${response.status}`);
      }

      const data = await response.json();
      if (!data.validation_errors || !Array.isArray(data.validation_errors)) {
        throw new Error('Validation errors not returned properly');
      }

      console.log(`    Validation errors: ${data.validation_errors.length} errors found`);
    });
  }

  async runAllTests(): Promise<void> {
    console.log('🧪 Starting Bridge Integration Test Suite');
    console.log('=' .repeat(60));
    console.log();

    // Wait a moment to ensure server is ready
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
      await this.testBridgeStatus();
      await this.testBridgeUsageStats();
      await this.testBridgeUsageSessions();
      await this.testBridgeConfigUpdate();
      await this.testWebSocketUsageUpdates();
      await this.testErrorHandling();
    } catch (error) {
      console.error('❌ Test suite failed:', error);
    }

    console.log();
    console.log('=' .repeat(60));
    this.printSummary();
  }

  private printSummary(): void {
    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;
    const failed = this.results.filter(r => !r.passed);

    console.log(`📊 Bridge Integration Test Results: ${passed}/${total} passed`);
    
    if (failed.length > 0) {
      console.log('\\n❌ Failed Tests:');
      failed.forEach(test => {
        console.log(`   • ${test.name}: ${test.error}`);
      });
    }

    if (passed === total) {
      console.log('🎉 All bridge integration tests passed!');
      console.log('🌉 Python bridge integration is working correctly');
      process.exit(0);
    } else {
      console.log('⚠️  Some bridge integration tests failed!');
      console.log('🔧 Check bridge configuration and connectivity');
      process.exit(1);
    }
  }
}

async function checkServerHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/api/usage/config`);
    return response.status !== 0; // Any response means server is up
  } catch (error) {
    return false;
  }
}

async function main(): Promise<void> {
  // Check if server is running
  const serverUp = await checkServerHealth();
  if (!serverUp) {
    console.error('❌ Server is not running. Please start the server first:');
    console.error('   cd apps/server && bun run dev');
    process.exit(1);
  }

  const tester = new BridgeIntegrationTester();
  await tester.runAllTests();
}

// Handle both direct execution and module import
if (import.meta.main) {
  main();
}