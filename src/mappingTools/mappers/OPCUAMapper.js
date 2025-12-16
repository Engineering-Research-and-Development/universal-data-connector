const BaseMapper = require('./BaseMapper');
const logger = require('../utils/logger');

/**
 * OPCUAMapper - Maps OPC UA data to Universal Data Model
 */
class OPCUAMapper extends BaseMapper {
  constructor(options = {}) {
    super({ ...options, sourceType: 'opcua' });
  }

  /**
   * Map OPC UA data to Universal Data Model entities
   * @param {Object} sourceData - OPC UA data from connector
   * @param {Object} context - Additional context
   * @returns {Array} Array of entities
   */
  map(sourceData, context = {}) {
    if (!this.validate(sourceData)) {
      return [];
    }

    const entities = [];
    const entityId = context.entityId || this.generateEntityId(context);
    const entityType = context.entityType || 'OPCUADevice';

    const attributes = {};
    const metadata = this.extractMetadata(sourceData);

    // Map OPC UA nodes to attributes
    if (sourceData.nodes) {
      for (const [nodeId, nodeData] of Object.entries(sourceData.nodes)) {
        const { name, value } = this.applyMappingRules(nodeId, nodeData.value);
        
        attributes[name] = {
          value: value,
          dataType: nodeData.dataType,
          statusCode: nodeData.statusCode,
          sourceTimestamp: nodeData.sourceTimestamp,
          serverTimestamp: nodeData.serverTimestamp
        };
      }
    }

    entities.push({
      id: entityId,
      type: entityType,
      attributes: attributes,
      metadata: metadata,
      source: this.sourceType
    });

    logger.debug(`OPC UA mapper created entity ${entityId} with ${Object.keys(attributes).length} attributes`);
    return entities;
  }

  determineEntityType(sourceData) {
    return sourceData.deviceType || 'OPCUADevice';
  }
}

module.exports = OPCUAMapper;
