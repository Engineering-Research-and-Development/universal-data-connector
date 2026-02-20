#!/usr/bin/env node

/**
 * Universal Data Connector - Connectors Test Suite
 * Tests individual connector implementations
 */

const ConnectorFactory = require('../src/connectors/ConnectorFactory');

class ConnectorTests {
  constructor() {
    this.testResults = {
      passed: 0,
      failed: 0,
      skipped: 0,
      tests: []
    };
  }

  recordTest(testName, passed, error = null) {
    const result = {
      name: testName,
      passed,
      error: error ? error.message : null
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
  }

  // ============================================================================
  // CONNECTOR FACTORY TESTS
  // ============================================================================

  testConnectorFactory() {
    console.log('\n=== CONNECTOR FACTORY TESTS ===');
    
    // Test OPC UA connector creation
    try {
      const opcuaConnector = ConnectorFactory.create('opcua', {
        id: 'test-opcua',
        config: {
          endpoint: 'opc.tcp://localhost:4840',
          nodes: []
        }
      });
      this.recordTest('Create OPC UA connector', opcuaConnector !== null);
    } catch (error) {
      this.recordTest('Create OPC UA connector', false, error);
    }

    // Test MQTT connector creation
    try {
      const mqttConnector = ConnectorFactory.create('mqtt', {
        id: 'test-mqtt',
        config: {
          broker: 'mqtt://localhost:1883',
          topics: []
        }
      });
      this.recordTest('Create MQTT connector', mqttConnector !== null);
    } catch (error) {
      this.recordTest('Create MQTT connector', false, error);
    }

    // Test HTTP connector creation
    try {
      const httpConnector = ConnectorFactory.create('http', {
        id: 'test-http',
        type: 'http',
        config: {
          url: 'https://api.github.com',
          method: 'GET',
          interval: 60000
        }
      });
      this.recordTest('Create HTTP connector', httpConnector !== null);
    } catch (error) {
      this.recordTest('Create HTTP connector', false, error);
    }

    // Test Modbus connector creation
    try {
      const modbusConnector = ConnectorFactory.create('modbus', {
        id: 'test-modbus',
        type: 'modbus',
        config: {
          host: 'localhost',
          port: 502,
          registers: []
        }
      });
      this.recordTest('Create Modbus connector', modbusConnector !== null);
    } catch (error) {
      this.recordTest('Create Modbus connector', false, error);
    }

    // Test S7 connector creation
    try {
      const s7Connector = ConnectorFactory.create('s7', {
        id: 'test-s7',
        type: 's7',
        config: {
          host: 'localhost',
          rack: 0,
          slot: 1,
          variables: []
        }
      });
      this.recordTest('Create S7 connector', s7Connector !== null);
    } catch (error) {
      this.recordTest('Create S7 connector', false, error);
    }

    // Test invalid connector type
    try {
      const invalidConnector = ConnectorFactory.create('invalid-type', {
        id: 'test-invalid',
        config: {}
      });
      this.recordTest('Reject invalid connector type', false);
    } catch (error) {
      this.recordTest('Reject invalid connector type', true);
    }
  }

  // ============================================================================
  // HTTP CONNECTOR TESTS
  // ============================================================================

  async testHttpConnector() {
    console.log('\n=== HTTP CONNECTOR TESTS ===');
    
    try {
      const httpConnector = ConnectorFactory.create('http', {
        id: 'test-http-live',
        type: 'http',
        config: {
          url: 'https://api.github.com/repos/nodejs/node',
          method: 'GET',
          interval: 60000,
          timeout: 5000
        }
      });

      // Test connect
      await httpConnector.connect();
      this.recordTest('HTTP connector connect', true);

      // Test data retrieval (wait for first poll)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Test disconnect
      await httpConnector.disconnect();
      this.recordTest('HTTP connector disconnect', true);

    } catch (error) {
      this.recordTest('HTTP connector tests', false, error);
    }
  }

  // ============================================================================
  // CONNECTOR PROTOCOL MODULES
  // ============================================================================

  testConnectorModules() {
    console.log('\n=== CONNECTOR MODULE LOADING TESTS ===');
    
    const modules = [
      'OpcUaConnector',
      'MqttConnector',
      'HttpConnector',
      'ModbusConnector',
      'S7Connector',
      'AASConnector',
      'BACnetConnector',
      'CIPConnector',
      'EtherCATConnector',
      'FinsTcpConnector',
      'MelsecConnector',
      'ProfinetConnector',
      'SerialConnector'
    ];

    modules.forEach(moduleName => {
      try {
        require(`../src/connectors/protocols/${moduleName}`);
        this.recordTest(`Load ${moduleName}`, true);
      } catch (error) {
        this.recordTest(`Load ${moduleName}`, false, error);
      }
    });
  }

  // ============================================================================
  // MAIN TEST RUNNER
  // ============================================================================

  async runAllTests() {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║       Universal Data Connector - Connector Tests              ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    const startTime = Date.now();

    // Run test suites
    this.testConnectorFactory();
    await this.testHttpConnector();
    this.testConnectorModules();

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    // Print summary
    this.printSummary(duration);

    process.exit(this.testResults.failed > 0 ? 1 : 0);
  }

  printSummary(duration) {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                      CONNECTOR TEST SUMMARY                    ║');
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
      console.log('\n✓ ALL CONNECTOR TESTS PASSED! 🎉');
    }

    console.log('\n' + '═'.repeat(66));
  }
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

async function main() {
  const tests = new ConnectorTests();
  await tests.runAllTests();
}

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

module.exports = ConnectorTests;
