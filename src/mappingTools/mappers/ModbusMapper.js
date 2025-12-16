const BaseMapper = require('../BaseMapper');
const logger = require('../../utils/logger');

/**
 * ModbusMapper - Maps Modbus data to Universal Data Model
 */
class ModbusMapper extends BaseMapper {
  constructor(options = {}) {
    super({ ...options, sourceType: 'modbus' });
  }

  /**
   * Map Modbus data to Universal Data Model entities
   * @param {Object} sourceData - Modbus data from connector
   * @param {Object} context - Additional context
   * @returns {Array} Array of entities
   */
  map(sourceData, context = {}) {
    if (!this.validate(sourceData)) {
      return [];
    }

    const entities = [];
    const entityId = context.entityId || this.generateEntityId(context);
    const entityType = context.entityType || 'ModbusDevice';

    const attributes = {};
    const metadata = this.extractMetadata(sourceData);

    // Map Modbus registers to attributes
    if (sourceData.registers) {
      for (const [registerName, registerValue] of Object.entries(sourceData.registers)) {
        const { name, value } = this.applyMappingRules(registerName, registerValue);
        
        attributes[name] = {
          value: value,
          registerType: this.determineRegisterType(registerName, sourceData)
        };
      }
    }

    entities.push({
      id: entityId,
      type: entityType,
      attributes: attributes,
      metadata: {
        ...metadata,
        unitId: sourceData.unitId,
        connectionType: sourceData.connectionType
      },
      source: this.sourceType
    });

    logger.debug(`Modbus mapper created entity ${entityId} with ${Object.keys(attributes).length} attributes`);
    return entities;
  }

  determineRegisterType(registerName, sourceData) {
    // Try to determine register type from name or data structure
    if (registerName.includes('coil') || registerName.includes('digital')) {
      return 'coil';
    } else if (registerName.includes('holding')) {
      return 'holding';
    } else if (registerName.includes('input')) {
      return 'input';
    }
    return 'holding'; // default
  }

  determineEntityType(sourceData) {
    return sourceData.deviceType || 'ModbusDevice';
  }
}

module.exports = ModbusMapper;
