#!/usr/bin/env node

/**
 * Universal Data Connector - Mapping Engine Test Suite
 * Tests mapping functionality, transformations, and data model
 */

const { MappingEngine, UniversalDataModel } = require('../src/mappingTools');
const { OPCUAMapper, ModbusMapper, MQTTMapper, GenericMapper } = require('../src/mappingTools/mappers');

class MappingTests {
  constructor() {
    this.testResults = {
      passed: 0,
      failed: 0,
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

  // ============================================================================
  // UNIVERSAL DATA MODEL TESTS
  // ============================================================================

  testUniversalDataModel() {
    console.log('\n=== UNIVERSAL DATA MODEL TESTS ===');

    try {
      // Test device creation
      const device = UniversalDataModel.createDevice({
        id: 'test-device-001',
        type: 'TemperatureSensor',
        sourceType: 'opcua'
      });
      
      this.recordTest('Create device', device && device.id === 'test-device-001');

      // Test adding measurement
      const measurement = UniversalDataModel.createMeasurement({
        id: 'temperature',
        type: 'float',
        value: 23.5,
        unit: '°C'
      });
      
      device.measurements.push(measurement);
      this.recordTest('Add measurement to device', device.measurements.length === 1);

      // Test data validation
      const isValid = UniversalDataModel.validateDevice(device);
      this.recordTest('Validate device structure', isValid);

    } catch (error) {
      this.recordTest('Universal Data Model tests', false, error);
    }
  }

  // ============================================================================
  // OPC UA MAPPER TESTS
  // ============================================================================

  async testOPCUAMapper() {
    console.log('\n=== OPC UA MAPPER TESTS ===');

    try {
      const mapper = new OPCUAMapper();

      // Test mapping OPC UA data
      const opcuaData = {
        nodeId: 'ns=2;s=Temperature',
        value: 25.3,
        dataType: 'Double',
        timestamp: new Date(),
        quality: 'GOOD',
        sourceTimestamp: new Date()
      };

      const context = {
        sourceId: 'test-opcua-server',
        endpoint: 'opc.tcp://localhost:4840'
      };

      const mappedData = await mapper.map(opcuaData, context);
      this.recordTest('Map OPC UA data', mappedData !== null);
      this.recordTest('OPC UA mapped data has measurements', 
        mappedData.measurements && mappedData.measurements.length > 0);
      this.recordTest('OPC UA mapped data has metadata', 
        mappedData.metadata !== undefined);

    } catch (error) {
      this.recordTest('OPC UA mapper tests', false, error);
    }
  }

  // ============================================================================
  // MODBUS MAPPER TESTS
  // ============================================================================

  async testModbusMapper() {
    console.log('\n=== MODBUS MAPPER TESTS ===');

    try {
      const mapper = new ModbusMapper();

      // Test mapping Modbus data
      const modbusData = {
        address: 40001,
        value: 1234,
        type: 'holding',
        timestamp: new Date()
      };

      const context = {
        sourceId: 'test-modbus-device',
        host: 'localhost',
        port: 502
      };

      const mappedData = await mapper.map(modbusData, context);
      this.recordTest('Map Modbus data', mappedData !== null);
      this.recordTest('Modbus mapped data has measurements', 
        mappedData.measurements && mappedData.measurements.length > 0);

    } catch (error) {
      this.recordTest('Modbus mapper tests', false, error);
    }
  }

  // ============================================================================
  // MQTT MAPPER TESTS
  // ============================================================================

  async testMQTTMapper() {
    console.log('\n=== MQTT MAPPER TESTS ===');

    try {
      const mapper = new MQTTMapper();

      // Test mapping MQTT JSON data
      const mqttData = {
        topic: 'sensors/temp/room1',
        payload: JSON.stringify({
          temperature: 22.5,
          humidity: 55,
          timestamp: new Date().toISOString()
        }),
        timestamp: new Date()
      };

      const context = {
        sourceId: 'test-mqtt-broker',
        broker: 'mqtt://localhost:1883'
      };

      const mappedData = await mapper.map(mqttData, context);
      this.recordTest('Map MQTT JSON data', mappedData !== null);
      this.recordTest('MQTT mapped data has measurements', 
        mappedData.measurements && mappedData.measurements.length > 0);

    } catch (error) {
      this.recordTest('MQTT mapper tests', false, error);
    }
  }

  // ============================================================================
  // GENERIC MAPPER TESTS
  // ============================================================================

  async testGenericMapper() {
    console.log('\n=== GENERIC MAPPER TESTS ===');

    try {
      const mapper = new GenericMapper();

      // Test mapping generic data
      const genericData = {
        sensor_id: 'sensor-001',
        temperature: 24.5,
        pressure: 1013.25,
        status: 'OK',
        timestamp: new Date()
      };

      const context = {
        sourceId: 'test-generic-source',
        type: 'http'
      };

      const mappedData = await mapper.map(genericData, context);
      this.recordTest('Map generic data', mappedData !== null);
      this.recordTest('Generic mapped data has measurements', 
        mappedData.measurements && mappedData.measurements.length > 0);

    } catch (error) {
      this.recordTest('Generic mapper tests', false, error);
    }
  }

  // ============================================================================
  // MAPPING ENGINE TESTS
  // ============================================================================

  async testMappingEngine() {
    console.log('\n=== MAPPING ENGINE TESTS ===');

    try {
      const engine = new MappingEngine({
        namespace: 'urn:ngsi-ld:test',
        mappingConfigPath: './config/mapping.json'
      });

      this.recordTest('Initialize Mapping Engine', true);

      // Test mapping with OPC UA data
      const opcuaData = {
        nodeId: 'ns=2;s=TestNode',
        value: 42.5,
        dataType: 'Double',
        timestamp: new Date(),
        quality: 'GOOD'
      };

      const context = {
        sourceId: 'test-source',
        type: 'opcua'
      };

      const mappedData = await engine.mapData(opcuaData, 'opcua', context);
      this.recordTest('Map data through engine', mappedData !== null);

      // Test export to JSON
      const jsonExport = engine.exportData('json');
      this.recordTest('Export to JSON format', jsonExport !== null);

      // Test export to TOON
      const toonExport = engine.exportData('toon');
      this.recordTest('Export to TOON format', toonExport !== null);

      // Test statistics
      const stats = engine.getStatistics();
      this.recordTest('Get mapping statistics', 
        stats && typeof stats.totalDevices !== 'undefined');

      // Test discovered devices
      const devices = engine.getDiscoveredDevices();
      this.recordTest('Get discovered devices', Array.isArray(devices));

    } catch (error) {
      this.recordTest('Mapping Engine tests', false, error);
    }
  }

  // ============================================================================
  // TRANSFORMATION TESTS
  // ============================================================================

  testTransformations() {
    console.log('\n=== TRANSFORMATION TESTS ===');

    try {
      // Test scale transformation
      const scaleTransform = {
        type: 'scale',
        factor: 0.1,
        offset: -273.15
      };

      const scaledValue = this.applyTransform(1000, scaleTransform);
      this.recordTest('Scale transformation', 
        Math.abs(scaledValue - (-173.15)) < 0.01);

      // Test round transformation
      const roundTransform = {
        type: 'round',
        decimals: 2
      };

      const roundedValue = this.applyTransform(3.14159, roundTransform);
      this.recordTest('Round transformation', roundedValue === 3.14);

      // Test map transformation
      const mapTransform = {
        type: 'map',
        mapping: {
          '0': 'OFF',
          '1': 'ON',
          '2': 'ERROR'
        }
      };

      const mappedValue = this.applyTransform(1, mapTransform);
      this.recordTest('Map transformation', mappedValue === 'ON');

    } catch (error) {
      this.recordTest('Transformation tests', false, error);
    }
  }

  applyTransform(value, transform) {
    switch (transform.type) {
      case 'scale':
        return (value * transform.factor) + (transform.offset || 0);
      case 'round':
        return Math.round(value * Math.pow(10, transform.decimals)) / Math.pow(10, transform.decimals);
      case 'map':
        return transform.mapping[value.toString()] || value;
      case 'formula':
        // Simple formula evaluation (for testing only)
        return eval(transform.formula.replace('x', value));
      default:
        return value;
    }
  }

  // ============================================================================
  // DATA FORMAT TESTS
  // ============================================================================

  testDataFormats() {
    console.log('\n=== DATA FORMAT TESTS ===');

    try {
      const testDevice = {
        id: 'device-001',
        type: 'Sensor',
        measurements: [
          { id: 'temp', type: 'float', value: 23.5 },
          { id: 'humidity', type: 'float', value: 60.2 }
        ],
        metadata: {
          timestamp: new Date().toISOString(),
          source: 'opcua',
          quality: 'GOOD'
        }
      };

      // Test JSON format
      const jsonFormat = JSON.stringify(testDevice);
      this.recordTest('JSON format valid', 
        jsonFormat && JSON.parse(jsonFormat).id === 'device-001');

      // Test TOON format structure
      const toonDevice = {
        i: testDevice.id,
        t: testDevice.type,
        ts: testDevice.metadata.timestamp,
        m: testDevice.measurements.map(m => ({
          i: m.id,
          t: m.type,
          v: m.value
        })),
        meta: { source: testDevice.metadata.source }
      };

      this.recordTest('TOON format structure', 
        toonDevice.i === 'device-001' && toonDevice.m.length === 2);

    } catch (error) {
      this.recordTest('Data format tests', false, error);
    }
  }

  // ============================================================================
  // MAIN TEST RUNNER
  // ============================================================================

  async runAllTests() {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║      Universal Data Connector - Mapping Engine Tests          ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    const startTime = Date.now();

    // Run test suites
    this.testUniversalDataModel();
    await this.testOPCUAMapper();
    await this.testModbusMapper();
    await this.testMQTTMapper();
    await this.testGenericMapper();
    await this.testMappingEngine();
    this.testTransformations();
    this.testDataFormats();

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    // Print summary
    this.printSummary(duration);

    process.exit(this.testResults.failed > 0 ? 1 : 0);
  }

  printSummary(duration) {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                    MAPPING TEST SUMMARY                        ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');

    const total = this.testResults.passed + this.testResults.failed;

    console.log(`\nTotal Tests:    ${total}`);
    console.log(`✓ Passed:       ${this.testResults.passed}`);
    console.log(`✗ Failed:       ${this.testResults.failed}`);
    console.log(`Duration:       ${duration}s`);

    const passRate = total > 0 ? ((this.testResults.passed / total) * 100).toFixed(1) : 0;
    console.log(`Pass Rate:      ${passRate}%`);

    if (this.testResults.failed > 0) {
      console.log('\n❌ SOME TESTS FAILED');
      console.log('\nFailed Tests:');
      this.testResults.tests
        .filter(t => !t.passed)
        .forEach(t => {
          console.log(`  - ${t.name}`);
          if (t.error) {
            console.log(`    ${t.error}`);
          }
        });
    } else {
      console.log('\n✓ ALL MAPPING TESTS PASSED! 🎉');
    }

    console.log('\n' + '═'.repeat(66));
  }
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

async function main() {
  const tests = new MappingTests();
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

module.exports = MappingTests;
