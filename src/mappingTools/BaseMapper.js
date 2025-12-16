const logger = require('../utils/logger');

/**
 * BaseMapper - Base class for protocol-specific mappers
 * 
 * Each connector type should have its own mapper that extends this class
 * and implements the mapping logic from the protocol-specific format
 * to the Universal Data Model
 */
class BaseMapper {
  constructor(options = {}) {
    this.sourceType = options.sourceType || 'unknown';
    this.mappingRules = options.mappingRules || {};
    this.options = options;
  }

  /**
   * Map source data to Universal Data Model entities
   * Must be implemented by subclasses
   * 
   * @param {Object} sourceData - Raw data from the source
   * @param {Object} context - Additional context information
   * @returns {Array} Array of entities in Universal Data Model format
   */
  map(sourceData, context = {}) {
    throw new Error('map() method must be implemented by subclass');
  }

  /**
   * Validate source data before mapping
   * @param {Object} sourceData - Raw data from the source
   * @returns {boolean} True if data is valid
   */
  validate(sourceData) {
    if (!sourceData) {
      logger.warn(`${this.sourceType} mapper: No data to validate`);
      return false;
    }
    return true;
  }

  /**
   * Apply mapping rules to transform attribute names and values
   * @param {string} attributeName - Original attribute name
   * @param {*} attributeValue - Original attribute value
   * @returns {Object} Transformed attribute {name, value}
   */
  applyMappingRules(attributeName, attributeValue) {
    const rules = this.mappingRules[attributeName];
    
    if (!rules) {
      return { name: attributeName, value: attributeValue };
    }

    let name = rules.targetName || attributeName;
    let value = attributeValue;

    // Apply value transformation if defined
    if (rules.transform) {
      try {
        if (typeof rules.transform === 'function') {
          value = rules.transform(value);
        } else if (rules.transform.type) {
          value = this.applyTransformation(value, rules.transform);
        }
      } catch (error) {
        logger.error(`Error applying transformation to ${attributeName}:`, error);
      }
    }

    return { name, value };
  }

  /**
   * Apply standard transformations
   * @private
   */
  applyTransformation(value, transform) {
    switch (transform.type) {
      case 'scale':
        return value * (transform.factor || 1);
      
      case 'offset':
        return value + (transform.offset || 0);
      
      case 'round':
        return Math.round(value * Math.pow(10, transform.decimals || 0)) / Math.pow(10, transform.decimals || 0);
      
      case 'toString':
        return String(value);
      
      case 'toNumber':
        return Number(value);
      
      case 'toBoolean':
        return Boolean(value);
      
      case 'map':
        return transform.mapping[value] || value;
      
      default:
        return value;
    }
  }

  /**
   * Generate entity ID
   * @param {Object} context - Context information
   * @returns {string} Entity ID
   */
  generateEntityId(context) {
    const source = context.source || this.sourceType;
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `${source}_${timestamp}_${random}`;
  }

  /**
   * Determine entity type from source data
   * @param {Object} sourceData - Raw data from the source
   * @returns {string} Entity type
   */
  determineEntityType(sourceData) {
    // Default implementation - should be overridden by subclasses
    return this.sourceType || 'GenericEntity';
  }

  /**
   * Extract metadata from source data
   * @param {Object} sourceData - Raw data from the source
   * @returns {Object} Metadata
   */
  extractMetadata(sourceData) {
    return {
      timestamp: sourceData.timestamp || new Date().toISOString(),
      source: sourceData.source || this.sourceType,
      quality: sourceData.quality || 'good'
    };
  }

  /**
   * Get mapper statistics
   * @returns {Object} Statistics
   */
  getStatistics() {
    return {
      sourceType: this.sourceType,
      mappingRulesCount: Object.keys(this.mappingRules).length
    };
  }
}

module.exports = BaseMapper;
