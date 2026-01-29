/**
 * Storage Adapters Index
 * 
 * Exports all available storage adapter implementations.
 */

const MemoryStorageAdapter = require('./MemoryStorageAdapter');
const RedisAdapter = require('./RedisAdapter');
const TimescaleDBAdapter = require('./TimescaleDBAdapter');

module.exports = {
  MemoryStorageAdapter,
  RedisAdapter,
  TimescaleDBAdapter
};
