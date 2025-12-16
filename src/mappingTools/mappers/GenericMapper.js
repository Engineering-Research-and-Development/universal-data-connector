const BaseMapper = require('../BaseMapper');
const logger = require('../../utils/logger');

/**
 * GenericMapper - Generic mapper for protocols without specific mapper
 */
class GenericMapper extends BaseMapper {
  constructor(options = {}) {
    super(options);
  }

  map(sourceData, context = {}) {
    if (!this.validate(sourceData)) {
      return [];
    }

    const entities = [];
    const entityId = context.entityId || this.generateEntityId(context);
    const entityType = context.entityType || this.determineEntityType(sourceData);

    const attributes = {};
    const metadata = this.extractMetadata(sourceData);

    // Generic attribute extraction
    for (const [key, value] of Object.entries(sourceData)) {
      if (key !== 'timestamp' && key !== 'source' && key !== 'type') {
        const { name, value: mappedValue } = this.applyMappingRules(key, value);
        attributes[name] = { value: mappedValue };
      }
    }

    entities.push({
      id: entityId,
      type: entityType,
      attributes: attributes,
      metadata: metadata,
      source: this.sourceType
    });

    return entities;
  }

  determineEntityType(sourceData) {
    return sourceData.type || super.determineEntityType(sourceData);
  }
}

module.exports = GenericMapper;
