const logger = require('../utils/logger');

// Import all storage adapters
const {
  MemoryStorageAdapter,
  RedisAdapter,
  TimescaleDBAdapter
} = require('./adapters');

class StorageFactory {
  static storageTypes = {
    'memory': MemoryStorageAdapter,
    'redis': RedisAdapter,
    'timescaledb': TimescaleDBAdapter,
    'timescale': TimescaleDBAdapter // Alias
  };

  static create(type, config) {
    const StorageAdapterClass = this.storageTypes[type.toLowerCase()];

    if (!StorageAdapterClass) {
      throw new Error(`Unsupported storage type: ${type}`);
    }

    try {
      const adapter = new StorageAdapterClass(config);
      logger.debug(`Created ${type} storage adapter`);
      return adapter;
    } catch (error) {
      logger.error(`Failed to create ${type} storage adapter:`, error);
      throw error;
    }
  }

  static getSupportedTypes() {
    return Object.keys(this.storageTypes);
  }

  static registerStorageType(type, StorageAdapterClass) {
    this.storageTypes[type.toLowerCase()] = StorageAdapterClass;
    logger.info(`Registered custom storage adapter: ${type}`);
  }

  static isTypeSupported(type) {
    return type.toLowerCase() in this.storageTypes;
  }
}

module.exports = StorageFactory;
