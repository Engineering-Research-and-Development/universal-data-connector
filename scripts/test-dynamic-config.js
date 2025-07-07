#!/usr/bin/env node

/**
 * Script per testare la configurazione dinamica del Universal Data Connector
 * Usage: node scripts/test-dynamic-config.js [--host localhost] [--port 3000]
 */

const axios = require('axios');

class DynamicConfigTester {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.apiUrl = `${baseUrl}/api/config`;
  }

  async testSourcesConfiguration() {
    console.log('\n=== Testing Dynamic Sources Configuration ===');
    
    try {
      // 1. Get current configuration
      console.log('1. Getting current sources configuration...');
      const currentConfig = await this.get('/sources');
      console.log(`   Current sources: ${currentConfig.data.sources.length}`);
      
      // 2. Test adding a new source
      console.log('2. Adding new test source...');
      const newSources = [
        {
          id: 'test-http-source',
          type: 'http',
          name: 'Test HTTP Source',
          enabled: true,
          config: {
            url: 'https://api.github.com/repos/microsoft/vscode',
            method: 'GET',
            interval: 30000,
            timeout: 5000
          }
        }
      ];
      
      const configureResult = await this.post('/sources/configure', { sources: newSources });
      console.log(`   ✓ Configuration applied: ${configureResult.data.message}`);
      console.log(`   ✓ Active connectors: ${configureResult.data.result.activeConnectors}`);
      
      // 3. Verify the configuration was applied
      console.log('3. Verifying configuration...');
      const updatedConfig = await this.get('/sources');
      console.log(`   ✓ Sources after update: ${updatedConfig.data.sources.length}`);
      
      // 4. Check engine status
      console.log('4. Checking engine status...');
      const engineStatus = await this.get('/engine/status');
      console.log(`   ✓ Engine running: ${engineStatus.data.engine.isRunning}`);
      console.log(`   ✓ Connectors: ${Object.keys(engineStatus.data.connectors).length}`);
      
      // 5. Test reload from original configuration
      console.log('5. Reloading original configuration...');
      const reloadResult = await this.post('/sources/reload', { sources: currentConfig.data.sources });
      console.log(`   ✓ Configuration reloaded: ${reloadResult.data.message}`);
      
      console.log('\n✅ Sources configuration test: PASSED');
      return true;
      
    } catch (error) {
      console.error('\n❌ Sources configuration test: FAILED');
      console.error(`   Error: ${error.response?.data?.message || error.message}`);
      return false;
    }
  }

  async testStorageConfiguration() {
    console.log('\n=== Testing Dynamic Storage Configuration ===');
    
    try {
      // 1. Get current storage configuration
      console.log('1. Getting current storage configuration...');
      const currentStorage = await this.get('/storage');
      console.log(`   Current storage: ${currentStorage.data.storage.current.type}`);
      
      // 2. Test switching to memory storage
      console.log('2. Switching to memory storage...');
      const memoryConfig = {
        type: 'memory',
        config: {
          maxRecords: 1000,
          ttl: 60000
        }
      };
      
      const memoryResult = await this.post('/storage/configure', memoryConfig);
      console.log(`   ✓ Storage configured: ${memoryResult.data.message}`);
      console.log(`   ✓ Connection test: ${memoryResult.data.storage.connectionTest.success}`);
      console.log(`   ✓ Restored data points: ${memoryResult.data.result.restoredDataPoints}`);
      
      // 3. Test storage health
      console.log('3. Checking storage health...');
      const healthResult = await this.get('/storage/health');
      console.log(`   ✓ Storage status: ${healthResult.data.storage.status}`);
      console.log(`   ✓ Storage type: ${healthResult.data.storage.type}`);
      
      // 4. Test storage types endpoint
      console.log('4. Getting available storage types...');
      const typesResult = await this.get('/storage/types');
      const storageTypes = Object.keys(typesResult.data.storageTypes);
      console.log(`   ✓ Available types: ${storageTypes.join(', ')}`);
      
      // 5. Test invalid configuration (should fail)
      console.log('5. Testing invalid configuration...');
      try {
        await this.post('/storage/configure', {
          type: 'postgresql',
          config: {
            // Missing required fields
            host: 'invalid-host'
          }
        });
        console.log('   ❌ Invalid config was accepted (should have failed)');
        return false;
      } catch (error) {
        if (error.response?.status === 400) {
          console.log('   ✓ Invalid config properly rejected');
        } else {
          throw error;
        }
      }
      
      // 6. Restore original configuration
      console.log('6. Restoring original configuration...');
      const originalType = currentStorage.data.storage.current.type;
      const originalConfig = currentStorage.data.storage.current.config;
      
      if (originalType !== 'memory') {
        // Only restore if it's not memory (might require actual DB)
        console.log(`   Skipping restore to ${originalType} (would require actual database)`);
      } else {
        const restoreResult = await this.post('/storage/configure', {
          type: originalType,
          config: originalConfig
        });
        console.log(`   ✓ Original storage restored: ${restoreResult.data.message}`);
      }
      
      console.log('\n✅ Storage configuration test: PASSED');
      return true;
      
    } catch (error) {
      console.error('\n❌ Storage configuration test: FAILED');
      console.error(`   Error: ${error.response?.data?.message || error.message}`);
      if (error.response?.data?.details) {
        console.error(`   Details: ${error.response.data.details}`);
      }
      return false;
    }
  }

  async testConfigurationValidation() {
    console.log('\n=== Testing Configuration Validation ===');
    
    try {
      // 1. Test invalid source configuration
      console.log('1. Testing invalid source configuration...');
      try {
        await this.post('/sources/configure', {
          sources: [
            {
              // Missing required fields
              id: 'invalid-source'
            }
          ]
        });
        console.log('   ❌ Invalid source config was accepted');
        return false;
      } catch (error) {
        if (error.response?.status === 400) {
          console.log('   ✓ Invalid source config properly rejected');
        } else {
          throw error;
        }
      }
      
      // 2. Test storage validation endpoint
      console.log('2. Testing storage validation...');
      const validationResult = await this.post('/storage/validate', {
        type: 'memory',
        config: {
          maxRecords: 1000,
          ttl: 60000
        }
      });
      console.log(`   ✓ Valid config accepted: ${validationResult.data.valid}`);
      
      // 3. Test invalid storage validation
      console.log('3. Testing invalid storage validation...');
      try {
        await this.post('/storage/validate', {
          type: 'postgresql',
          config: {
            // Missing required fields
          }
        });
        console.log('   ❌ Invalid storage config validation passed');
        return false;
      } catch (error) {
        if (error.response?.status === 400) {
          console.log('   ✓ Invalid storage config validation properly failed');
        } else {
          throw error;
        }
      }
      
      console.log('\n✅ Configuration validation test: PASSED');
      return true;
      
    } catch (error) {
      console.error('\n❌ Configuration validation test: FAILED');
      console.error(`   Error: ${error.response?.data?.message || error.message}`);
      return false;
    }
  }

  async runAllTests() {
    console.log('Universal Data Connector - Dynamic Configuration Test Suite');
    console.log('============================================================');
    console.log(`Testing against: ${this.baseUrl}`);
    
    // Check if server is running
    try {
      await this.get('/engine/status');
      console.log('✓ Server is running and accessible');
    } catch (error) {
      console.error('❌ Server is not accessible');
      console.error(`   Make sure the Universal Data Connector is running on ${this.baseUrl}`);
      process.exit(1);
    }
    
    const results = {
      sources: await this.testSourcesConfiguration(),
      storage: await this.testStorageConfiguration(),
      validation: await this.testConfigurationValidation()
    };
    
    // Summary
    console.log('\n\n=== TEST SUMMARY ===');
    let passed = 0;
    let failed = 0;
    
    for (const [testName, success] of Object.entries(results)) {
      const status = success ? '✓ PASSED' : '✗ FAILED';
      console.log(`${testName.toUpperCase().padEnd(12)} ${status}`);
      
      if (success) {
        passed++;
      } else {
        failed++;
      }
    }
    
    console.log(`\nTotal: ${passed + failed}, Passed: ${passed}, Failed: ${failed}`);
    
    if (failed > 0) {
      console.log('\nSome tests failed. Check the error messages above.');
      process.exit(1);
    } else {
      console.log('\nAll dynamic configuration tests passed! 🎉');
      process.exit(0);
    }
  }

  async get(endpoint) {
    return await axios.get(`${this.apiUrl}${endpoint}`);
  }

  async post(endpoint, data) {
    return await axios.post(`${this.apiUrl}${endpoint}`, data);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const hostArg = args.find(arg => arg.startsWith('--host='));
  const portArg = args.find(arg => arg.startsWith('--port='));
  
  const host = hostArg ? hostArg.split('=')[1] : 'localhost';
  const port = portArg ? portArg.split('=')[1] : '3000';
  const baseUrl = `http://${host}:${port}`;
  
  const tester = new DynamicConfigTester(baseUrl);
  await tester.runAllTests();
}

// Error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

if (require.main === module) {
  main().catch(console.error);
}

module.exports = DynamicConfigTester;
