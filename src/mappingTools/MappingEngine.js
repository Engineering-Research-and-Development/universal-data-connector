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
  constructor(config = {}) {
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
  }

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
