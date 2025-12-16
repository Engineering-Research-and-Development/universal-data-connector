/**
 * MappingTools Module
 * 
 * This module provides a comprehensive data mapping framework for the
 * Universal Data Connector. It enables mapping data from various industrial
 * protocols and sources to a unified Universal Data Model.
 * 
 * Key Components:
 * - MappingEngine: Core engine for managing mappings
 * - UniversalDataModel: Unified data model for all sources
 * - BaseMapper: Base class for protocol-specific mappers
 * - Protocol-specific mappers: OPC UA, Modbus, AAS, MQTT, etc.
 * 
 * Export Formats:
 * - JSON: Standard JSON format
 * - NGSI-LD: FIWARE NGSI-LD format for Context Brokers
 * - TOON: Custom TOON format (to be defined)
 * 
 * @module mappingTools
 */

const MappingEngine = require('./MappingEngine');
const UniversalDataModel = require('./UniversalDataModel');
const BaseMapper = require('./BaseMapper');

// Import all mappers
const {
  OPCUAMapper,
  ModbusMapper,
  AASMapper,
  MQTTMapper,
  GenericMapper
} = require('./mappers');

module.exports = {
  // Core classes
  MappingEngine,
  UniversalDataModel,
  BaseMapper,
  
  // Protocol-specific mappers
  mappers: {
    OPCUAMapper,
    ModbusMapper,
    AASMapper,
    MQTTMapper,
    GenericMapper
  },

  /**
   * Create a new mapping engine instance
   * @param {Object} config - Configuration options
   * @returns {MappingEngine} Mapping engine instance
   */
  createMappingEngine(config = {}) {
    return new MappingEngine(config);
  },

  /**
   * Create a new universal data model instance
   * @param {Object} options - Model options
   * @returns {UniversalDataModel} Data model instance
   */
  createDataModel(options = {}) {
    return new UniversalDataModel(options);
  },

  /**
   * Create a custom mapper
   * @param {string} sourceType - Source type identifier
   * @param {Object} options - Mapper options
   * @returns {BaseMapper} Mapper instance
   */
  createMapper(sourceType, options = {}) {
    return new BaseMapper({ ...options, sourceType });
  }
};
