const BaseMapper = require('../BaseMapper');
const logger = require('../../utils/logger');

/**
 * MQTTMapper - Maps MQTT data to new unified format
 */
class MQTTMapper extends BaseMapper {
  constructor(options = {}) {
    super({ ...options, sourceType: 'mqtt' });
  }

  /**
   * Map MQTT data to new unified format
   * @param {Object} sourceData - MQTT data from connector
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

    // Parse MQTT payload
    let payload = sourceData.payload;
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch (e) {
        // Keep as string if not JSON
      }
    }

    // Extract measurements from payload
    if (typeof payload === 'object' && payload !== null) {
      this.traverseObject(payload, '', (path, value) => {
        if (this.isMeasurementValue(value) && !['timestamp', 'id', 'type'].includes(path)) {
          measurements.push({
            id: this.pathToMeasurementId(path),
            type: this.inferDataType(value),
            value: value
          });
        }
      });
    } else {
      // Scalar value
      measurements.push({
        id: 'value',
        type: this.inferDataType(payload),
        value: payload
      });
    }

    // Add MQTT specific metadata
    metadata.topic = sourceData.topic;
    metadata.qos = sourceData.qos;

    logger.debug(`MQTT mapper created device ${deviceId} with ${measurements.length} measurements`);
    
    return {
      id: deviceId,
      type: deviceType,
      measurements,
      metadata
    };
  }

  /**
   * Discover MQTT device structure
   */
  discover(sourceData, context = {}) {
    const deviceId = this.extractDeviceId(sourceData, context);
    const deviceType = this.determineDeviceType(sourceData, context);
    const measurements = [];

    // Parse payload for discovery
    let payload = sourceData.payload;
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch (e) {
        payload = { value: payload };
      }
    }

    if (typeof payload === 'object' && payload !== null) {
      this.traverseObject(payload, '', (path, value) => {
        if (this.isMeasurementValue(value)) {
          measurements.push({
            id: this.pathToMeasurementId(path),
            name: path,
            type: this.inferDataType(value),
            unit: this.inferUnit(path, value),
            description: `MQTT measurement from topic ${sourceData.topic}`,
            sourcePath: `payload.${path}`
          });
        }
      });
    } else {
      measurements.push({
        id: 'value',
        name: 'value',
        type: this.inferDataType(payload),
        unit: null,
        description: 'MQTT scalar value',
        sourcePath: 'payload'
      });
    }

    const discoveryConfig = {
      id: deviceId,
      type: deviceType,
      sourceType: 'mqtt',
      discovered: new Date().toISOString(),
      measurements,
      metadata: {
        topic: sourceData.topic,
        broker: context.broker
      }
    };

    this.discoveredDevices.set(deviceId, discoveryConfig);
    logger.info(`MQTT device discovered: ${deviceId} from topic ${sourceData.topic}`);
    
    return discoveryConfig;
  }

  /**
   * Extract device ID from MQTT data
   */
  extractDeviceId(sourceData, context) {
    // Try to extract from payload
    if (sourceData.payload?.id) {
      return sourceData.payload.id;
    }
    
    // Use topic as basis for ID
    const topicId = sourceData.topic.replace(/\//g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    return context.deviceId || `mqtt_${topicId}`;
  }

  /**
   * Determine device type from MQTT topic
   */
  determineDeviceType(sourceData, context) {
    if (sourceData.payload?.type) {
      return sourceData.payload.type;
    }

    // Extract from topic
    if (sourceData.topic) {
      const parts = sourceData.topic.split('/');
      if (parts.length > 0) {
        return `MQTT_${parts[0]}`;
      }
    }
    
    return context.deviceType || 'MQTT_Device';
  }
}

module.exports = MQTTMapper;
