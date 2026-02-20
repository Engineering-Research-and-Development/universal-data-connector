#!/usr/bin/env node

/**
 * Script semplice per testare i driver database
 */

console.log('Testando i driver database...');

try {
  console.log('1. Testando driver MariaDB...');
  const mariadb = require('mariadb');
  console.log('   ✓ Driver MariaDB caricato correttamente');
  
  console.log('2. Testando driver MySQL2...');
  const mysql2 = require('mysql2');
  console.log('   ✓ Driver MySQL2 caricato correttamente');
  
  console.log('3. Testando driver PostgreSQL...');
  const pg = require('pg');
  console.log('   ✓ Driver PostgreSQL caricato correttamente');
  
  console.log('4. Testando driver MongoDB...');
  const mongodb = require('mongodb');
  console.log('   ✓ Driver MongoDB caricato correttamente');
  
  console.log('5. Testando driver Redis...');
  const redis = require('redis');
  console.log('   ✓ Driver Redis caricato correttamente');
  
  console.log('\n✅ Tutti i driver database sono disponibili!');
  
  // Test degli adapter
  console.log('\n6. Testando gli adapter...');
  
  const StorageFactory = require('../src/storage/StorageFactory');
  
  console.log('   - Memory adapter...');
  const memoryAdapter = StorageFactory.create('memory', { type: 'memory', maxRecords: 100 });
  console.log('     ✓ Memory adapter creato');
  
  console.log('   - Redis adapter...');
  const redisAdapter = StorageFactory.create('redis', {
    type: 'redis',
    host: 'localhost',
    port: 6379
  });
  console.log('     ✓ Redis adapter creato');
  
  console.log('   - TimescaleDB adapter...');
  const timescaleAdapter = StorageFactory.create('timescaledb', {
    type: 'timescaledb',
    host: 'localhost',
    port: 5432,
    database: 'test',
    username: 'postgres',
    password: 'password'
  });
  console.log('     ✓ TimescaleDB adapter creato');
  
  console.log('\n✅ Tutti gli adapter sono funzionanti!');
  
} catch (error) {
  console.error('\n❌ Errore durante il test dei driver:');
  console.error(`   ${error.message}`);
  
  if (error.code === 'MODULE_NOT_FOUND') {
    console.error('\n💡 Soluzione: Installa le dipendenze mancanti con:');
    console.error('   npm install');
  }
  
  process.exit(1);
}
