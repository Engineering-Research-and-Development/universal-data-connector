const logger = require('../utils/logger');
const UniversalDataModel = require('./UniversalDataModel');

// Import all mappers
const {
  OPCUAMapper,
  ModbusMapper,
  AASMapper,
  MQTTMapper,
  GenericMapper
} = require('./mappers');

/**
 * MappingEngine - Core engine for data mapping
 * 
 * This class manages the mapping of data from various sources
 * to the Universal Data Model. It maintains a registry of mappers
 * and handles the transformation process.
 */
class MappingEngine {
  constructor(config) {
  this.config = config || {};
  this.mappings = new Map(); // 🔥 ASSICURATI CHE SIA UNA MAP
  this.namespace = config.namespace || 'urn:ngsi-ld:default';

  // Inizializza il data model
  this.dataModel = new UniversalDataModel({
    source: 'universal-data-connector',
    namespace: this.namespace
  });

  // Inizializza mappers
  this.mappers = new Map();
  this.mappingStats = {
    totalMappings: 0,
    successfulMappings: 0,
    failedMappings: 0,
    lastMappingTime: null
  };
  
  // Register default mappers
  this.registerDefaultMappers();
  
  logger.info('Mapping Engine initialized');
}
/*   constructor(config = {}) {
    this.config = config;
    this.dataModel = new UniversalDataModel({
      source: 'universal-data-connector',
      namespace: config.namespace || 'urn:ngsi-ld:industry50'
    });

    this.mappers = new Map();
    this.mappingStats = {
      totalMappings: 0,
      successfulMappings: 0,
      failedMappings: 0,
      lastMappingTime: null
    };

    // Register default mappers
    this.registerDefaultMappers();

    logger.info('Mapping Engine initialized');
  } */

  /**
   * Register default mappers for known protocols
   * @private
   */
  registerDefaultMappers() {
    this.registerMapper('opcua', new OPCUAMapper());
    this.registerMapper('modbus', new ModbusMapper());
    this.registerMapper('aas', new AASMapper());
    this.registerMapper('asset-administration-shell', new AASMapper());
    this.registerMapper('mqtt', new MQTTMapper());

    // Register generic mapper as fallback
    this.registerMapper('generic', new GenericMapper({ sourceType: 'generic' }));
    this.registerMapper('http', new GenericMapper({ sourceType: 'http' }));
    this.registerMapper('s7', new GenericMapper({ sourceType: 's7' }));
    this.registerMapper('bacnet', new GenericMapper({ sourceType: 'bacnet' }));
    this.registerMapper('fins', new GenericMapper({ sourceType: 'fins' }));
    this.registerMapper('melsec', new GenericMapper({ sourceType: 'melsec' }));
    this.registerMapper('cip', new GenericMapper({ sourceType: 'cip' }));
    this.registerMapper('serial', new GenericMapper({ sourceType: 'serial' }));

    logger.debug(`Registered ${this.mappers.size} default mappers`);
  }

  /**
   * Register a custom mapper for a specific source type
   * @param {string} sourceType - Source type identifier
   * @param {BaseMapper} mapper - Mapper instance
   */
  registerMapper(sourceType, mapper) {
    if (!mapper || typeof mapper.map !== 'function') {
      throw new Error('Mapper must implement map() method');
    }

    this.mappers.set(sourceType.toLowerCase(), mapper);
    logger.debug(`Mapper registered for source type: ${sourceType}`);
  }

  addMapping(mappingConfig) {
    this.validateMapping(mappingConfig);
    this.mappings.set(mappingConfig.sourceId, mappingConfig);
    logger.info(`Added mapping for source '${mappingConfig.sourceId}' -> ${mappingConfig.target.type}`);
  }

  /**
 * Validate mapping configuration
 * @param {Object} mappingConfig - Mapping configuration to validate
 */
validateMapping(mappingConfig) {
  if (!mappingConfig.sourceId) {
    throw new Error('Mapping configuration requires sourceId');
  }
  
  if (!mappingConfig.target || !mappingConfig.target.type) {
    throw new Error('Mapping configuration requires target.type');
  }
  
  if (!mappingConfig.mappings || !Array.isArray(mappingConfig.mappings)) {
    throw new Error('Mapping configuration requires mappings array');
  }
  
  return true;
}

/**
 * Extract value from nested object using path
 * @param {Object} obj - Source object
 * @param {string} path - Dot-separated path (e.g., "registers.temperature")
 * @returns {*} Extracted value or undefined
 */
extractValue(obj, path) {
  const keys = path.split('.');
  let value = obj;
  
  for (const key of keys) {
    if (value === null || value === undefined) {
      return undefined;
    }
    value = value[key];
  }
  
  return value;
}

/**
 * Set value in nested object using path
 * @param {Object} obj - Target object
 * @param {string} path - Dot-separated path
 * @param {*} value - Value to set
 */
setValue(obj, path, value) {
  const keys = path.split('.');
  const lastKey = keys.pop();
  let current = obj;
  
  for (const key of keys) {
    if (!(key in current)) {
      current[key] = {};
    }
    current = current[key];
  }
  
  current[lastKey] = value;
}

/**
 * Apply transformation to value
 * @param {*} value - Source value
 * @param {string} transformType - Type of transformation
 * @param {Object} config - Transformation configuration
 * @returns {*} Transformed value
 */
async applyTransformation(value, transformType, config = {}) {
  if (!transformType || transformType === 'direct') {
    return value;
  }
  
  switch (transformType) {
    case 'number':
      return Number(value);
    
    case 'string':
      return String(value);
    
    case 'boolean':
      return Boolean(value);
    
    case 'scale':
      return value * (config.factor || 1) + (config.offset || 0);
    
    case 'round':
      return Math.round(value * Math.pow(10, config.decimals || 0)) / Math.pow(10, config.decimals || 0);
    
    case 'uppercase':
      return String(value).toUpperCase();
    
    case 'lowercase':
      return String(value).toLowerCase();
    
    default:
      logger.warn(`Unknown transformation type: ${transformType}`);
      return value;
  }
}

/**
 * Get mapping configuration for a source
 * @param {string} sourceId - Source ID
 * @returns {Object|null} Mapping configuration or null
 */
getMappingForSource(sourceId) {
  return this.mappings.get(sourceId);
}

  /**
   * Get mapper for a specific source type
   * @param {string} sourceType - Source type identifier
   * @returns {BaseMapper} Mapper instance or generic mapper
   */
  getMapper(sourceType) {
    const mapper = this.mappers.get(sourceType.toLowerCase());

    if (!mapper) {
      logger.warn(`No specific mapper found for ${sourceType}, using generic mapper`);
      return this.mappers.get('generic');
    }

    return mapper;
  }
  getMapping(sourceId) {
  if (!this.mappings || !(this.mappings instanceof Map)) {
    return null;
  }
  return this.mappings.get(sourceId);
}

  async applyMapping(sourceId, data) {
     // 🔥 AGGIUNGI QUESTO CONTROLLO
  if (!this.mappings || !(this.mappings instanceof Map)) {
    logger.warn(`Mappings not initialized properly, creating new Map`);
    this.mappings = new Map();
  }
    
    const mapping = this.mappings.get(sourceId);

    if (!mapping) {
      logger.debug(`No mapping found for source '${sourceId}'`);
      return null;
    }

    try {
      logger.debug(`🔄 Applying mapping for source '${sourceId}'...`);

      const result = {};

      // Apply each field mapping
      for (const fieldMapping of mapping.mappings) {
        const sourceValue = this.extractValue(data, fieldMapping.sourceField);

        if (sourceValue !== undefined) {
          const transformedValue = await this.applyTransformation(
            sourceValue,
            fieldMapping.transform,
            fieldMapping.transformConfig
          );

          this.setValue(result, fieldMapping.targetField, transformedValue);

          logger.debug(`   ✓ ${fieldMapping.sourceField} (${sourceValue}) → ${fieldMapping.targetField} (${transformedValue})`);
        } else {
          logger.debug(`   ⚠ ${fieldMapping.sourceField} not found in source data`);
        }
      }

      // Add metadata if configured
      if (mapping.includeMetadata !== false) {
        result._metadata = {
          sourceId: sourceId,
          timestamp: new Date().toISOString(),
          originalData: data
        };
      }

      logger.debug(`✅ Mapping completed for source '${sourceId}'`);

      return result;

    } catch (error) {
      logger.error(`Error applying mapping for source '${sourceId}':`, error);
      throw error;
    }
  }

  /**
   * Map data from a source to the Universal Data Model
   * @param {Object} sourceData - Raw data from source
   * @param {Object} context - Context information (sourceType, entityId, etc.)
   * @returns {Array} Array of created entity IDs
   */
  mapData(sourceData, context = {}) {
    const startTime = Date.now();
    const sourceType = context.sourceType || sourceData.type || 'generic';

    try {
      this.mappingStats.totalMappings++;

      // Get appropriate mapper
      const mapper = this.getMapper(sourceType);

      if (!mapper) {
        throw new Error(`No mapper available for source type: ${sourceType}`);
      }

      // Apply mapping
      const entities = mapper.map(sourceData, context);

      if (!entities || entities.length === 0) {
        logger.warn(`Mapper returned no entities for source type: ${sourceType}`);
        return [];
      }

      // Add entities to data model
      const entityIds = [];
      for (const entity of entities) {
        const entityId = this.dataModel.addEntity(entity);
        entityIds.push(entityId);
      }

      this.mappingStats.successfulMappings++;
      this.mappingStats.lastMappingTime = new Date().toISOString();

      const duration = Date.now() - startTime;
      logger.debug(`Mapped ${entities.length} entities from ${sourceType} in ${duration}ms`);

      return entityIds;

    } catch (error) {
      this.mappingStats.failedMappings++;
      logger.error(`Error mapping data from ${sourceType}:`, error);
      throw error;
    }
  }

  /**
   * Map data from multiple sources in batch
   * @param {Array} dataItems - Array of {sourceData, context} objects
   * @returns {Object} Results with successful and failed mappings
   */
  mapBatch(dataItems) {
    const results = {
      successful: [],
      failed: []
    };

    for (const item of dataItems) {
      try {
        const entityIds = this.mapData(item.sourceData, item.context);
        results.successful.push({
          context: item.context,
          entityIds: entityIds
        });
      } catch (error) {
        results.failed.push({
          context: item.context,
          error: error.message
        });
      }
    }

    logger.info(`Batch mapping completed: ${results.successful.length} successful, ${results.failed.length} failed`);
    return results;
  }

  /**
   * Export current data model to JSON
   * @param {Object} options - Export options
   * @returns {Object} JSON representation
   */
  exportToJSON(options = {}) {
    return this.dataModel.toJSON(options);
  }

  /**
   * Export current data model to NGSI-LD
   * @param {Object} options - Export options
   * @returns {Array} NGSI-LD entities
   */
  exportToNGSILD(options = {}) {
    return this.dataModel.toNGSILD(options);
  }

  /**
   * Export current data model to TOON format
   * @param {Object} options - Export options
   * @returns {Object} TOON representation
   */
  exportToTOON(options = {}) {
    return this.dataModel.toTOON(options);
  }

  /**
   * Get a specific entity from the data model
   * @param {string} entityId - Entity ID
   * @returns {Object|null} Entity or null
   */
  getEntity(entityId) {
    return this.dataModel.getEntity(entityId);
  }

  /**
   * Get all entities of a specific type
   * @param {string} type - Entity type
   * @returns {Array} Array of entities
   */
  getEntitiesByType(type) {
    return this.dataModel.getEntitiesByType(type);
  }

  /**
   * Get all entities in the data model
   * @returns {Array} Array of all entities
   */
  getAllEntities() {
    return Array.from(this.dataModel.entities.values());
  }

  /**
   * Remove an entity from the data model
   * @param {string} entityId - Entity ID
   * @returns {boolean} True if removed
   */
  removeEntity(entityId) {
    return this.dataModel.removeEntity(entityId);
  }

  /**
   * Clear all data from the data model
   */
  clearAll() {
    this.dataModel.clear();
    logger.info('Mapping engine data model cleared');
  }

  /**
   * Get statistics about mappings and data model
   * @returns {Object} Statistics
   */
  getStatistics() {
    const modelStats = this.dataModel.getStatistics();

    return {
      ...this.mappingStats,
      dataModel: modelStats,
      registeredMappers: Array.from(this.mappers.keys())
    };
  }

  /**
   * Update mapping configuration
   * @param {Object} config - New configuration
   */
  updateConfig(config) {
    this.config = { ...this.config, ...config };

    if (config.namespace) {
      this.dataModel.metadata.namespace = config.namespace;
    }

    logger.info('Mapping engine configuration updated');
  }

  /**
   * Get the current Universal Data Model instance
   * @returns {UniversalDataModel} Data model instance
   */
  getDataModel() {
    return this.dataModel;
  }
}



module.exports = MappingEngine;
