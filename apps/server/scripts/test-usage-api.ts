#!/usr/bin/env bun
/**
 * Usage API Test Suite
 * 
 * Comprehensive testing for all usage API endpoints:
 * - GET /api/usage/stats
 * - GET /api/usage/config
 * - POST /api/usage/config
 * - POST /api/usage/config/reset
 * - GET /api/usage/sessions
 */

const API_BASE = 'http://localhost:4000';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  response?: any;
}

class UsageApiTester {
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

  async testGetUsageStats(): Promise<void> {
    await this.testEndpoint('GET /api/usage/stats - Basic request', async () => {
      const response = await this.makeRequest('GET', '/api/usage/stats');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Validate response structure
      if (!data.current_session || !data.predictions || !data.burn_rate || !data.totals) {
        throw new Error('Missing required fields in response');
      }

      if (typeof data.totals.cost_percentage !== 'number') {
        throw new Error('Invalid cost_percentage type');
      }
    });

    await this.testEndpoint('GET /api/usage/stats - With config parameters', async () => {
      const response = await this.makeRequest('GET', '/api/usage/stats?plan=pro&theme=dark&refresh_rate=30');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Check that configuration was applied
      if (!data.config_applied) {
        throw new Error('config_applied not present in response');
      }

      if (data.config_applied.plan !== 'pro') {
        throw new Error('Plan override not applied correctly');
      }
    });

    await this.testEndpoint('GET /api/usage/stats - Invalid parameters', async () => {
      const response = await this.makeRequest('GET', '/api/usage/stats?plan=invalid&refresh_rate=999');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Should ignore invalid parameters and use defaults
      if (data.config_applied.plan === 'invalid') {
        throw new Error('Invalid plan parameter was accepted');
      }
    });
  }

  async testGetUsageConfig(): Promise<void> {
    await this.testEndpoint('GET /api/usage/config - Basic request', async () => {
      const response = await this.makeRequest('GET', '/api/usage/config');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Validate required fields
      const requiredFields = ['id', 'plan', 'view', 'timezone', 'theme', 'refresh_rate', 'created_at', 'updated_at'];
      for (const field of requiredFields) {
        if (!(field in data)) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      // Validate field types and values
      if (!['pro', 'max5', 'max20', 'custom'].includes(data.plan)) {
        throw new Error(`Invalid plan value: ${data.plan}`);
      }

      if (typeof data.refresh_rate !== 'number' || data.refresh_rate < 1 || data.refresh_rate > 60) {
        throw new Error(`Invalid refresh_rate: ${data.refresh_rate}`);
      }
    });
  }

  async testPostUsageConfig(): Promise<void> {
    await this.testEndpoint('POST /api/usage/config - Valid update', async () => {
      const updateData = {
        plan: 'pro',
        theme: 'dark',
        refresh_rate: 30,
        custom_limit_tokens: 50000
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

      // Verify the update was applied
      if (data.data.plan !== 'pro' || data.data.theme !== 'dark' || data.data.refresh_rate !== 30) {
        throw new Error('Configuration was not updated correctly');
      }
    });

    await this.testEndpoint('POST /api/usage/config - Invalid plan', async () => {
      const updateData = { plan: 'invalid_plan' };
      const response = await this.makeRequest('POST', '/api/usage/config', updateData);
      
      if (response.ok) {
        throw new Error('Invalid plan was accepted');
      }

      if (response.status !== 400) {
        throw new Error(`Expected 400, got ${response.status}`);
      }

      const data = await response.json();
      if (!data.validation_errors || !Array.isArray(data.validation_errors)) {
        throw new Error('Validation errors not returned properly');
      }
    });

    await this.testEndpoint('POST /api/usage/config - Invalid refresh_rate', async () => {
      const updateData = { refresh_rate: 999 };
      const response = await this.makeRequest('POST', '/api/usage/config', updateData);
      
      if (response.ok) {
        throw new Error('Invalid refresh_rate was accepted');
      }

      if (response.status !== 400) {
        throw new Error(`Expected 400, got ${response.status}`);
      }
    });

    await this.testEndpoint('POST /api/usage/config - Invalid JSON', async () => {
      const response = await fetch(`${API_BASE}/api/usage/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json'
      });
      
      if (response.ok) {
        throw new Error('Invalid JSON was accepted');
      }

      if (response.status !== 400) {
        throw new Error(`Expected 400, got ${response.status}`);
      }
    });
  }

  async testPostUsageConfigReset(): Promise<void> {
    await this.testEndpoint('POST /api/usage/config/reset - Reset to defaults', async () => {
      const response = await this.makeRequest('POST', '/api/usage/config/reset');
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`HTTP ${response.status}: ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error('Reset reported as failed');
      }

      if (!data.data) {
        throw new Error('Reset config not returned');
      }

      // Verify defaults were applied
      if (data.data.plan !== 'custom' || data.data.view !== 'realtime' || data.data.theme !== 'auto') {
        throw new Error('Configuration was not reset to defaults correctly');
      }

      if (data.data.refresh_rate !== 10 || data.data.refresh_per_second !== 0.75) {
        throw new Error('Numeric defaults were not reset correctly');
      }
    });
  }

  async testGetUsageSessions(): Promise<void> {
    await this.testEndpoint('GET /api/usage/sessions - Basic request', async () => {
      const response = await this.makeRequest('GET', '/api/usage/sessions');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Validate response structure
      if (!Array.isArray(data.sessions)) {
        throw new Error('sessions is not an array');
      }

      if (typeof data.total_count !== 'number') {
        throw new Error('total_count is not a number');
      }

      if (data.hours_back !== 24) {
        throw new Error('Default hours_back not set correctly');
      }

      if (data.limit !== 100) {
        throw new Error('Default limit not set correctly');
      }
    });

    await this.testEndpoint('GET /api/usage/sessions - With parameters', async () => {
      const response = await this.makeRequest('GET', '/api/usage/sessions?hours_back=48&limit=50');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.hours_back !== 48) {
        throw new Error('hours_back parameter not applied');
      }

      if (data.limit !== 50) {
        throw new Error('limit parameter not applied');
      }
    });

    await this.testEndpoint('GET /api/usage/sessions - Invalid hours_back', async () => {
      const response = await this.makeRequest('GET', '/api/usage/sessions?hours_back=999');
      
      if (response.ok) {
        throw new Error('Invalid hours_back was accepted');
      }

      if (response.status !== 400) {
        throw new Error(`Expected 400, got ${response.status}`);
      }
    });

    await this.testEndpoint('GET /api/usage/sessions - Invalid limit', async () => {
      const response = await this.makeRequest('GET', '/api/usage/sessions?limit=9999');
      
      if (response.ok) {
        throw new Error('Invalid limit was accepted');
      }

      if (response.status !== 400) {
        throw new Error(`Expected 400, got ${response.status}`);
      }
    });

    await this.testEndpoint('GET /api/usage/sessions - With session_id filter', async () => {
      const response = await this.makeRequest('GET', '/api/usage/sessions?session_id=test-session-123');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.session_id !== 'test-session-123') {
        throw new Error('session_id filter not applied');
      }
    });
  }

  async runAllTests(): Promise<void> {
    console.log('🧪 Starting Usage API Test Suite');
    console.log('=' .repeat(50));
    console.log();

    // Wait a moment to ensure server is ready
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
      await this.testGetUsageStats();
      await this.testGetUsageConfig();
      await this.testPostUsageConfig();
      await this.testPostUsageConfigReset();
      await this.testGetUsageSessions();
    } catch (error) {
      console.error('❌ Test suite failed:', error);
    }

    console.log();
    console.log('=' .repeat(50));
    this.printSummary();
  }

  private printSummary(): void {
    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;
    const failed = this.results.filter(r => !r.passed);

    console.log(`📊 Test Results: ${passed}/${total} passed`);
    
    if (failed.length > 0) {
      console.log('\n❌ Failed Tests:');
      failed.forEach(test => {
        console.log(`   • ${test.name}: ${test.error}`);
      });
    }

    if (passed === total) {
      console.log('🎉 All tests passed!');
      process.exit(0);
    } else {
      console.log('⚠️  Some tests failed!');
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

  const tester = new UsageApiTester();
  await tester.runAllTests();
}

// Handle both direct execution and module import
if (import.meta.main) {
  main();
}