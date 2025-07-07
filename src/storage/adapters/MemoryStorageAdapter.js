const BaseStorageAdapter = require('../BaseStorageAdapter');
const logger = require('../../utils/logger');

class MemoryStorageAdapter extends BaseStorageAdapter {
  constructor(config) {
    super(config);
    this.data = [];
    this.maxDataPoints = config.maxDataPoints || 10000;
    this.validateConfig();
  }

  validateConfig() {
    super.validateConfig();
    // Memory storage doesn't need additional validation
  }

  async initialize() {
    await super.initialize();
    this.data = [];
    logger.debug('Memory storage adapter initialized');
  }

  async connect() {
    // Memory storage is always "connected"
    this.onConnected();
    return true;
  }

  async disconnect() {
    this.onDisconnected();
    return true;
  }

  async store(data) {
    try {
      const record = this.createDataRecord(data);
      
      // Add to beginning of array (most recent first)
      this.data.unshift(record);

      // Enforce max data points limit
      if (this.data.length > this.maxDataPoints) {
        this.data = this.data.slice(0, this.maxDataPoints);
      }

      this.onWrite();
      return record.id;
      
    } catch (error) {
      this.onError(error);
      throw error;
    }
  }

  async query(criteria) {
    try {
      this.onRead();
      
      let results = [...this.data];

      // Apply filters
      if (criteria.sourceId) {
        results = results.filter(item => item.sourceId === criteria.sourceId);
      }

      if (criteria.startTime && criteria.endTime) {
        const start = new Date(criteria.startTime);
        const end = new Date(criteria.endTime);
        results = results.filter(item => {
          const itemTime = new Date(item.timestamp);
          return itemTime >= start && itemTime <= end;
        });
      }

      if (criteria.limit) {
        results = results.slice(0, criteria.limit);
      }

      return results;
      
    } catch (error) {
      this.onError(error);
      throw error;
    }
  }

  async getLatest(limit = 100) {
    try {
      this.onRead();
      const actualLimit = Math.min(limit, this.data.length);
      return this.data.slice(0, actualLimit);
    } catch (error) {
      this.onError(error);
      throw error;
    }
  }

  async getBySource(sourceId, limit = 100) {
    try {
      this.onRead();
      const sourceData = this.data.filter(item => item.sourceId === sourceId);
      const actualLimit = Math.min(limit, sourceData.length);
      return sourceData.slice(0, actualLimit);
    } catch (error) {
      this.onError(error);
      throw error;
    }
  }

  async getByTimeRange(startTime, endTime) {
    try {
      this.onRead();
      const start = new Date(startTime);
      const end = new Date(endTime);
      
      return this.data.filter(item => {
        const itemTime = new Date(item.timestamp);
        return itemTime >= start && itemTime <= end;
      });
    } catch (error) {
      this.onError(error);
      throw error;
    }
  }

  async search(query) {
    try {
      this.onRead();
      const results = [];
      const queryLower = query.toLowerCase();

      for (const item of this.data) {
        // Search in source ID
        if (item.sourceId && item.sourceId.toLowerCase().includes(queryLower)) {
          results.push(item);
          continue;
        }

        // Search in data fields
        if (item.data && typeof item.data === 'object') {
          const dataStr = JSON.stringify(item.data).toLowerCase();
          if (dataStr.includes(queryLower)) {
            results.push(item);
            continue;
          }
        }

        // Search in metadata
        if (item.metadata && typeof item.metadata === 'object') {
          const metaStr = JSON.stringify(item.metadata).toLowerCase();
          if (metaStr.includes(queryLower)) {
            results.push(item);
            continue;
          }
        }
      }

      return results;
    } catch (error) {
      this.onError(error);
      throw error;
    }
  }

  async clear() {
    try {
      const clearedCount = this.data.length;
      this.data = [];
      logger.info(`Cleared ${clearedCount} data points from memory storage`);
      return clearedCount;
    } catch (error) {
      this.onError(error);
      throw error;
    }
  }

  async getStats() {
    const baseStats = await super.getStats();
    
    return {
      ...baseStats,
      storage: {
        totalRecords: this.data.length,
        maxCapacity: this.maxDataPoints,
        utilizationPercent: (this.data.length / this.maxDataPoints) * 100,
        memoryUsage: {
          approximate: Math.round(JSON.stringify(this.data).length / 1024), // KB
          records: this.data.length
        }
      }
    };
  }

  async healthCheck() {
    try {
      const baseHealth = await super.healthCheck();
      
      return {
        ...baseHealth,
        details: {
          recordCount: this.data.length,
          maxCapacity: this.maxDataPoints,
          memoryUsage: Math.round(JSON.stringify(this.data).length / 1024) // KB
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        type: this.type,
        lastCheck: new Date().toISOString(),
        error: error.message
      };
    }
  }
}

module.exports = MemoryStorageAdapter;
