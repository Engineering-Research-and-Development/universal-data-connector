const EventEmitter = require('events');
const logger = require('../utils/logger');

class BaseStorageAdapter extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.type = config.type;
    this.isConnected = false;
    this.isInitialized = false;
    this.stats = {
      totalWrites: 0,
      totalReads: 0,
      totalErrors: 0,
      lastWrite: null,
      lastRead: null,
      connectionTime: null
    };
  }

  async initialize() {
    logger.debug(`Initializing ${this.type} storage adapter`);
    this.isInitialized = true;
    // Override in subclasses
  }

  async connect() {
    // Override in subclasses
    throw new Error('connect() method must be implemented by subclass');
  }

  async disconnect() {
    // Override in subclasses
    throw new Error('disconnect() method must be implemented by subclass');
  }

  async store(data) {
    // Override in subclasses
    throw new Error('store() method must be implemented by subclass');
  }

  async query(criteria) {
    // Override in subclasses
    throw new Error('query() method must be implemented by subclass');
  }

  async getLatest(limit = 100) {
    // Override in subclasses
    throw new Error('getLatest() method must be implemented by subclass');
  }

  async getBySource(sourceId, limit = 100) {
    // Override in subclasses
    throw new Error('getBySource() method must be implemented by subclass');
  }

  async getByTimeRange(startTime, endTime) {
    // Override in subclasses
    throw new Error('getByTimeRange() method must be implemented by subclass');
  }

  async search(query) {
    // Override in subclasses
    throw new Error('search() method must be implemented by subclass');
  }

  async clear() {
    // Override in subclasses
    throw new Error('clear() method must be implemented by subclass');
  }

  async getStats() {
    return {
      type: this.type,
      isConnected: this.isConnected,
      isInitialized: this.isInitialized,
      stats: this.stats
    };
  }

  onConnected() {
    this.isConnected = true;
    this.stats.connectionTime = new Date();
    logger.info(`${this.type} storage adapter connected`);
    this.emit('connected');
  }

  onDisconnected() {
    this.isConnected = false;
    logger.warn(`${this.type} storage adapter disconnected`);
    this.emit('disconnected');
  }

  onError(error) {
    this.stats.totalErrors++;
    logger.error(`${this.type} storage adapter error:`, error);
    this.emit('error', error);
  }

  onWrite() {
    this.stats.totalWrites++;
    this.stats.lastWrite = new Date();
  }

  onRead() {
    this.stats.totalReads++;
    this.stats.lastRead = new Date();
  }

  validateConfig() {
    if (!this.config.type) {
      throw new Error('Storage configuration must include a type');
    }
  }

  // Utility method to create standardized data structure
  createDataRecord(data) {
    return {
      id: this.generateId(),
      sourceId: data.sourceId,
      sourceType: data.sourceType,
      timestamp: data.timestamp,
      data: data.data,
      metadata: data.metadata || {},
      quality: data.quality || {},
      processing: data.processing || {},
      storedAt: new Date().toISOString()
    };
  }

  generateId() {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Helper methods for data transformation
  serializeData(data) {
    if (typeof data === 'object') {
      return JSON.stringify(data);
    }
    return data;
  }

  deserializeData(data) {
    if (typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch (error) {
        return data;
      }
    }
    return data;
  }

  // Health check method
  async healthCheck() {
    try {
      // Basic connectivity test - override in subclasses for specific checks
      return {
        status: this.isConnected ? 'healthy' : 'unhealthy',
        type: this.type,
        lastCheck: new Date().toISOString(),
        stats: this.stats
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        type: this.type,
        lastCheck: new Date().toISOString(),
        error: error.message,
        stats: this.stats
      };
    }
  }
}

module.exports = BaseStorageAdapter;
