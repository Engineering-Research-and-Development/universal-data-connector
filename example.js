/**
 * Example: Using Universal Data Connector v2.0
 * 
 * Questo esempio mostra come utilizzare UDC con:
 * - Discovery automatica
 * - Mapping personalizzato
 * - Multi-transport (NATS, MQTT, HTTP)
 * - Export in JSON e TOON
 */

const DataConnectorEngine = require('./src/core/DataConnectorEngine');
const logger = require('./src/utils/logger');

async function main() {
  try {
    // 1. Inizializza UDC Engine
    logger.info('=== Universal Data Connector v2.0 - Example ===');
    
    const engine = new DataConnectorEngine(
      null, // storage config (optional)
      {
        namespace: 'urn:ngsi-ld:industry50',
        mappingConfigPath: './config/mapping.json',
        discoveryMode: true // Abilita discovery automatica
      }
    );

    // 2. Inizializza tutti i componenti
    await engine.initialize();
    logger.info('UDC Engine initialized');

    // 3. Start data collection
    await engine.start();
    logger.info('UDC Engine started');

    // 4. Eventi
    engine.on('data', (deviceData) => {
      logger.info('📊 Data received:', {
        id: deviceData.id,
        type: deviceData.type,
        measurementsCount: deviceData.measurements.length
      });
    });

    engine.on('discoveryComplete', (deviceConfig) => {
      logger.info('🔍 Device discovered:', {
        id: deviceConfig.id,
        type: deviceConfig.type,
        measurementsCount: deviceConfig.measurements.length
      });
    });

    // 5. Export esempi (dopo aver raccolto dati)
    setTimeout(async () => {
      // Export in JSON
      const jsonData = engine.mappingEngine.exportData('json', {
        includeMetadata: true
      });
      logger.info('JSON Export:', JSON.stringify(jsonData, null, 2));

      // Export in TOON (compatto)
      const toonData = engine.mappingEngine.exportData('toon');
      logger.info('TOON Export:', JSON.stringify(toonData, null, 2));

      // Statistiche
      const stats = engine.getStatistics();
      logger.info('📈 Statistics:', stats);

      // Discovered devices
      const discovered = engine.mappingEngine.getDiscoveredDevices();
      logger.info(`🔍 Discovered ${discovered.length} devices`);

    }, 10000); // Dopo 10 secondi

    // Gestione graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Shutting down...');
      await engine.stop();
      process.exit(0);
    });

  } catch (error) {
    logger.error('Error in main:', error);
    process.exit(1);
  }
}

// Run example
main();

/**
 * ESEMPIO OUTPUT ATTESO:
 * 
 * 1. Discovery automatica salva in mapping.json:
 * {
 *   "devices": [
 *     {
 *       "id": "opcua_cartif_server",
 *       "type": "OPC_UA_Server",
 *       "measurements": [
 *         {"id": "temperature", "type": "float", ...},
 *         {"id": "pressure", "type": "float", ...}
 *       ]
 *     }
 *   ]
 * }
 * 
 * 2. Dati in tempo reale (JSON):
 * {
 *   "id": "opcua_cartif_server",
 *   "type": "OPC_UA_Server",
 *   "measurements": [
 *     {"id": "temperature", "type": "float", "value": 23.5},
 *     {"id": "pressure", "type": "float", "value": 1.013}
 *   ],
 *   "metadata": {
 *     "timestamp": "2026-02-13T10:00:00.000Z",
 *     "source": "opcua"
 *   }
 * }
 * 
 * 3. Pubblicazione su transport:
 * - NATS: subject "udc.data"
 * - MQTT: topic "udc/data/OPC_UA_Server/opcua_cartif_server"
 * - HTTP: POST http://localhost:8080/api/data
 */
