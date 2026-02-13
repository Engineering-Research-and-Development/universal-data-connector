const BaseMapper = require('../BaseMapper');
const logger = require('../../utils/logger');

/**
 * GenericMapper - Generic mapper for protocols without specific mapper
 * 
 * Mappa automaticamente qualsiasi sorgente dati nel nuovo formato unificato
 */
class GenericMapper extends BaseMapper {
  constructor(options = {}) {
    super(options);
  }

  /**
   * Map source data to new unified format
   * @param {Object} sourceData - Raw data from source
   * @param {Object} context - Additional context
   * @returns {Object} Device in unified format
   */
  map(sourceData, context = {}) {
    if (!this.validate(sourceData)) {
      return null;
    }

    const deviceId = this.extractDeviceId(sourceData, context);
    const deviceType = this.determineDeviceType(sourceData, context);
    const measurements = this.extractMeasurements(sourceData, context);
    const metadata = this.extractMetadata(sourceData, context);

    return {
      id: deviceId,
      type: deviceType,
      measurements,
      metadata
    };
  }

  /**
   * Extract measurements from source data
   * @param {Object} sourceData - Raw data
   * @param {Object} context - Context
   * @returns {Array} Array of measurements
   */
  extractMeasurements(sourceData, context) {
    const measurements = [];
    
    // Estrai tutti i valori numerici/booleani/stringhe come measurements
    this.traverseObject(sourceData, '', (path, value) => {
      // Skip metadata fields
      if (['timestamp', 'source', 'quality', 'type', 'id', 'deviceId'].includes(path)) {
        return;
      }

      if (this.isMeasurementValue(value)) {
        measurements.push({
          id: this.pathToMeasurementId(path),
          type: this.inferDataType(value),
          value: value
        });
      }
    });

    return measurements;
  }

  /**
   * Determine device type from source data
   * @param {Object} sourceData - Raw data
   * @param {Object} context - Context
   * @returns {string} Device type
   */
  determineDeviceType(sourceData, context) {
    return sourceData.type || 
           sourceData.deviceType || 
           context.deviceType ||
           this.sourceType.toUpperCase() + '_Device';
  }
}

module.exports = GenericMapper;

