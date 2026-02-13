const logger = require('../utils/logger');

/**
 * BaseMapper - Base class for protocol-specific mappers
 * 
 * Nuova struttura per mappare data sources al formato unificato:
 * {
 *   id: "device-unique-id",
 *   type: "device-type",
 *   measurements: [{ id, type, value }],
 *   metadata: { timestamp, source, quality, ... }
 * }
 * 
 * Supporta discovery automatica e salvataggio configurazione in mapping.json
 */
class BaseMapper {
  constructor(options = {}) {
    this.sourceType = options.sourceType || 'unknown';
    this.mappingRules = options.mappingRules || {};
    this.discoveryConfig = options.discoveryConfig || {};
    this.options = options;
    
    // Cache per dispositivi scoperti
    this.discoveredDevices = new Map();
  }

  /**
   * Map source data to Universal Data Model (new format)
   * Must be implemented by subclasses
   * 
   * @param {Object} sourceData - Raw data from the source
   * @param {Object} context - Additional context information
   * @returns {Object} Device in new unified format
   */
  map(sourceData, context = {}) {
    throw new Error('map() method must be implemented by subclass');
  }

  /**
   * Discover device structure from source data
   * Genera la struttura del dispositivo per mapping.json
   * 
   * @param {Object} sourceData - Raw data from the source
   * @param {Object} context - Additional context information
   * @returns {Object} Discovery configuration
   */
  discover(sourceData, context = {}) {
    const deviceId = this.extractDeviceId(sourceData, context);
    const deviceType = this.determineDeviceType(sourceData, context);
    const measurements = this.discoverMeasurements(sourceData, context);

    const discoveryConfig = {
      id: deviceId,
      type: deviceType,
      sourceType: this.sourceType,
      discovered: new Date().toISOString(),
      measurements: measurements.map(m => ({
        id: m.id,
        name: m.name || m.id,
        type: m.type,
        unit: m.unit,
        description: m.description,
        // Regole di trasformazione (opzionali, modificabili dall'utente)
        transform: m.transform || null,
        // Mappatura source -> target
        sourcePath: m.sourcePath
      })),
      metadata: {
        source: this.sourceType,
        ...this.extractDiscoveryMetadata(sourceData, context)
      }
    };

    // Salva in cache
    this.discoveredDevices.set(deviceId, discoveryConfig);
    
    logger.info(`Device discovered: ${deviceId} (type: ${deviceType}) with ${measurements.length} measurements`);
    
    return discoveryConfig;
  }

  /**
   * Extract device ID from source data
   * @param {Object} sourceData - Raw data
   * @param {Object} context - Context
   * @returns {string} Device ID
   */
  extractDeviceId(sourceData, context) {
    // Default implementation - should be overridden by subclasses
    return context.deviceId || 
           sourceData.id || 
           sourceData.deviceId ||
           `${this.sourceType}-${context.sourceId || 'unknown'}`;
  }

  /**
   * Determine device type from source data
   * @param {Object} sourceData - Raw data
   * @param {Object} context - Context
   * @returns {string} Device type
   */
  determineDeviceType(sourceData, context) {
    // Default implementation - should be overridden by subclasses
    return sourceData.type || 
           sourceData.deviceType || 
           context.deviceType ||
           this.sourceType.toUpperCase() + '_Device';
  }

  /**
   * Discover measurements from source data
   * @param {Object} sourceData - Raw data
   * @param {Object} context - Context
   * @returns {Array} Array of measurement definitions
   */
  discoverMeasurements(sourceData, context) {
    // Default implementation - extract all numeric/boolean properties
    const measurements = [];
    
    this.traverseObject(sourceData, '', (path, value) => {
      if (this.isMeasurementValue(value)) {
        measurements.push({
          id: this.pathToMeasurementId(path),
          name: path,
          type: this.inferDataType(value),
          sourcePath: path,
          unit: this.inferUnit(path, value)
        });
      }
    });

    return measurements;
  }

  /**
   * Traverse object recursively
   * @private
   */
  traverseObject(obj, prefix, callback) {
    for (const [key, value] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;
      
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        this.traverseObject(value, path, callback);
      } else if (!Array.isArray(value)) {
        callback(path, value);
      }
    }
  }

  /**
   * Check if value is a measurement
   * @private
   */
  isMeasurementValue(value) {
    return typeof value === 'number' || 
           typeof value === 'boolean' ||
           (typeof value === 'string' && !isNaN(parseFloat(value)));
  }

  /**
   * Convert path to measurement ID
   * @private
   */
  pathToMeasurementId(path) {
    return path.replace(/\./g, '_').toLowerCase();
  }

  /**
   * Infer data type from value
   * @param {*} value - Value to analyze
   * @returns {string} Data type (float, int, bool, string)
   */
  inferDataType(value) {
    if (typeof value === 'boolean') return 'bool';
    if (typeof value === 'string') {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        return Number.isInteger(num) ? 'int' : 'float';
      }
      return 'string';
    }
    if (Number.isInteger(value)) return 'int';
    if (typeof value === 'number') return 'float';
    return 'unknown';
  }

  /**
   * Infer unit from path/value
   * @private
   */
  inferUnit(path, value) {
    const lowerPath = path.toLowerCase();
    if (lowerPath.includes('temp')) return '°C';
    if (lowerPath.includes('pressure')) return 'bar';
    if (lowerPath.includes('humid')) return '%';
    if (lowerPath.includes('speed')) return 'rpm';
    if (lowerPath.includes('volt')) return 'V';
    if (lowerPath.includes('current')) return 'A';
    if (lowerPath.includes('power')) return 'W';
    return null;
  }

  /**
   * Extract metadata for discovery
   * @private
   */
  extractDiscoveryMetadata(sourceData, context) {
    return {
      endpoint: context.endpoint,
      protocol: this.sourceType,
      ...context.metadata
    };
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
   * Map source data using discovery configuration
   * Applica le regole di mapping da mapping.json
   * 
   * @param {Object} sourceData - Raw data from source
   * @param {Object} mappingConfig - Configuration from mapping.json
   * @param {Object} context - Additional context
   * @returns {Object} Mapped device in unified format
   */
  mapWithConfig(sourceData, mappingConfig, context = {}) {
    if (!mappingConfig) {
      logger.warn('No mapping configuration provided, using discovery');
      return this.map(sourceData, context);
    }

    const measurements = [];
    
    for (const measurementConfig of mappingConfig.measurements) {
      const value = this.extractValue(sourceData, measurementConfig.sourcePath);
      
      if (value !== undefined && value !== null) {
        let transformedValue = value;
        
        // Apply transformation if defined
        if (measurementConfig.transform) {
          transformedValue = this.applyTransformation(value, measurementConfig.transform);
        }

        measurements.push({
          id: measurementConfig.id,
          type: measurementConfig.type,
          value: transformedValue
        });
      }
    }

    const metadata = this.extractMetadata(sourceData, context);
    
    return {
      id: mappingConfig.id,
      type: mappingConfig.type,
      measurements,
      metadata
    };
  }

  /**
   * Extract value from source data using path
   * @param {Object} sourceData - Source data
   * @param {string} path - Dot-notation path (e.g., "sensor.temperature")
   * @returns {*} Extracted value
   */
  extractValue(sourceData, path) {
    if (!path) return undefined;
    
    const parts = path.split('.');
    let value = sourceData;
    
    for (const part of parts) {
      if (value === undefined || value === null) return undefined;
      value = value[part];
    }
    
    return value;
  }

  /**
   * Apply standard transformations
   * @param {*} value - Value to transform
   * @param {Object} transform - Transformation config
   * @returns {*} Transformed value
   */
  applyTransformation(value, transform) {
    if (!transform || !transform.type) return value;

    try {
      switch (transform.type) {
        case 'scale':
          return value * (transform.factor || 1);
        
        case 'offset':
          return value + (transform.offset || 0);
        
        case 'round':
          const decimals = transform.decimals || 0;
          return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
        
        case 'toString':
          return String(value);
        
        case 'toNumber':
          return Number(value);
        
        case 'toBoolean':
          return Boolean(value);
        
        case 'map':
          return transform.mapping?.[value] || value;
        
        case 'formula':
          // Supporto per formule custom (es. "(x * 0.1) + 32")
          if (transform.formula) {
            // Sostituisci x con il valore
            const formula = transform.formula.replace(/x/g, value);
            return eval(formula); // In produzione usa un parser più sicuro
          }
          return value;
        
        default:
          logger.warn(`Unknown transformation type: ${transform.type}`);
          return value;
      }
    } catch (error) {
      logger.error(`Error applying transformation ${transform.type}:`, error);
      return value;
    }
  }


  /**
   * Extract metadata from source data
   * @param {Object} sourceData - Raw data from the source
   * @param {Object} context - Additional context
   * @returns {Object} Metadata
   */
  extractMetadata(sourceData, context = {}) {
    return {
      timestamp: sourceData.timestamp || new Date().toISOString(),
      source: context.source || this.sourceType,
      sourceId: context.sourceId,
      quality: sourceData.quality || 'GOOD',
      ...context.metadata
    };
  }

  /**
   * Get all discovered devices
   * @returns {Array} Array of discovery configurations
   */
  getDiscoveredDevices() {
    return Array.from(this.discoveredDevices.values());
  }

  /**
   * Get mapper statistics
   * @returns {Object} Statistics
   */
  getStatistics() {
    return {
      sourceType: this.sourceType,
      mappingRulesCount: Object.keys(this.mappingRules).length,
      discoveredDevicesCount: this.discoveredDevices.size
    };
  }
}

module.exports = BaseMapper;
