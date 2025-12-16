const BaseMapper = require('../BaseMapper');
const logger = require('../../utils/logger');

/**
 * MQTTMapper - Maps MQTT data to Universal Data Model
 */
class MQTTMapper extends BaseMapper {
  constructor(options = {}) {
    super({ ...options, sourceType: 'mqtt' });
  }

  map(sourceData, context = {}) {
    if (!this.validate(sourceData)) {
      return [];
    }

    const entities = [];
    const entityId = context.entityId || this.generateEntityId(context);
    const entityType = context.entityType || 'MQTTDevice';

    const attributes = {};
    const metadata = this.extractMetadata(sourceData);

    // Parse MQTT payload
    let payload = sourceData.payload;
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch (e) {
        // Keep as string if not JSON
      }
    }

    if (typeof payload === 'object' && payload !== null) {
      for (const [key, value] of Object.entries(payload)) {
        const { name, value: mappedValue } = this.applyMappingRules(key, value);
        attributes[name] = { value: mappedValue };
      }
    } else {
      attributes['value'] = { value: payload };
    }

    entities.push({
      id: entityId,
      type: entityType,
      attributes: attributes,
      metadata: {
        ...metadata,
        topic: sourceData.topic,
        qos: sourceData.qos
      },
      source: this.sourceType
    });

    return entities;
  }

  determineEntityType(sourceData) {
    // Extract entity type from topic if possible
    if (sourceData.topic) {
      const parts = sourceData.topic.split('/');
      if (parts.length > 0) {
        return `MQTT_${parts[0]}`;
      }
    }
    return 'MQTTDevice';
  }
}

module.exports = MQTTMapper;
