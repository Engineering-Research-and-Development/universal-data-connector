#!/usr/bin/env node

/**
 * Script per testare le connessioni ai diversi backend di storage
 * Usage: node scripts/test-storage.js [storage-type]
 */

const StorageFactory = require('../src/storage/StorageFactory');
const StorageConfigManager = require('../src/config/StorageConfigManager');
const logger = require('../src/utils/logger');

// Configurazioni di test
const testConfigs = {
  memory: {
    type: 'memory',
    config: {
      maxRecords: 1000,
      ttl: 60000
    }
  },
  postgresql: {
    type: 'postgresql',
    config: {
      host: process.env.PG_HOST || 'localhost',
      port: process.env.PG_PORT || 5432,
      database: process.env.PG_DATABASE || 'test_udc',
      username: process.env.PG_USER || 'postgres',
      password: process.env.PG_PASSWORD || 'password',
      table: 'test_sensor_data'
    }
  },
  mariadb: {
    type: 'mariadb',
    config: {
      host: process.env.MARIADB_HOST || 'localhost',
      port: process.env.MARIADB_PORT || 3306,
      database: process.env.MARIADB_DATABASE || 'test_udc',
      username: process.env.MARIADB_USER || 'root',
      password: process.env.MARIADB_PASSWORD || 'password',
      table: 'test_sensor_data'
    }
  },
  mongodb: {
    type: 'mongodb',
    config: {
      uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
      database: process.env.MONGODB_DATABASE || 'test_udc',
      collection: 'test_sensor_data'
    }
  },
  redis: {
    type: 'redis',
    config: {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || '',
      db: 1,
      keyPrefix: 'test:udc:',
      ttl: 300
    }
  }
};

async function testStorage(storageType, config) {
  console.log(`\n=== Testing ${storageType.toUpperCase()} Storage ===`);
  
  let adapter;
  try {
    // Crea adapter
    adapter = StorageFactory.create(config.type, { type: config.type, ...config.config });
    console.log('✓ Adapter created successfully');
    
    // Test connessione
    await adapter.connect();
    console.log('✓ Connection established');
    
    // Test store
    const testData = {
      id: 'test-' + Date.now(),
      sourceId: 'test-source',
      timestamp: new Date(),
      data: {
        temperature: 25.5,
        humidity: 60.2,
        test: true
      }
    };
    
    await adapter.store(testData);
    console.log('✓ Data stored successfully');
    
    // Test retrieve
    const retrieved = await adapter.getLatest('test-source', 1);
    if (retrieved.length > 0) {
      console.log('✓ Data retrieved successfully');
      console.log(`  Retrieved record: ${retrieved[0].id}`);
    } else {
      console.log('⚠ No data retrieved');
    }
    
    // Test statistics
    const stats = await adapter.getStatistics();
    console.log('✓ Statistics retrieved');
    console.log(`  Total records: ${stats.totalRecords || 'N/A'}`);
    console.log(`  Data size: ${stats.totalSize || 'N/A'}`);
    
    // Test search
    const searchResults = await adapter.search({
      sourceId: 'test-source',
      limit: 10
    });
    console.log('✓ Search completed');
    console.log(`  Search results: ${searchResults.length} records`);
    
    // Cleanup
    await adapter.clear();
    console.log('✓ Cleanup completed');
    
    console.log(`\n${storageType.toUpperCase()} storage test: PASSED`);
    return true;
    
  } catch (error) {
    console.error(`\n${storageType.toUpperCase()} storage test: FAILED`);
    console.error(`Error: ${error.message}`);
    console.error(`Stack: ${error.stack}`);
    return false;
    
  } finally {
    if (adapter) {
      try {
        await adapter.disconnect();
        console.log('✓ Disconnected successfully');
      } catch (error) {
        console.error('⚠ Error during disconnect:', error.message);
      }
    }
  }
}

async function testAllStorages() {
  console.log('Universal Data Connector - Storage Test Suite');
  console.log('============================================');
  
  const results = {};
  
  for (const [storageType, config] of Object.entries(testConfigs)) {
    try {
      results[storageType] = await testStorage(storageType, config);
    } catch (error) {
      console.error(`Fatal error testing ${storageType}:`, error);
      results[storageType] = false;
    }
  }
  
  // Riepilogo
  console.log('\n\n=== TEST SUMMARY ===');
  let passed = 0;
  let failed = 0;
  
  for (const [storageType, success] of Object.entries(results)) {
    const status = success ? '✓ PASSED' : '✗ FAILED';
    console.log(`${storageType.toUpperCase().padEnd(12)} ${status}`);
    
    if (success) {
      passed++;
    } else {
      failed++;
    }
  }
  
  console.log(`\nTotal: ${passed + failed}, Passed: ${passed}, Failed: ${failed}`);
  
  if (failed > 0) {
    console.log('\nNote: Failed tests may be due to missing database instances.');
    console.log('Make sure the required databases are running and accessible.');
    process.exit(1);
  } else {
    console.log('\nAll storage tests passed!');
    process.exit(0);
  }
}

async function main() {
  const storageType = process.argv[2];
  
  if (storageType) {
    // Test singolo storage
    if (!testConfigs[storageType]) {
      console.error(`Unknown storage type: ${storageType}`);
      console.error(`Available types: ${Object.keys(testConfigs).join(', ')}`);
      process.exit(1);
    }
    
    const success = await testStorage(storageType, testConfigs[storageType]);
    process.exit(success ? 0 : 1);
  } else {
    // Test tutti gli storage
    await testAllStorages();
  }
}

// Gestione errori non catturati
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testStorage, testConfigs };
