#!/usr/bin/env node

/**
 * Universal Data Connector - Comprehensive Test Suite
 * Tests all major components: Connectors, Mapping, Storage, Transport, API
 */

const axios = require('axios');
const { MappingEngine } = require('../src/mappingTools');
const StorageFactory = require('../src/storage/StorageFactory');
const logger = require('../src/utils/logger');

class UDCTestSuite {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.apiUrl = `${baseUrl}/api`;
    this.testResults = {
      passed: 0,
      failed: 0,
      skipped: 0,
      tests: []
    };
  }

  // ============================================================================
  // TEST UTILITIES
  // ============================================================================

  recordTest(testName, passed, error = null) {
    const result = {
      name: testName,
      passed,
      error: error ? error.message : null,
      timestamp: new Date().toISOString()
    };
    
    this.testResults.tests.push(result);
    
    if (passed) {
      this.testResults.passed++;
      console.log(`  ✓ ${testName}`);
    } else {
      this.testResults.failed++;
      console.log(`  ✗ ${testName}`);
      if (error) {
        console.log(`    Error: ${error.message}`);
      }
    }
  }

  skipTest(testName, reason) {
    console.log(`  ⊘ ${testName} (${reason})`);
    this.testResults.skipped++;
    this.testResults.tests.push({
      name: testName,
      skipped: true,
      reason,
      timestamp: new Date().toISOString()
    });
  }

  async get(endpoint) {
    return await axios.get(`${this.apiUrl}${endpoint}`);
  }

  async post(endpoint, data) {
    return await axios.post(`${this.apiUrl}${endpoint}`, data);
  }

  async delete(endpoint) {
    return await axios.delete(`${this.apiUrl}${endpoint}`);
  }

  // ============================================================================
  // SERVER HEALTH TESTS
  // ============================================================================

  async testServerHealth() {
    console.log('\n=== SERVER HEALTH TESTS ===');
    
    try {
      const response = await this.get('/status');
      this.recordTest('Server is accessible', response.status === 200);
      this.recordTest('Status endpoint returns valid data', 
        response.data && response.data.status !== undefined);
    } catch (error) {
      this.recordTest('Server is accessible', false, error);
      throw new Error('Server is not accessible. Please start the UDC server.');
    }
  }

  // ============================================================================
  // CONNECTOR TESTS
  // ============================================================================

  async testConnectors() {
    console.log('\n=== CONNECTOR TESTS ===');
    
    try {
      // Test getting sources list
      const sourcesResponse = await this.get('/sources');
      this.recordTest('Get sources list', 
        sourcesResponse.status === 200 && Array.isArray(sourcesResponse.data.sources));
      
      // Test adding a test HTTP source
      const testSource = {
        id: 'test-http-connector',
        type: 'http',
        name: 'Test HTTP Connector',
        enabled: true,
        config: {
          url: 'https://api.github.com/repos/nodejs/node',
          method: 'GET',
          interval: 60000,
          timeout: 5000
        }
      };
      
      try {
        await this.post('/config/sources/configure', { sources: [testSource] });
        this.recordTest('Add HTTP connector', true);
        
        // Wait for connector to initialize
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check connector status
        const statusResponse = await this.get(`/sources/${testSource.id}/status`);
        this.recordTest('Check connector status', statusResponse.status === 200);
        
        // Get latest data
        const dataResponse = await this.get('/data/latest');
        this.recordTest('Get latest data', 
          dataResponse.status === 200 && Array.isArray(dataResponse.data));
        
      } catch (error) {
        this.recordTest('Add HTTP connector', false, error);
      }
      
    } catch (error) {
      this.recordTest('Connector tests', false, error);
    }
  }

  // ============================================================================
  // MAPPING ENGINE TESTS
  // ============================================================================

  async testMappingEngine() {
    console.log('\n=== MAPPING ENGINE TESTS ===');
    
    try {
      // Test mapping engine initialization
      const mappingEngine = new MappingEngine({
        namespace: 'urn:ngsi-ld:test',
        mappingConfigPath: './config/mapping.json'
      });
      this.recordTest('Initialize mapping engine', true);
      
      // Test data mapping
      const testData = {
        nodeId: 'ns=2;s=TestNode',
        value: 42.5,
        timestamp: new Date(),
        dataType: 'Double',
        quality: 'GOOD'
      };
      
      try {
        const mappedData = await mappingEngine.mapData(testData, 'opcua', { sourceId: 'test-source' });
        this.recordTest('Map OPC UA data', mappedData !== null);
      } catch (error) {
        this.recordTest('Map OPC UA data', false, error);
      }
      
      // Test export to JSON
      try {
        const jsonExport = mappingEngine.exportData('json');
        this.recordTest('Export to JSON', jsonExport !== null);
      } catch (error) {
        this.recordTest('Export to JSON', false, error);
      }
      
      // Test export to TOON
      try {
        const toonExport = mappingEngine.exportData('toon');
        this.recordTest('Export to TOON', toonExport !== null);
      } catch (error) {
        this.recordTest('Export to TOON', false, error);
      }
      
      // Test statistics
      try {
        const stats = mappingEngine.getStatistics();
        this.recordTest('Get mapping statistics', 
          stats && typeof stats.totalDevices !== 'undefined');
      } catch (error) {
        this.recordTest('Get mapping statistics', false, error);
      }
      
    } catch (error) {
      this.recordTest('Mapping engine initialization', false, error);
    }
  }

  // ============================================================================
  // MAPPING API TESTS
  // ============================================================================

  async testMappingAPI() {
    console.log('\n=== MAPPING API TESTS ===');
    
    try {
      // Test getting all entities
      const entitiesResponse = await this.get('/mapping/entities');
      this.recordTest('Get all mapped entities', 
        entitiesResponse.status === 200);
      
      // Test mapping statistics
      const statsResponse = await this.get('/mapping/statistics');
      this.recordTest('Get mapping statistics', 
        statsResponse.status === 200 && statsResponse.data.statistics !== undefined);
      
      // Test health check
      const healthResponse = await this.get('/mapping/health');
      this.recordTest('Mapping engine health check', 
        healthResponse.status === 200 && healthResponse.data.status !== undefined);
      
      // Test export endpoints
      const jsonResponse = await this.get('/mapping/export/json');
      this.recordTest('Export to JSON via API', jsonResponse.status === 200);
      
      const toonResponse = await this.get('/mapping/export/toon');
      this.recordTest('Export to TOON via API', toonResponse.status === 200);
      
    } catch (error) {
      this.recordTest('Mapping API tests', false, error);
    }
  }

  // ============================================================================
  // STORAGE TESTS
  // ============================================================================

  async testStorage() {
    console.log('\n=== STORAGE TESTS ===');
    
    // Test Memory Storage
    try {
      const memoryAdapter = StorageFactory.createAdapter('memory', { 
        maxRecords: 1000, 
        ttl: 60000 
      });
      
      await memoryAdapter.connect();
      this.recordTest('Memory storage connect', true);
      
      // Test store
      const testData = {
        id: 'test-' + Date.now(),
        sourceId: 'test-source',
        timestamp: new Date(),
        data: { temperature: 25.5, humidity: 60 }
      };
      
      await memoryAdapter.store(testData);
      this.recordTest('Memory storage store data', true);
      
      // Test retrieve
      const retrieved = await memoryAdapter.getLatest('test-source', 1);
      this.recordTest('Memory storage retrieve data', retrieved.length > 0);
      
      // Test statistics
      const stats = await memoryAdapter.getStatistics();
      this.recordTest('Memory storage statistics', 
        stats && typeof stats.totalRecords !== 'undefined');
      
      await memoryAdapter.disconnect();
      this.recordTest('Memory storage disconnect', true);
      
    } catch (error) {
      this.recordTest('Memory storage tests', false, error);
    }
  }

  // ============================================================================
  // STORAGE API TESTS
  // ============================================================================

  async testStorageAPI() {
    console.log('\n=== STORAGE API TESTS ===');
    
    try {
      // Test get storage configuration
      const configResponse = await this.get('/config/storage');
      this.recordTest('Get storage configuration', 
        configResponse.status === 200 && configResponse.data.storage !== undefined);
      
      // Test storage health
      const healthResponse = await this.get('/config/storage/health');
      this.recordTest('Storage health check', 
        healthResponse.status === 200 && healthResponse.data.storage !== undefined);
      
      // Test available storage types
      const typesResponse = await this.get('/config/storage/types');
      this.recordTest('Get storage types', 
        typesResponse.status === 200 && typesResponse.data.storageTypes !== undefined);
      
    } catch (error) {
      this.recordTest('Storage API tests', false, error);
    }
  }

  // ============================================================================
  // DYNAMIC CONFIGURATION TESTS
  // ============================================================================

  async testDynamicConfiguration() {
    console.log('\n=== DYNAMIC CONFIGURATION TESTS ===');
    
    try {
      // Test engine status
      const statusResponse = await this.get('/config/engine/status');
      this.recordTest('Get engine status', 
        statusResponse.status === 200 && statusResponse.data.engine !== undefined);
      
      // Test configuration reload
      try {
        await this.post('/config/sources/reload', {});
        this.recordTest('Reload sources configuration', true);
      } catch (error) {
        this.recordTest('Reload sources configuration', false, error);
      }
      
    } catch (error) {
      this.recordTest('Dynamic configuration tests', false, error);
    }
  }

  // ============================================================================
  // DISCOVERY TESTS
  // ============================================================================

  async testDiscovery() {
    console.log('\n=== DISCOVERY TESTS ===');
    
    try {
      // Get list of sources
      const sourcesResponse = await this.get('/sources');
      
      if (sourcesResponse.data.sources.length === 0) {
        this.skipTest('Discovery tests', 'No sources configured');
        return;
      }
      
      const firstSource = sourcesResponse.data.sources[0];
      
      // Test discovery endpoint (may not be available for all source types)
      try {
        const discoveryResponse = await this.get(`/sources/${firstSource.id}/discovery`);
        this.recordTest('Get discovered items', discoveryResponse.status === 200);
      } catch (error) {
        if (error.response && error.response.status === 404) {
          this.skipTest('Get discovered items', 'Source does not support discovery');
        } else {
          this.recordTest('Get discovered items', false, error);
        }
      }
      
    } catch (error) {
      this.recordTest('Discovery tests', false, error);
    }
  }

  // ============================================================================
  // TRANSPORT TESTS
  // ============================================================================

  async testTransport() {
    console.log('\n=== TRANSPORT TESTS ===');
    
    // These tests would require actual NATS/MQTT brokers
    // For now, we just check if transport modules can be loaded
    
    try {
      require('../src/transport/NatsTransport');
      this.recordTest('Load NATS transport module', true);
    } catch (error) {
      this.recordTest('Load NATS transport module', false, error);
    }
    
    try {
      require('../src/transport/MqttTransport');
      this.recordTest('Load MQTT transport module', true);
    } catch (error) {
      this.recordTest('Load MQTT transport module', false, error);
    }
    
    try {
      require('../src/transport/HttpPushTransport');
      this.recordTest('Load HTTP Push transport module', true);
    } catch (error) {
      this.recordTest('Load HTTP Push transport module', false, error);
    }
  }

  // ============================================================================
  // PROTOCOL-SPECIFIC MAPPER TESTS
  // ============================================================================

  async testProtocolMappers() {
    console.log('\n=== PROTOCOL MAPPER TESTS ===');
    
    try {
      const { OPCUAMapper } = require('../src/mappingTools/mappers');
      const mapper = new OPCUAMapper();
      this.recordTest('Load OPC UA mapper', true);
    } catch (error) {
      this.recordTest('Load OPC UA mapper', false, error);
    }
    
    try {
      const { ModbusMapper } = require('../src/mappingTools/mappers');
      const mapper = new ModbusMapper();
      this.recordTest('Load Modbus mapper', true);
    } catch (error) {
      this.recordTest('Load Modbus mapper', false, error);
    }
    
    try {
      const { MQTTMapper } = require('../src/mappingTools/mappers');
      const mapper = new MQTTMapper();
      this.recordTest('Load MQTT mapper', true);
    } catch (error) {
      this.recordTest('Load MQTT mapper', false, error);
    }
    
    try {
      const { GenericMapper } = require('../src/mappingTools/mappers');
      const mapper = new GenericMapper();
      this.recordTest('Load Generic mapper', true);
    } catch (error) {
      this.recordTest('Load Generic mapper', false, error);
    }
  }

  // ============================================================================
  // MAIN TEST RUNNER
  // ============================================================================

  async runAllTests() {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║  Universal Data Connector - Comprehensive Test Suite          ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log(`\nTesting against: ${this.baseUrl}`);
    console.log(`Started: ${new Date().toISOString()}\n`);
    
    const startTime = Date.now();
    
    try {
      // Check server availability first
      await this.testServerHealth();
      
      // Run all test suites
      await this.testConnectors();
      await this.testMappingEngine();
      await this.testMappingAPI();
      await this.testStorage();
      await this.testStorageAPI();
      await this.testDynamicConfiguration();
      await this.testDiscovery();
      await this.testTransport();
      await this.testProtocolMappers();
      
    } catch (error) {
      console.error('\n❌ Critical error:', error.message);
      console.error('Cannot continue with tests.');
    }
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    // Print summary
    this.printSummary(duration);
    
    // Exit with appropriate code
    process.exit(this.testResults.failed > 0 ? 1 : 0);
  }

  printSummary(duration) {
    console.log('\n\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                        TEST SUMMARY                            ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    
    const total = this.testResults.passed + this.testResults.failed + this.testResults.skipped;
    
    console.log(`\nTotal Tests:    ${total}`);
    console.log(`✓ Passed:       ${this.testResults.passed}`);
    console.log(`✗ Failed:       ${this.testResults.failed}`);
    console.log(`⊘ Skipped:      ${this.testResults.skipped}`);
    console.log(`Duration:       ${duration}s`);
    
    const passRate = total > 0 ? ((this.testResults.passed / total) * 100).toFixed(1) : 0;
    console.log(`Pass Rate:      ${passRate}%`);
    
    if (this.testResults.failed > 0) {
      console.log('\n❌ SOME TESTS FAILED');
      console.log('\nFailed Tests:');
      this.testResults.tests
        .filter(t => !t.passed && !t.skipped)
        .forEach(t => {
          console.log(`  - ${t.name}`);
          if (t.error) {
            console.log(`    ${t.error}`);
          }
        });
    } else {
      console.log('\n✓ ALL TESTS PASSED! 🎉');
    }
    
    if (this.testResults.skipped > 0) {
      console.log('\nSkipped Tests:');
      this.testResults.tests
        .filter(t => t.skipped)
        .forEach(t => {
          console.log(`  - ${t.name} (${t.reason})`);
        });
    }
    
    console.log('\n' + '═'.repeat(66));
  }
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const hostArg = args.find(arg => arg.startsWith('--host='));
  const portArg = args.find(arg => arg.startsWith('--port='));
  
  const host = hostArg ? hostArg.split('=')[1] : 'localhost';
  const port = portArg ? portArg.split('=')[1] : '3000';
  const baseUrl = `http://${host}:${port}`;
  
  const testSuite = new UDCTestSuite(baseUrl);
  await testSuite.runAllTests();
}

// Error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('\n❌ Unhandled Rejection:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('\n❌ Uncaught Exception:', error);
  process.exit(1);
});

if (require.main === module) {
  main().catch(console.error);
}

module.exports = UDCTestSuite;
