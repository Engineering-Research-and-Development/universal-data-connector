const { Pool } = require('pg');
const BaseStorageAdapter = require('../BaseStorageAdapter');
const logger = require('../../utils/logger');

class PostgreSQLAdapter extends BaseStorageAdapter {
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
        throw new Error(`PostgreSQL adapter requires '${field}' in configuration`);
      }
    }
  }

  async initialize() {
    await super.initialize();
    
    // Create connection pool
    this.pool = new Pool({
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
      max: this.config.maxConnections || 10,
      idleTimeoutMillis: this.config.idleTimeout || 30000,
      connectionTimeoutMillis: this.config.connectionTimeout || 2000,
      ssl: this.config.ssl || false
    });

    // Setup pool event handlers
    this.pool.on('error', (err) => {
      logger.error('PostgreSQL pool error:', err);
      this.onError(err);
    });

    logger.debug('PostgreSQL adapter initialized');
  }

  async connect() {
    try {
      // Test connection
      const client = await this.pool.connect();
      client.release();
      
      // Create table if not exists
      await this.createTable();
      
      this.onConnected();
      return true;
      
    } catch (error) {
      logger.error('Failed to connect to PostgreSQL:', error);
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
      logger.error('Error disconnecting from PostgreSQL:', error);
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
        timestamp TIMESTAMPTZ NOT NULL,
        data JSONB NOT NULL,
        metadata JSONB DEFAULT '{}',
        quality JSONB DEFAULT '{}',
        processing JSONB DEFAULT '{}',
        stored_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_source_id ON ${this.tableName} (source_id);
      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_timestamp ON ${this.tableName} (timestamp);
      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_stored_at ON ${this.tableName} (stored_at);
      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_data_gin ON ${this.tableName} USING GIN (data);
    `;

    try {
      await this.pool.query(createTableQuery);
      logger.debug(`Created/verified PostgreSQL table: ${this.tableName}`);
    } catch (error) {
      logger.error('Error creating PostgreSQL table:', error);
      throw error;
    }
  }

  async store(data) {
    try {
      const record = this.createDataRecord(data);
      
      const insertQuery = `
        INSERT INTO ${this.tableName} 
        (id, source_id, source_type, timestamp, data, metadata, quality, processing, stored_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
      `;

      const values = [
        record.id,
        record.sourceId,
        record.sourceType,
        record.timestamp,
        JSON.stringify(record.data),
        JSON.stringify(record.metadata),
        JSON.stringify(record.quality),
        JSON.stringify(record.processing),
        record.storedAt
      ];

      const result = await this.pool.query(insertQuery, values);
      this.onWrite();
      
      return result.rows[0].id;
      
    } catch (error) {
      logger.error('Error storing data in PostgreSQL:', error);
      this.onError(error);
      throw error;
    }
  }

  async query(criteria) {
    try {
      let whereClause = 'WHERE 1=1';
      const values = [];
      let valueIndex = 1;

      if (criteria.sourceId) {
        whereClause += ` AND source_id = $${valueIndex}`;
        values.push(criteria.sourceId);
        valueIndex++;
      }

      if (criteria.startTime && criteria.endTime) {
        whereClause += ` AND timestamp BETWEEN $${valueIndex} AND $${valueIndex + 1}`;
        values.push(criteria.startTime, criteria.endTime);
        valueIndex += 2;
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

      const result = await this.pool.query(selectQuery, values);
      this.onRead();

      return result.rows.map(row => ({
        id: row.id,
        sourceId: row.source_id,
        sourceType: row.source_type,
        timestamp: row.timestamp,
        data: this.deserializeData(row.data),
        metadata: this.deserializeData(row.metadata),
        quality: this.deserializeData(row.quality),
        processing: this.deserializeData(row.processing),
        storedAt: row.stored_at
      }));

    } catch (error) {
      logger.error('Error querying PostgreSQL:', error);
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
          source_id ILIKE $1 OR
          data::text ILIKE $1 OR
          metadata::text ILIKE $1
        ORDER BY timestamp DESC
        LIMIT 100
      `;

      const searchTerm = `%${query}%`;
      const result = await this.pool.query(searchQuery, [searchTerm]);
      this.onRead();

      return result.rows.map(row => ({
        id: row.id,
        sourceId: row.source_id,
        sourceType: row.source_type,
        timestamp: row.timestamp,
        data: this.deserializeData(row.data),
        metadata: this.deserializeData(row.metadata),
        quality: this.deserializeData(row.quality),
        processing: this.deserializeData(row.processing),
        storedAt: row.stored_at
      }));

    } catch (error) {
      logger.error('Error searching PostgreSQL:', error);
      this.onError(error);
      throw error;
    }
  }

  async clear() {
    try {
      const countResult = await this.pool.query(`SELECT COUNT(*) FROM ${this.tableName}`);
      const totalCount = parseInt(countResult.rows[0].count);
      
      await this.pool.query(`DELETE FROM ${this.tableName}`);
      
      logger.info(`Cleared ${totalCount} records from PostgreSQL table ${this.tableName}`);
      return totalCount;
      
    } catch (error) {
      logger.error('Error clearing PostgreSQL table:', error);
      this.onError(error);
      throw error;
    }
  }

  async getStats() {
    try {
      const baseStats = await super.getStats();
      
      const countQuery = `SELECT COUNT(*) as total FROM ${this.tableName}`;
      const sizeQuery = `SELECT pg_total_relation_size('${this.tableName}') as size`;
      const recentQuery = `
        SELECT COUNT(*) as recent 
        FROM ${this.tableName} 
        WHERE stored_at > NOW() - INTERVAL '1 hour'
      `;

      const [countResult, sizeResult, recentResult] = await Promise.all([
        this.pool.query(countQuery),
        this.pool.query(sizeQuery),
        this.pool.query(recentQuery)
      ]);

      return {
        ...baseStats,
        storage: {
          totalRecords: parseInt(countResult.rows[0].total),
          recentRecords: parseInt(recentResult.rows[0].recent),
          tableSizeBytes: parseInt(sizeResult.rows[0].size),
          tableSizeMB: Math.round(parseInt(sizeResult.rows[0].size) / 1024 / 1024 * 100) / 100
        }
      };

    } catch (error) {
      logger.error('Error getting PostgreSQL stats:', error);
      const baseStats = await super.getStats();
      return { ...baseStats, storage: { error: error.message } };
    }
  }

  async healthCheck() {
    try {
      const client = await this.pool.connect();
      const result = await client.query('SELECT NOW()');
      client.release();

      const baseHealth = await super.healthCheck();
      
      return {
        ...baseHealth,
        details: {
          connectionPool: {
            totalCount: this.pool.totalCount,
            idleCount: this.pool.idleCount,
            waitingCount: this.pool.waitingCount
          },
          serverTime: result.rows[0].now,
          database: this.config.database,
          host: this.config.host
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
          host: this.config.host
        }
      };
    }
  }
}

module.exports = PostgreSQLAdapter;
