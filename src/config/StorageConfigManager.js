const fs = require('fs').promises;
const path = require('path');
const Joi = require('joi');
const logger = require('../utils/logger');

// Schema per validazione configurazione storage
const storageConfigSchema = Joi.object({
  storage: Joi.object({
    type: Joi.string().valid('memory', 'postgresql', 'postgres', 'mariadb', 'mysql', 'mongodb', 'mongo', 'redis').required(),
    config: Joi.object().required()
  }).required()
}).unknown(true);

// Schema specifici per ogni tipo di storage
const postgresConfigSchema = Joi.object({
  host: Joi.string().required(),
  port: Joi.number().integer().min(1).max(65535).default(5432),
  database: Joi.string().required(),
  user: Joi.string().required(),
  password: Joi.string().allow('').required(),
  tableName: Joi.string().default('sensor_data'),
  maxConnections: Joi.number().integer().min(1).default(10),
  idleTimeout: Joi.number().integer().min(1000).default(30000),
  connectionTimeout: Joi.number().integer().min(1000).default(2000),
  ssl: Joi.alternatives().try(Joi.boolean(), Joi.object()).default(false)
});

const mariadbConfigSchema = Joi.object({
  host: Joi.string().required(),
  port: Joi.number().integer().min(1).max(65535).default(3306),
  database: Joi.string().required(),
  user: Joi.string().required(),
  password: Joi.string().allow('').required(),
  tableName: Joi.string().default('sensor_data'),
  maxConnections: Joi.number().integer().min(1).default(10),
  connectionTimeout: Joi.number().integer().min(1000).default(60000),
  queryTimeout: Joi.number().integer().min(1000).default(60000),
  ssl: Joi.alternatives().try(Joi.boolean(), Joi.object()).default(false)
});

const mongodbConfigSchema = Joi.object({
  url: Joi.string().optional(),
  host: Joi.string().when('url', { is: Joi.exist(), then: Joi.optional(), otherwise: Joi.required() }),
  port: Joi.number().integer().min(1).max(65535).default(27017),
  database: Joi.string().required(),
  user: Joi.string().allow('').optional(),
  password: Joi.string().allow('').optional(),
  collection: Joi.string().default('sensor_data'),
  maxConnections: Joi.number().integer().min(1).default(10),
  connectionTimeout: Joi.number().integer().min(1000).default(5000),
  socketTimeout: Joi.number().integer().min(1000).default(45000),
  options: Joi.object().default({})
});

const redisConfigSchema = Joi.object({
  url: Joi.string().optional(),
  host: Joi.string().when('url', { is: Joi.exist(), then: Joi.optional(), otherwise: Joi.required() }),
  port: Joi.number().integer().min(1).max(65535).default(6379),
  database: Joi.number().integer().min(0).default(0),
  password: Joi.string().allow('').optional(),
  keyPrefix: Joi.string().default('udc:'),
  maxEntries: Joi.number().integer().min(100).default(10000),
  ttl: Joi.number().integer().min(60).optional(),
  connectTimeout: Joi.number().integer().min(1000).default(10000),
  commandTimeout: Joi.number().integer().min(1000).default(5000),
  options: Joi.object().default({})
});

const memoryConfigSchema = Joi.object({
  maxDataPoints: Joi.number().integer().min(100).default(10000)
});

class StorageConfigManager {
  constructor() {
    this.configPath = path.join(process.cwd(), 'config');
    this.storageConfigFile = path.join(this.configPath, 'storage.json');
    this.storageConfig = null;
    this.initialized = false;
  }

  async initialize() {
    try {
      // Create config directory if it doesn't exist
      await this.ensureConfigDirectory();
      
      // Load or create default storage configuration
      await this.loadStorageConfig();
      
      this.initialized = true;
      logger.info('Storage configuration manager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize storage configuration manager:', error);
      throw error;
    }
  }

  async ensureConfigDirectory() {
    try {
      await fs.access(this.configPath);
    } catch (error) {
      await fs.mkdir(this.configPath, { recursive: true });
      logger.info('Created config directory');
    }
  }

  async loadStorageConfig() {
    try {
      // Check if storage config file exists
      await fs.access(this.storageConfigFile);
      
      // Read and parse the configuration
      const configData = await fs.readFile(this.storageConfigFile, 'utf8');
      const config = JSON.parse(configData);
      
      // Validate configuration
      const { error, value } = this.validateStorageConfig(config);
      if (error) {
        throw new Error(`Invalid storage configuration: ${error.details[0].message}`);
      }
      
      this.storageConfig = value.storage;
      logger.info(`Loaded storage configuration: ${this.storageConfig.type}`);
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, create default configuration
        logger.info('Storage configuration file not found, creating default configuration');
        await this.createDefaultConfig();
      } else {
        throw error;
      }
    }
  }

  validateStorageConfig(config) {
    // First validate the main structure
    const { error: mainError, value: mainValue } = storageConfigSchema.validate(config);
    if (mainError) {
      return { error: mainError };
    }

    // Then validate the specific storage type configuration
    const storageType = mainValue.storage.type;
    const storageConfig = mainValue.storage.config;
    
    let specificSchema;
    switch (storageType.toLowerCase()) {
      case 'postgresql':
      case 'postgres':
        specificSchema = postgresConfigSchema;
        break;
      case 'mariadb':
      case 'mysql':
        specificSchema = mariadbConfigSchema;
        break;
      case 'mongodb':
      case 'mongo':
        specificSchema = mongodbConfigSchema;
        break;
      case 'redis':
        specificSchema = redisConfigSchema;
        break;
      case 'memory':
        specificSchema = memoryConfigSchema;
        break;
      default:
        return { error: new Error(`Unsupported storage type: ${storageType}`) };
    }

    const { error: specificError, value: specificValue } = specificSchema.validate(storageConfig);
    if (specificError) {
      return { error: specificError };
    }

    return {
      value: {
        storage: {
          type: storageType,
          config: specificValue
        }
      }
    };
  }

  async createDefaultConfig() {
    const defaultConfig = {
      storage: {
        type: "memory",
        config: {
          maxDataPoints: 10000
        }
      }
    };

    await fs.writeFile(
      this.storageConfigFile, 
      JSON.stringify(defaultConfig, null, 2), 
      'utf8'
    );
    
    this.storageConfig = defaultConfig.storage;
    logger.info('Created default storage configuration (memory)');
  }

  getStorageConfig() {
    return this.storageConfig;
  }

  async updateStorageConfig(newConfig) {
    // Validate the new configuration
    const { error, value } = this.validateStorageConfig({ storage: newConfig });
    if (error) {
      throw new Error(`Invalid storage configuration: ${error.details[0].message}`);
    }

    this.storageConfig = value.storage;
    
    // Save to file
    const configToSave = { storage: this.storageConfig };
    await fs.writeFile(
      this.storageConfigFile, 
      JSON.stringify(configToSave, null, 2), 
      'utf8'
    );
    
    logger.info(`Updated storage configuration: ${this.storageConfig.type}`);
    return this.storageConfig;
  }

  async reloadConfig() {
    logger.info('Reloading storage configuration...');
    await this.loadStorageConfig();
    logger.info('Storage configuration reloaded successfully');
  }

  isInitialized() {
    return this.initialized;
  }

  getSupportedStorageTypes() {
    return ['memory', 'postgresql', 'postgres', 'mariadb', 'mysql', 'mongodb', 'mongo', 'redis'];
  }

  getConfigSchema(storageType) {
    switch (storageType.toLowerCase()) {
      case 'postgresql':
      case 'postgres':
        return postgresConfigSchema.describe();
      case 'mariadb':
      case 'mysql':
        return mariadbConfigSchema.describe();
      case 'mongodb':
      case 'mongo':
        return mongodbConfigSchema.describe();
      case 'redis':
        return redisConfigSchema.describe();
      case 'memory':
        return memoryConfigSchema.describe();
      default:
        throw new Error(`Unsupported storage type: ${storageType}`);
    }
  }

  async getConfig() {
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      const configData = await fs.readFile(this.storageConfigFile, 'utf8');
      const fullConfig = JSON.parse(configData);
      return fullConfig;
    } catch (error) {
      logger.warn('Storage config file not found, returning current config');
      return { storage: this.storageConfig };
    }
  }

  async testConnection(type, config) {
    const startTime = Date.now();
    
    try {
      const StorageFactory = require('../storage/StorageFactory');
      const adapter = StorageFactory.createAdapter(type, config);
      
      // Test connection
      await adapter.connect();
      
      // Test basic operations
      const testData = {
        id: 'test-connection',
        sourceId: 'test',
        timestamp: new Date(),
        data: { test: true }
      };
      
      await adapter.store(testData);
      const retrieved = await adapter.getLatest('test', 1);
      await adapter.clear();
      await adapter.disconnect();
      
      const responseTime = Date.now() - startTime;
      
      return {
        success: true,
        message: 'Connection test successful',
        responseTime,
        details: {
          canConnect: true,
          canStore: true,
          canRetrieve: retrieved.length > 0,
          canClear: true
        }
      };
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        success: false,
        message: `Connection test failed: ${error.message}`,
        responseTime,
        details: {
          error: error.message,
          stack: error.stack
        }
      };
    }
  }

  async getStorageHealth() {
    if (!this.storageConfig) {
      return {
        type: 'unknown',
        status: 'unavailable',
        health: {
          responsive: false,
          error: 'Storage configuration not loaded',
          lastCheck: new Date().toISOString()
        },
        statistics: null,
        lastCheck: new Date().toISOString()
      };
    }
    try {
      const StorageFactory = require('../storage/StorageFactory');
      const adapter = StorageFactory.createAdapter(
        this.storageConfig.type, 
        this.storageConfig.config
      );
      
      const startTime = Date.now();
      await adapter.connect();
      const stats = await adapter.getStatistics();
      await adapter.disconnect();
      const responseTime = Date.now() - startTime;
      
      return {
        type: this.storageConfig?.type ?? 'unknown',
        status: 'healthy',
        health: {
          responsive: true,
          responseTime,
          lastCheck: new Date().toISOString()
        },
        statistics: stats,
        lastCheck: new Date().toISOString()
      };
      
    } catch (error) {
      return {
        type: this.storageConfig?.type ?? 'unknown',
        status: 'unhealthy',
        health: {
          responsive: false,
          error: error.message,
          lastCheck: new Date().toISOString()
        },
        statistics: null,
        lastCheck: new Date().toISOString()
      };
    }
  }

  async validateConfig(type, config) {
    try {
      let schema;
      
      switch (type.toLowerCase()) {
        case 'postgresql':
        case 'postgres':
          schema = postgresConfigSchema;
          break;
        case 'mariadb':
        case 'mysql':
          schema = mariadbConfigSchema;
          break;
        case 'mongodb':
        case 'mongo':
          schema = mongodbConfigSchema;
          break;
        case 'redis':
          schema = redisConfigSchema;
          break;
        case 'memory':
          schema = memoryConfigSchema;
          break;
        default:
          throw new Error(`Unsupported storage type: ${type}`);
      }
      
      const { error, value } = schema.validate(config);
      
      if (error) {
        return {
          valid: false,
          errors: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
            value: detail.context?.value
          }))
        };
      }
      
      return {
        valid: true,
        config: value
      };
      
    } catch (error) {
      return {
        valid: false,
        errors: [{
          field: 'type',
          message: error.message,
          value: type
        }]
      };
    }
  }
}

// Singleton instance
const storageConfigManager = new StorageConfigManager();

module.exports = storageConfigManager;
