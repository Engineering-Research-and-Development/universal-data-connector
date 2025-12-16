const BaseMapper = require('../BaseMapper');
const logger = require('../../utils/logger');

/**
 * AASMapper - Maps Asset Administration Shell data to Universal Data Model
 */
class AASMapper extends BaseMapper {
  constructor(options = {}) {
    super({ ...options, sourceType: 'aas' });
  }

  /**
   * Map AAS data to Universal Data Model entities
   * @param {Object} sourceData - AAS data from connector
   * @param {Object} context - Additional context
   * @returns {Array} Array of entities
   */
  map(sourceData, context = {}) {
    if (!this.validate(sourceData)) {
      return [];
    }

    const entities = [];

    // Map each AAS submodel to an entity
    if (sourceData.submodels) {
      for (const [submodelIdShort, submodelData] of Object.entries(sourceData.submodels)) {
        const entity = this.mapSubmodel(submodelIdShort, submodelData, sourceData, context);
        if (entity) {
          entities.push(entity);
        }
      }
    }

    logger.debug(`AAS mapper created ${entities.length} entities`);
    return entities;
  }

  /**
   * Map a single AAS submodel to an entity
   * @private
   */
  mapSubmodel(submodelIdShort, submodelData, sourceData, context) {
    const entityId = context.entityId || `aas_${submodelData.id || submodelIdShort}`;
    const entityType = context.entityType || this.determineEntityType({ submodelIdShort });

    const attributes = {};
    const metadata = this.extractMetadata(sourceData);

    // Map submodel elements to attributes
    if (submodelData.elements) {
      for (const [elementIdShort, elementData] of Object.entries(submodelData.elements)) {
        const mappedElement = this.mapSubmodelElement(elementIdShort, elementData);
        if (mappedElement) {
          attributes[mappedElement.name] = mappedElement.value;
        }
      }
    }

    return {
      id: entityId,
      type: entityType,
      attributes: attributes,
      metadata: {
        ...metadata,
        submodelId: submodelData.id,
        submodelIdShort: submodelData.idShort,
        shellId: submodelData.shellId,
        apiVersion: sourceData.apiVersion
      },
      source: this.sourceType
    };
  }

  /**
   * Map an AAS submodel element to an attribute
   * @private
   */
  mapSubmodelElement(elementIdShort, elementData) {
    const { name, value } = this.applyMappingRules(elementIdShort, elementData.value);

    switch (elementData.modelType) {
      case 'Property':
        return {
          name: name,
          value: {
            value: value,
            valueType: elementData.valueType,
            modelType: elementData.modelType,
            description: elementData.description
          }
        };

      case 'MultiLanguageProperty':
        return {
          name: name,
          value: {
            value: value,
            modelType: elementData.modelType,
            description: elementData.description
          }
        };

      case 'Range':
        return {
          name: name,
          value: {
            min: elementData.min,
            max: elementData.max,
            valueType: elementData.valueType,
            modelType: elementData.modelType,
            description: elementData.description
          }
        };

      case 'File':
        return {
          name: name,
          value: {
            contentType: elementData.contentType,
            value: value,
            modelType: elementData.modelType,
            description: elementData.description
          }
        };

      case 'ReferenceElement':
        return {
          name: name,
          value: {
            value: value,
            modelType: elementData.modelType,
            description: elementData.description
          }
        };

      case 'SubmodelElementCollection':
        return {
          name: name,
          value: {
            elements: elementData.elements || [],
            modelType: elementData.modelType,
            description: elementData.description
          }
        };

      case 'Operation':
        // Operations are typically not mapped as attributes
        logger.debug(`Skipping Operation element: ${elementIdShort}`);
        return null;

      default:
        logger.warn(`Unknown AAS element type: ${elementData.modelType}`);
        return {
          name: name,
          value: {
            value: value,
            modelType: elementData.modelType
          }
        };
    }
  }

  determineEntityType(sourceData) {
    if (sourceData.submodelIdShort) {
      // Use submodel idShort as entity type
      return `AAS_${sourceData.submodelIdShort}`;
    }
    return 'AASSubmodel';
  }

  extractMetadata(sourceData) {
    return {
      ...super.extractMetadata(sourceData),
      apiVersion: sourceData.apiVersion
    };
  }
}

module.exports = AASMapper;
