const EventEmitter = require('events');
const logger = require('../utils/logger');

class DataProcessor extends EventEmitter {
  constructor() {
    super();
    this.transforms = new Map();
    this.validators = new Map();
    this.initialized = false;
  }

  async initialize() {
    try {
      // Initialize built-in transforms
      this.registerBuiltInTransforms();
      
      // Initialize built-in validators
      this.registerBuiltInValidators();
      
      this.initialized = true;
      logger.info('Data processor initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize data processor:', error);
      throw error;
    }
  }

  registerBuiltInTransforms() {
    // Timestamp normalization transform
    this.transforms.set('normalizeTimestamp', (data) => {
      if (data.timestamp) {
        data.timestamp = new Date(data.timestamp).toISOString();
      }
      return data;
    });

    // Numeric value transform
    this.transforms.set('convertToNumber', (data) => {
      if (data.data && typeof data.data === 'object') {
        for (const [key, value] of Object.entries(data.data)) {
          if (typeof value === 'string' && !isNaN(value) && value.trim() !== '') {
            data.data[key] = parseFloat(value);
          }
        }
      }
      return data;
    });

    // Unit conversion transforms
    this.transforms.set('celsiusToFahrenheit', (data) => {
      if (data.data && data.data.temperature !== undefined) {
        data.data.temperatureF = (data.data.temperature * 9/5) + 32;
      }
      return data;
    });

    // Data flattening transform
    this.transforms.set('flattenObject', (data) => {
      if (data.data && typeof data.data === 'object') {
        data.data = this.flattenObject(data.data);
      }
      return data;
    });

    // Add quality indicators
    this.transforms.set('addQualityIndicators', (data) => {
      data.quality = {
        timestamp: new Date().toISOString(),
        valid: true,
        confidence: 1.0
      };
      return data;
    });
  }

  registerBuiltInValidators() {
    // Range validator
    this.validators.set('range', (data, config) => {
      if (config.field && data.data && data.data[config.field] !== undefined) {
        const value = data.data[config.field];
        if (typeof value === 'number') {
          return value >= config.min && value <= config.max;
        }
      }
      return true;
    });

    // Required fields validator
    this.validators.set('requiredFields', (data, config) => {
      if (config.fields && Array.isArray(config.fields)) {
        return config.fields.every(field => {
          return data.data && data.data[field] !== undefined && data.data[field] !== null;
        });
      }
      return true;
    });

    // Data type validator
    this.validators.set('dataType', (data, config) => {
      if (config.field && config.type && data.data && data.data[config.field] !== undefined) {
        const value = data.data[config.field];
        switch (config.type) {
          case 'number':
            return typeof value === 'number' && !isNaN(value);
          case 'string':
            return typeof value === 'string';
          case 'boolean':
            return typeof value === 'boolean';
          case 'object':
            return typeof value === 'object' && value !== null;
          default:
            return true;
        }
      }
      return true;
    });
  }

  async process(rawData) {
    try {
      let processedData = { ...rawData };

      // Apply transforms based on source configuration
      if (rawData.sourceId) {
        const sourceConfig = this.getSourceConfig(rawData.sourceId);
        if (sourceConfig && sourceConfig.dataProcessing && sourceConfig.dataProcessing.enabled) {
          
          // Apply configured transforms
          if (sourceConfig.dataProcessing.transforms) {
            for (const transformName of sourceConfig.dataProcessing.transforms) {
              processedData = await this.applyTransform(transformName, processedData);
            }
          }

          // Apply validation
          if (sourceConfig.dataProcessing.validation) {
            const isValid = await this.validateData(processedData, sourceConfig.dataProcessing.validation);
            if (!isValid) {
              logger.warn(`Data validation failed for source '${rawData.sourceId}'`);
              processedData.quality = processedData.quality || {};
              processedData.quality.valid = false;
              processedData.quality.validationError = 'Data validation failed';
            }
          }
        }
      }

      // Always apply basic transforms
      processedData = await this.applyTransform('normalizeTimestamp', processedData);
      processedData = await this.applyTransform('addQualityIndicators', processedData);

      // Add processing metadata
      processedData.processing = {
        processedAt: new Date().toISOString(),
        processingTime: Date.now() - new Date(rawData.timestamp).getTime()
      };

      this.emit('processed', processedData);
      
    } catch (error) {
      logger.error('Error processing data:', error);
      this.emit('error', error);
    }
  }

  async applyTransform(transformName, data) {
    const transform = this.transforms.get(transformName);
    if (transform) {
      try {
        return await transform(data);
      } catch (error) {
        logger.error(`Error applying transform '${transformName}':`, error);
        return data;
      }
    } else {
      logger.warn(`Transform '${transformName}' not found`);
      return data;
    }
  }

  async validateData(data, validationConfig) {
    try {
      for (const [validatorName, config] of Object.entries(validationConfig)) {
        const validator = this.validators.get(validatorName);
        if (validator) {
          const isValid = await validator(data, config);
          if (!isValid) {
            return false;
          }
        } else {
          logger.warn(`Validator '${validatorName}' not found`);
        }
      }
      return true;
    } catch (error) {
      logger.error('Error during data validation:', error);
      return false;
    }
  }

  getSourceConfig(sourceId) {
    // This should be implemented to get source config from ConfigManager
    // For now, return null to avoid circular dependencies
    return null;
  }

  flattenObject(obj, prefix = '') {
    const flattened = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}.${key}` : key;
      
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(flattened, this.flattenObject(value, newKey));
      } else {
        flattened[newKey] = value;
      }
    }
    
    return flattened;
  }

  registerTransform(name, transformFunction) {
    this.transforms.set(name, transformFunction);
    logger.info(`Registered custom transform: ${name}`);
  }

  registerValidator(name, validatorFunction) {
    this.validators.set(name, validatorFunction);
    logger.info(`Registered custom validator: ${name}`);
  }

  getAvailableTransforms() {
    return Array.from(this.transforms.keys());
  }

  getAvailableValidators() {
    return Array.from(this.validators.keys());
  }
}

module.exports = DataProcessor;
