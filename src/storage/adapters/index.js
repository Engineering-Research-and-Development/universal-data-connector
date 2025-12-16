/**
 * Storage Adapters Index
 * 
 * Exports all available storage adapter implementations.
 */

const MemoryStorageAdapter = require('./MemoryStorageAdapter');
const PostgreSQLAdapter = require('./PostgreSQLAdapter');
const MariaDBAdapter = require('./MariaDBAdapter');
const MongoDBAdapter = require('./MongoDBAdapter');
const RedisAdapter = require('./RedisAdapter');
const TimescaleDBAdapter = require('./TimescaleDBAdapter');

module.exports = {
  MemoryStorageAdapter,
  PostgreSQLAdapter,
  MariaDBAdapter,
  MongoDBAdapter,
  RedisAdapter,
  TimescaleDBAdapter
};
