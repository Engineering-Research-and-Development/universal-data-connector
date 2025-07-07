const { MongoClient } = require('mongodb');
const BaseStorageAdapter = require('../BaseStorageAdapter');
const logger = require('../../utils/logger');

class MongoDBAdapter extends BaseStorageAdapter {
  constructor(config) {
    super(config);
    this.client = null;
    this.db = null;
    this.collection = null;
    this.collectionName = config.collection || 'sensor_data';
    this.validateConfig();
  }

  validateConfig() {
    super.validateConfig();
    if (!this.config.url && !this.config.host) {
      throw new Error('MongoDB adapter requires either "url" or "host" in configuration');
    }
    if (!this.config.database) {
      throw new Error('MongoDB adapter requires "database" in configuration');
    }
  }

  async initialize() {
    await super.initialize();
    
    // Build connection URL if not provided
    let url = this.config.url;
    if (!url) {
      const auth = this.config.user && this.config.password ? 
        `${this.config.user}:${this.config.password}@` : '';
      const port = this.config.port || 27017;
      url = `mongodb://${auth}${this.config.host}:${port}/${this.config.database}`;
    }

    // Create MongoDB client
    this.client = new MongoClient(url, {
      maxPoolSize: this.config.maxConnections || 10,
      serverSelectionTimeoutMS: this.config.connectionTimeout || 5000,
      socketTimeoutMS: this.config.socketTimeout || 45000,
      ...this.config.options
    });

    logger.debug('MongoDB adapter initialized');
  }

  async connect() {
    try {
      // Connect to MongoDB
      await this.client.connect();
      
      // Get database and collection
      this.db = this.client.db(this.config.database);
      this.collection = this.db.collection(this.collectionName);
      
      // Create indexes
      await this.createIndexes();
      
      this.onConnected();
      return true;
      
    } catch (error) {
      logger.error('Failed to connect to MongoDB:', error);
      this.onError(error);
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.client) {
        await this.client.close();
        this.client = null;
        this.db = null;
        this.collection = null;
      }
      this.onDisconnected();
      return true;
    } catch (error) {
      logger.error('Error disconnecting from MongoDB:', error);
      this.onError(error);
      throw error;
    }
  }

  async createIndexes() {
    try {
      await this.collection.createIndexes([
        { key: { sourceId: 1 }, name: 'idx_source_id' },
        { key: { timestamp: -1 }, name: 'idx_timestamp' },
        { key: { storedAt: -1 }, name: 'idx_stored_at' },
        { key: { sourceId: 1, timestamp: -1 }, name: 'idx_source_timestamp' },
        { key: { 'data.$**': 'text', 'metadata.$**': 'text' }, name: 'idx_text_search' }
      ]);
      
      logger.debug(`Created/verified MongoDB indexes for collection: ${this.collectionName}`);
    } catch (error) {
      logger.error('Error creating MongoDB indexes:', error);
      throw error;
    }
  }

  async store(data) {
    try {
      const record = this.createDataRecord(data);
      
      // Convert timestamp strings to Date objects
      record.timestamp = new Date(record.timestamp);
      record.storedAt = new Date(record.storedAt);
      
      const result = await this.collection.insertOne(record);
      this.onWrite();
      
      return result.insertedId.toString();
      
    } catch (error) {
      logger.error('Error storing data in MongoDB:', error);
      this.onError(error);
      throw error;
    }
  }

  async query(criteria) {
    try {
      const filter = {};
      
      if (criteria.sourceId) {
        filter.sourceId = criteria.sourceId;
      }

      if (criteria.startTime && criteria.endTime) {
        filter.timestamp = {
          $gte: new Date(criteria.startTime),
          $lte: new Date(criteria.endTime)
        };
      }

      const limit = criteria.limit || 100;
      
      const cursor = this.collection
        .find(filter)
        .sort({ timestamp: -1 })
        .limit(limit);

      const results = await cursor.toArray();
      this.onRead();

      return results.map(doc => ({
        id: doc._id.toString(),
        sourceId: doc.sourceId,
        sourceType: doc.sourceType,
        timestamp: doc.timestamp.toISOString(),
        data: doc.data,
        metadata: doc.metadata || {},
        quality: doc.quality || {},
        processing: doc.processing || {},
        storedAt: doc.storedAt.toISOString()
      }));

    } catch (error) {
      logger.error('Error querying MongoDB:', error);
      this.onError(error);
      throw error;
    }
  }

  async getLatest(limit = 100) {
    return this.query({ limit });
  }

  async getBySource(sourceId, limit = 100) {
    return this.query({ sourceId, limit });
  }

  async getByTimeRange(startTime, endTime) {
    return this.query({ startTime, endTime });
  }

  async search(query) {
    try {
      // Use MongoDB text search
      const filter = {
        $or: [
          { sourceId: { $regex: query, $options: 'i' } },
          { $text: { $search: query } }
        ]
      };

      const cursor = this.collection
        .find(filter)
        .sort({ timestamp: -1 })
        .limit(100);

      const results = await cursor.toArray();
      this.onRead();

      return results.map(doc => ({
        id: doc._id.toString(),
        sourceId: doc.sourceId,
        sourceType: doc.sourceType,
        timestamp: doc.timestamp.toISOString(),
        data: doc.data,
        metadata: doc.metadata || {},
        quality: doc.quality || {},
        processing: doc.processing || {},
        storedAt: doc.storedAt.toISOString()
      }));

    } catch (error) {
      logger.error('Error searching MongoDB:', error);
      this.onError(error);
      throw error;
    }
  }

  async clear() {
    try {
      const count = await this.collection.countDocuments();
      await this.collection.deleteMany({});
      
      logger.info(`Cleared ${count} documents from MongoDB collection ${this.collectionName}`);
      return count;
      
    } catch (error) {
      logger.error('Error clearing MongoDB collection:', error);
      this.onError(error);
      throw error;
    }
  }

  async getStats() {
    try {
      const baseStats = await super.getStats();
      
      const totalCount = await this.collection.countDocuments();
      const recentCount = await this.collection.countDocuments({
        storedAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) }
      });
      
      const collStats = await this.db.stats();
      const collectionStats = await this.collection.stats();

      return {
        ...baseStats,
        storage: {
          totalRecords: totalCount,
          recentRecords: recentCount,
          collectionSizeBytes: collectionStats.size,
          collectionSizeMB: Math.round(collectionStats.size / 1024 / 1024 * 100) / 100,
          indexSizeBytes: collectionStats.totalIndexSize,
          indexSizeMB: Math.round(collectionStats.totalIndexSize / 1024 / 1024 * 100) / 100,
          avgDocumentSize: collectionStats.avgObjSize
        }
      };

    } catch (error) {
      logger.error('Error getting MongoDB stats:', error);
      const baseStats = await super.getStats();
      return { ...baseStats, storage: { error: error.message } };
    }
  }

  async healthCheck() {
    try {
      // Run ping command to check connection
      const pingResult = await this.db.admin().ping();
      
      const baseHealth = await super.healthCheck();
      
      return {
        ...baseHealth,
        details: {
          ping: pingResult.ok === 1 ? 'success' : 'failed',
          database: this.config.database,
          collection: this.collectionName,
          serverStatus: await this.getServerStatus()
        }
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        type: this.type,
        lastCheck: new Date().toISOString(),
        error: error.message,
        details: {
          database: this.config.database,
          collection: this.collectionName
        }
      };
    }
  }

  async getServerStatus() {
    try {
      const serverStatus = await this.db.admin().serverStatus();
      return {
        version: serverStatus.version,
        uptime: serverStatus.uptime,
        connections: serverStatus.connections
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  // MongoDB-specific methods
  async aggregate(pipeline) {
    try {
      const cursor = this.collection.aggregate(pipeline);
      const results = await cursor.toArray();
      this.onRead();
      return results;
    } catch (error) {
      logger.error('Error running MongoDB aggregation:', error);
      this.onError(error);
      throw error;
    }
  }

  async createCustomIndex(indexSpec, options = {}) {
    try {
      await this.collection.createIndex(indexSpec, options);
      logger.info('Created custom MongoDB index:', indexSpec);
    } catch (error) {
      logger.error('Error creating custom MongoDB index:', error);
      throw error;
    }
  }
}

module.exports = MongoDBAdapter;
