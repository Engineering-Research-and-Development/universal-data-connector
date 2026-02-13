const BaseMapper = require('../BaseMapper');
const logger = require('../../utils/logger');

/**
 * ModbusMapper - Maps Modbus data to new unified format
 */
class ModbusMapper extends BaseMapper {
  constructor(options = {}) {
    super({ ...options, sourceType: 'modbus' });
  }

  /**
   * Map Modbus data to new unified format
   * @param {Object} sourceData - Modbus data from connector
   * @param {Object} context - Additional context
   * @returns {Object} Device in unified format
   */
  map(sourceData, context = {}) {
    if (!this.validate(sourceData)) {
      return null;
    }

    const deviceId = this.extractDeviceId(sourceData, context);
    const deviceType = this.determineDeviceType(sourceData, context);
    const measurements = [];
    const metadata = this.extractMetadata(sourceData, context);

    // Map Modbus registers to measurements
    if (sourceData.registers) {
      for (const [registerName, registerValue] of Object.entries(sourceData.registers)) {
        measurements.push({
          id: registerName.toLowerCase().replace(/[^a-z0-9]/g, '_'),
          type: this.inferDataType(registerValue),
          value: registerValue
        });
      }
    }

    // Add Modbus specific metadata
    metadata.unitId = sourceData.unitId;
    metadata.host = context.host;
    metadata.port = context.port;

    logger.debug(`Modbus mapper created device ${deviceId} with ${measurements.length} measurements`);
    
    return {
      id: deviceId,
      type: deviceType,
      measurements,
      metadata
    };
  }

  /**
   * Discover Modbus device structure
   */
  discover(sourceData, context = {}) {
    const deviceId = this.extractDeviceId(sourceData, context);
    const deviceType = this.determineDeviceType(sourceData, context);
    const measurements = [];

    if (sourceData.registers) {
      for (const [registerName, registerValue] of Object.entries(sourceData.registers)) {
        const registerType = this.determineRegisterType(registerName, sourceData);
        
        measurements.push({
          id: registerName.toLowerCase().replace(/[^a-z0-9]/g, '_'),
          name: registerName,
          type: this.inferDataType(registerValue),
          unit: null,
          description: `Modbus ${registerType} register`,
          sourcePath: `registers.${registerName}`,
          modbus: {
            registerType: registerType,
            address: sourceData.registerAddresses?.[registerName]
          }
        });
      }
    }

    const discoveryConfig = {
      id: deviceId,
      type: deviceType,
      sourceType: 'modbus',
      discovered: new Date().toISOString(),
      measurements,
      metadata: {
        unitId: sourceData.unitId,
        host: context.host,
        port: context.port
      }
    };

    this.discoveredDevices.set(deviceId, discoveryConfig);
    logger.info(`Modbus device discovered: ${deviceId} with ${measurements.length} registers`);
    
    return discoveryConfig;
  }

  /**
   * Determine register type
   */
  determineRegisterType(registerName, sourceData) {
    if (registerName.includes('coil') || registerName.includes('digital')) {
      return 'coil';
    } else if (registerName.includes('holding')) {
      return 'holding';
    } else if (registerName.includes('input')) {
      return 'input';
    } else if (registerName.includes('discrete')) {
      return 'discrete';
    }
    return 'holding';
  }

  /**
   * Extract device ID from Modbus data
   */
  extractDeviceId(sourceData, context) {
    return context.deviceId || 
           `modbus_unit${sourceData.unitId || 1}_${context.sourceId || 'device'}`;
  }

  /**
   * Determine device type
   */
  determineDeviceType(sourceData, context) {
    return sourceData.deviceType || 
           context.deviceType ||
           'Modbus_Device';
  }
}

module.exports = ModbusMapper;
