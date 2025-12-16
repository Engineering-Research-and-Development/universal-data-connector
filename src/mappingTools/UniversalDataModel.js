const logger = require('../utils/logger');

/**
 * UniversalDataModel - Universal Data Model for Industry 5.0
 * 
 * This class represents the unified data model that all incoming data
 * from various sources (OPC UA, Modbus, AAS, MQTT, etc.) is mapped to.
 * 
 * The model is designed to be:
 * - Protocol-agnostic
 * - Extensible
 * - Compatible with NGSI-LD and other semantic models
 * - Exportable to JSON, NGSI-LD, and TOON formats
 */
class UniversalDataModel {
  constructor(options = {}) {
    this.version = '1.0.0';
    this.entities = new Map();
    this.relationships = new Map();
    this.metadata = {
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      source: options.source || 'universal-data-connector',
      namespace: options.namespace || 'urn:ngsi-ld:default'
    };
  }

  /**
   * Add or update an entity in the data model
   * @param {Object} entity - Entity data
   * @returns {string} Entity ID
   */
  addEntity(entity) {
    if (!entity.id) {
      throw new Error('Entity must have an id');
    }
    
    if (!entity.type) {
      throw new Error('Entity must have a type');
    }

    const entityData = {
      id: entity.id,
      type: entity.type,
      attributes: entity.attributes || {},
      metadata: {
        ...entity.metadata,
        timestamp: new Date().toISOString(),
        source: entity.source || this.metadata.source
      }
    };

    this.entities.set(entity.id, entityData);
    this.metadata.updated = new Date().toISOString();
    
    logger.debug(`Entity added/updated: ${entity.id} (type: ${entity.type})`);
    return entity.id;
  }

  /**
   * Get an entity by ID
   * @param {string} id - Entity ID
   * @returns {Object|null} Entity data or null if not found
   */
  getEntity(id) {
    return this.entities.get(id) || null;
  }

  /**
   * Get all entities of a specific type
   * @param {string} type - Entity type
   * @returns {Array} Array of entities
   */
  getEntitiesByType(type) {
    const entities = [];
    for (const [id, entity] of this.entities.entries()) {
      if (entity.type === type) {
        entities.push(entity);
      }
    }
    return entities;
  }

  /**
   * Remove an entity
   * @param {string} id - Entity ID
   * @returns {boolean} True if entity was removed
   */
  removeEntity(id) {
    const removed = this.entities.delete(id);
    if (removed) {
      this.metadata.updated = new Date().toISOString();
      logger.debug(`Entity removed: ${id}`);
    }
    return removed;
  }

  /**
   * Add a relationship between entities
   * @param {Object} relationship - Relationship data
   * @returns {string} Relationship ID
   */
  addRelationship(relationship) {
    if (!relationship.id) {
      relationship.id = `rel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    if (!relationship.type) {
      throw new Error('Relationship must have a type');
    }

    if (!relationship.source || !relationship.target) {
      throw new Error('Relationship must have source and target');
    }

    const relationshipData = {
      id: relationship.id,
      type: relationship.type,
      source: relationship.source,
      target: relationship.target,
      properties: relationship.properties || {},
      metadata: {
        ...relationship.metadata,
        timestamp: new Date().toISOString()
      }
    };

    this.relationships.set(relationship.id, relationshipData);
    this.metadata.updated = new Date().toISOString();
    
    logger.debug(`Relationship added: ${relationship.id} (${relationship.source} -> ${relationship.target})`);
    return relationship.id;
  }

  /**
   * Get relationships for an entity
   * @param {string} entityId - Entity ID
   * @param {string} direction - 'source', 'target', or 'both'
   * @returns {Array} Array of relationships
   */
  getRelationships(entityId, direction = 'both') {
    const relationships = [];
    
    for (const [id, rel] of this.relationships.entries()) {
      if (direction === 'both' || direction === 'source') {
        if (rel.source === entityId) {
          relationships.push(rel);
        }
      }
      if (direction === 'both' || direction === 'target') {
        if (rel.target === entityId) {
          relationships.push(rel);
        }
      }
    }
    
    return relationships;
  }

  /**
   * Export the data model to JSON format
   * @param {Object} options - Export options
   * @returns {Object} JSON representation
   */
  toJSON(options = {}) {
    const includeMetadata = options.includeMetadata !== false;
    const includeRelationships = options.includeRelationships !== false;

    const result = {
      version: this.version,
      entities: Array.from(this.entities.values())
    };

    if (includeRelationships) {
      result.relationships = Array.from(this.relationships.values());
    }

    if (includeMetadata) {
      result.metadata = this.metadata;
    }

    return result;
  }

  /**
   * Export the data model to NGSI-LD format
   * @param {Object} options - Export options
   * @returns {Array} Array of NGSI-LD entities
   */
  toNGSILD(options = {}) {
    const context = options.context || this.metadata.namespace;
    const entities = [];

    for (const [id, entity] of this.entities.entries()) {
      const ngsiEntity = {
        id: this.ensureURN(entity.id),
        type: entity.type,
        '@context': context
      };

      // Convert attributes to NGSI-LD properties
      for (const [attrName, attrValue] of Object.entries(entity.attributes)) {
        ngsiEntity[attrName] = this.toNGSILDProperty(attrValue, entity.metadata);
      }

      entities.push(ngsiEntity);
    }

    return entities;
  }

  /**
   * Convert attribute value to NGSI-LD property format
   * @private
   */
  toNGSILDProperty(value, metadata = {}) {
    const property = {
      type: 'Property',
      value: value
    };

    if (metadata.timestamp) {
      property.observedAt = metadata.timestamp;
    }

    if (metadata.unitCode) {
      property.unitCode = metadata.unitCode;
    }

    return property;
  }

  /**
   * Ensure ID is in URN format
   * @private
   */
  ensureURN(id) {
    if (id.startsWith('urn:')) {
      return id;
    }
    return `${this.metadata.namespace}:${id}`;
  }

  /**
   * Export the data model to TOON format (to be defined)
   * @param {Object} options - Export options
   * @returns {Object} TOON representation
   */
  toTOON(options = {}) {
    // TOON format to be defined based on requirements
    logger.warn('TOON export format is not yet fully defined');
    
    return {
      format: 'TOON',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      data: this.toJSON(options)
    };
  }

  /**
   * Import data from JSON format
   * @param {Object} json - JSON data
   */
  fromJSON(json) {
    if (json.version) {
      this.version = json.version;
    }

    if (json.metadata) {
      this.metadata = { ...this.metadata, ...json.metadata };
    }

    if (json.entities) {
      for (const entity of json.entities) {
        this.addEntity(entity);
      }
    }

    if (json.relationships) {
      for (const relationship of json.relationships) {
        this.addRelationship(relationship);
      }
    }

    logger.info(`Imported ${json.entities?.length || 0} entities and ${json.relationships?.length || 0} relationships`);
  }

  /**
   * Get statistics about the data model
   * @returns {Object} Statistics
   */
  getStatistics() {
    const typeCount = {};
    
    for (const entity of this.entities.values()) {
      typeCount[entity.type] = (typeCount[entity.type] || 0) + 1;
    }

    return {
      totalEntities: this.entities.size,
      totalRelationships: this.relationships.size,
      entityTypes: typeCount,
      created: this.metadata.created,
      lastUpdated: this.metadata.updated
    };
  }

  /**
   * Clear all data
   */
  clear() {
    this.entities.clear();
    this.relationships.clear();
    this.metadata.updated = new Date().toISOString();
    logger.info('Universal data model cleared');
  }
}

module.exports = UniversalDataModel;
