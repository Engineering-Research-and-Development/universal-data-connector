const logger = require('../utils/logger');

// Import storage adapters
const MemoryStorageAdapter = require('./adapters/MemoryStorageAdapter');
const PostgreSQLAdapter = require('./adapters/PostgreSQLAdapter');
const MariaDBAdapter = require('./adapters/MariaDBAdapter');
const MongoDBAdapter = require('./adapters/MongoDBAdapter');
const RedisAdapter = require('./adapters/RedisAdapter');

class StorageFactory {
  static storageTypes = {
    'memory': MemoryStorageAdapter,
    'postgresql': PostgreSQLAdapter,
    'postgres': PostgreSQLAdapter, // Alias
    'mariadb': MariaDBAdapter,
    'mongodb': MongoDBAdapter,
    'mongo': MongoDBAdapter, // Alias
    'redis': RedisAdapter
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
