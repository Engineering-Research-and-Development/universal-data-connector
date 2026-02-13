const BaseMapper = require('../BaseMapper');
const logger = require('../../utils/logger');

/**
 * OPCUAMapper - Maps OPC UA data to new unified format
 */
class OPCUAMapper extends BaseMapper {
  constructor(options = {}) {
    super({ ...options, sourceType: 'opcua' });
  }

  /**
   * Map OPC UA data to new unified format
   * @param {Object} sourceData - OPC UA data from connector
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

    // Map OPC UA nodes to measurements
    if (sourceData.nodes) {
      for (const [nodeId, nodeData] of Object.entries(sourceData.nodes)) {
        measurements.push({
          id: this.nodeIdToMeasurementId(nodeId),
          type: this.mapOpcUaDataType(nodeData.dataType),
          value: nodeData.value
        });

        // Add quality info to metadata
        if (nodeData.statusCode) {
          metadata[`quality_${this.nodeIdToMeasurementId(nodeId)}`] = nodeData.statusCode;
        }
      }
    }

    // Add OPC UA specific metadata
    metadata.endpoint = context.endpoint;
    if (sourceData.serverTimestamp) {
      metadata.serverTimestamp = sourceData.serverTimestamp;
    }

    logger.debug(`OPC UA mapper created device ${deviceId} with ${measurements.length} measurements`);
    
    return {
      id: deviceId,
      type: deviceType,
      measurements,
      metadata
    };
  }

  /**
   * Discover OPC UA device structure
   */
  discover(sourceData, context = {}) {
    const deviceId = this.extractDeviceId(sourceData, context);
    const deviceType = this.determineDeviceType(sourceData, context);
    const measurements = [];

    if (sourceData.nodes) {
      for (const [nodeId, nodeData] of Object.entries(sourceData.nodes)) {
        measurements.push({
          id: this.nodeIdToMeasurementId(nodeId),
          name: nodeData.displayName || nodeId,
          type: this.mapOpcUaDataType(nodeData.dataType),
          unit: nodeData.engineeringUnit,
          description: nodeData.description,
          sourcePath: `nodes.${nodeId}.value`,
          opcua: {
            nodeId: nodeId,
            dataType: nodeData.dataType,
            browseName: nodeData.browseName
          }
        });
      }
    }

    const discoveryConfig = {
      id: deviceId,
      type: deviceType,
      sourceType: 'opcua',
      discovered: new Date().toISOString(),
      measurements,
      metadata: {
        endpoint: context.endpoint,
        serverInfo: sourceData.serverInfo
      }
    };

    this.discoveredDevices.set(deviceId, discoveryConfig);
    logger.info(`OPC UA device discovered: ${deviceId} with ${measurements.length} nodes`);
    
    return discoveryConfig;
  }

  /**
   * Convert OPC UA NodeId to measurement ID
   */
  nodeIdToMeasurementId(nodeId) {
    return nodeId.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  }

  /**
   * Map OPC UA data type to simple type
   */
  mapOpcUaDataType(opcUaType) {
    if (!opcUaType) return 'unknown';
    
    const typeMap = {
      'Double': 'float',
      'Float': 'float',
      'Int32': 'int',
      'Int16': 'int',
      'UInt32': 'int',
      'UInt16': 'int',
      'Boolean': 'bool',
      'String': 'string',
      'DateTime': 'string'
    };

    return typeMap[opcUaType] || 'unknown';
  }

  /**
   * Extract device ID from OPC UA data
   */
  extractDeviceId(sourceData, context) {
    return context.deviceId || 
           sourceData.deviceId ||
           `opcua_${context.sourceId || 'device'}`;
  }

  /**
   * Determine device type
   */
  determineDeviceType(sourceData, context) {
    return sourceData.deviceType || 
           context.deviceType ||
           'OPC_UA_Server';
  }
}

module.exports = OPCUAMapper;
