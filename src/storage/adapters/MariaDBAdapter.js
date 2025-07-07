const mariadb = require('mariadb');
const BaseStorageAdapter = require('../BaseStorageAdapter');
const logger = require('../../utils/logger');

class MariaDBAdapter extends BaseStorageAdapter {
  constructor(config) {
    super(config);
    this.pool = null;
    this.tableName = config.tableName || 'sensor_data';
    this.validateConfig();
  }

  validateConfig() {
    super.validateConfig();
    const required = ['host', 'port', 'database', 'user', 'password'];
    for (const field of required) {
      if (!this.config[field]) {
        throw new Error(`MariaDB adapter requires '${field}' in configuration`);
      }
    }
  }

  async initialize() {
    await super.initialize();
    
    // Create connection pool
    this.pool = mariadb.createPool({
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
      connectionLimit: this.config.maxConnections || 10,
      acquireTimeout: this.config.connectionTimeout || 60000,
      timeout: this.config.queryTimeout || 60000,
      ssl: this.config.ssl || false,
      charset: 'utf8mb4'
    });

    logger.debug('MariaDB adapter initialized');
  }

  async connect() {
    try {
      // Test connection
      const connection = await this.pool.getConnection();
      connection.end();
      
      // Create table if not exists
      await this.createTable();
      
      this.onConnected();
      return true;
      
    } catch (error) {
      logger.error('Failed to connect to MariaDB:', error);
      this.onError(error);
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.pool) {
        await this.pool.end();
        this.pool = null;
      }
      this.onDisconnected();
      return true;
    } catch (error) {
      logger.error('Error disconnecting from MariaDB:', error);
      this.onError(error);
      throw error;
    }
  }

  async createTable() {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id VARCHAR(255) PRIMARY KEY,
        source_id VARCHAR(255) NOT NULL,
        source_type VARCHAR(100) NOT NULL,
        timestamp DATETIME(3) NOT NULL,
        data JSON NOT NULL,
        metadata JSON,
        quality JSON,
        processing JSON,
        stored_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
        created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        INDEX idx_source_id (source_id),
        INDEX idx_timestamp (timestamp),
        INDEX idx_stored_at (stored_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    try {
      await this.pool.query(createTableQuery);
      logger.debug(`Created/verified MariaDB table: ${this.tableName}`);
    } catch (error) {
      logger.error('Error creating MariaDB table:', error);
      throw error;
    }
  }

  async store(data) {
    try {
      const record = this.createDataRecord(data);
      
      const insertQuery = `
        INSERT INTO ${this.tableName} 
        (id, source_id, source_type, timestamp, data, metadata, quality, processing, stored_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const values = [
        record.id,
        record.sourceId,
        record.sourceType,
        new Date(record.timestamp),
        JSON.stringify(record.data),
        JSON.stringify(record.metadata),
        JSON.stringify(record.quality),
        JSON.stringify(record.processing),
        new Date(record.storedAt)
      ];

      const result = await this.pool.query(insertQuery, values);
      this.onWrite();
      
      return record.id;
      
    } catch (error) {
      logger.error('Error storing data in MariaDB:', error);
      this.onError(error);
      throw error;
    }
  }

  async query(criteria) {
    try {
      let whereClause = 'WHERE 1=1';
      const values = [];

      if (criteria.sourceId) {
        whereClause += ' AND source_id = ?';
        values.push(criteria.sourceId);
      }

      if (criteria.startTime && criteria.endTime) {
        whereClause += ' AND timestamp BETWEEN ? AND ?';
        values.push(new Date(criteria.startTime), new Date(criteria.endTime));
      }

      const limit = criteria.limit || 100;
      const orderBy = 'ORDER BY timestamp DESC';
      const limitClause = `LIMIT ${limit}`;

      const selectQuery = `
        SELECT id, source_id, source_type, timestamp, data, metadata, quality, processing, stored_at
        FROM ${this.tableName}
        ${whereClause}
        ${orderBy}
        ${limitClause}
      `;

      const rows = await this.pool.query(selectQuery, values);
      this.onRead();

      return rows.map(row => ({
        id: row.id,
        sourceId: row.source_id,
        sourceType: row.source_type,
        timestamp: row.timestamp.toISOString(),
        data: this.deserializeData(row.data),
        metadata: this.deserializeData(row.metadata),
        quality: this.deserializeData(row.quality),
        processing: this.deserializeData(row.processing),
        storedAt: row.stored_at.toISOString()
      }));

    } catch (error) {
      logger.error('Error querying MariaDB:', error);
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
      const searchQuery = `
        SELECT id, source_id, source_type, timestamp, data, metadata, quality, processing, stored_at
        FROM ${this.tableName}
        WHERE 
          source_id LIKE ? OR
          JSON_SEARCH(data, 'one', ?, NULL, '$') IS NOT NULL OR
          JSON_SEARCH(metadata, 'one', ?, NULL, '$') IS NOT NULL
        ORDER BY timestamp DESC
        LIMIT 100
      `;

      const searchTerm = `%${query}%`;
      const rows = await this.pool.query(searchQuery, [searchTerm, searchTerm, searchTerm]);
      this.onRead();

      return rows.map(row => ({
        id: row.id,
        sourceId: row.source_id,
        sourceType: row.source_type,
        timestamp: row.timestamp.toISOString(),
        data: this.deserializeData(row.data),
        metadata: this.deserializeData(row.metadata),
        quality: this.deserializeData(row.quality),
        processing: this.deserializeData(row.processing),
        storedAt: row.stored_at.toISOString()
      }));

    } catch (error) {
      logger.error('Error searching MariaDB:', error);
      this.onError(error);
      throw error;
    }
  }

  async clear() {
    try {
      const countResult = await this.pool.query(`SELECT COUNT(*) as total FROM ${this.tableName}`);
      const totalCount = countResult[0].total;
      
      await this.pool.query(`DELETE FROM ${this.tableName}`);
      
      logger.info(`Cleared ${totalCount} records from MariaDB table ${this.tableName}`);
      return totalCount;
      
    } catch (error) {
      logger.error('Error clearing MariaDB table:', error);
      this.onError(error);
      throw error;
    }
  }

  async getStats() {
    try {
      const baseStats = await super.getStats();
      
      const countQuery = `SELECT COUNT(*) as total FROM ${this.tableName}`;
      const sizeQuery = `
        SELECT 
          ROUND(((data_length + index_length) / 1024 / 1024), 2) AS size_mb
        FROM information_schema.tables 
        WHERE table_schema = DATABASE() AND table_name = ?
      `;
      const recentQuery = `
        SELECT COUNT(*) as recent 
        FROM ${this.tableName} 
        WHERE stored_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
      `;

      const countResult = await this.pool.query(countQuery);
      const sizeResult = await this.pool.query(sizeQuery, [this.tableName]);
      const recentResult = await this.pool.query(recentQuery);

      return {
        ...baseStats,
        storage: {
          totalRecords: countResult[0].total,
          recentRecords: recentResult[0].recent,
          tableSizeMB: sizeResult[0] ? sizeResult[0].size_mb : 0
        }
      };

    } catch (error) {
      logger.error('Error getting MariaDB stats:', error);
      const baseStats = await super.getStats();
      return { ...baseStats, storage: { error: error.message } };
    }
  }

  async healthCheck() {
    try {
      const connection = await this.pool.getConnection();
      const result = await connection.query('SELECT NOW() as server_time');
      connection.end();

      const baseHealth = await super.healthCheck();
      
      return {
        ...baseHealth,
        details: {
          serverTime: result[0].server_time,
          database: this.config.database,
          host: this.config.host,
          port: this.config.port
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
          host: this.config.host,
          port: this.config.port
        }
      };
    }
  }
}

module.exports = MariaDBAdapter;
