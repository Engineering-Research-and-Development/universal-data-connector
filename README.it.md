<div align="center">
  <img src="docs/logo.png" alt="Universal Data Connector Logo" width="300"/>
  
  # Universal Data Connector

  Un connettore dati universale configurabile per Industry 5.0 che supporta l'ingestion di dati da multiple sources.

  ---

  **[🇬🇧 English](README.md)** | **[🇮🇹 Italiano](README.it.md)**
</div>

## Caratteristiche

- 🔌 **Multi-Source Support**: OPC UA, MQTT, HTTP REST, AAS + 10+ protocolli industriali
- 🔄 **Data Mapping**: Trasformazione unificata verso Universal Data Model
- 📤 **Multi-Format Export**: JSON, NGSI-LD, TOON
- ⚙️ **Configurazione Flessibile**: Configurazione tramite file JSON
- 🚀 **API REST**: Monitoraggio stato e controllo
- 📊 **Real-time Processing**: Elaborazione dati in tempo reale
- 🏭 **Industry 4.0/5.0 Ready**: Supporto AAS e protocolli industriali
- 🔀 **Modular Architecture**: Architettura modulare ed estensibile
- 📝 **Logging Avanzato**: Sistema di logging strutturato

## Sources Supportate

### Protocolli IT/IoT
- **OPC UA** - Server OPC UA con subscription a nodi e gestione certificati
- **MQTT** - Broker MQTT con subscription a topic multipli e QoS
- **HTTP REST** - Polling endpoint REST con autenticazione (Bearer, Basic, API Key)

### Protocolli Industriali PLC
- **Modbus TCP/RTU** - Lettura/scrittura registri Holding, Input, Coil, Discrete
- **Siemens S7** - S7-300, S7-400, S7-1200, S7-1500 via protocollo S7
- **EtherCAT** - Protocollo real-time per automazione (richiede hardware dedicato)
- **PROFINET** - Standard Siemens per reti industriali Ethernet
- **FINS (Omron)** - Omron CJ, CS, CP, NJ, NX series PLC
- **MELSEC (Mitsubishi)** - MC Protocol per Q, L, FX series
- **CIP/EtherNet/IP** - Allen-Bradley/Rockwell ControlLogix, CompactLogix

### Protocolli Building Automation
- **BACnet/IP** - Building automation per HVAC, lighting, controllo accessi

### Comunicazione Seriale
- **Serial/RS232/RS485** - Protocolli custom su porta seriale con parser configurabili

### Industry 4.0/5.0
- **AAS (Asset Administration Shell)** - Standard Industry 4.0 per Digital Twin e interoperabilità

📖 **[Documentazione Completa Connettori Industriali](docs/IndustrialConnectors.md)**

## Mapping Tools

Il **Mapping Tools** modulo trasforma automaticamente i dati da tutti i protocolli in un **Universal Data Model** unificato, esportabile in:
- **JSON** - Formato standard universale
- **NGSI-LD** - Standard FIWARE per IoT e Smart Cities
- **TOON** - Formato ontologico (in definizione)

### Caratteristiche Mapping
- ✅ Mappatura automatica di tutti i protocolli
- ✅ Modello dati unificato con entità e relazioni
- ✅ Mappers specifici per protocollo (OPC-UA, Modbus, AAS, MQTT, Generic)
- ✅ Export multi-formato
- ✅ API REST per accesso dati mappati
- ✅ Configurazione regole di mapping

📖 **[Documentazione Completa Mapping Tools](docs/Mapping.md)**

## Quick Start

```bash
# Installa le dipendenze
npm install

# Avvia in modalità sviluppo
npm run dev

# Avvia in produzione
npm start
```

## Configurazione

Il connettore utilizza un file `config/sources.json` per definire le sources di dati.

Esempio di configurazione:

```json
{
  "sources": [
    {
      "id": "plc-001",
      "type": "opcua",
      "enabled": true,
      "config": {
        "endpoint": "opc.tcp://192.168.1.100:4840",
        "nodes": ["ns=2;s=Temperature", "ns=2;s=Pressure"]
      }
    },
    {
      "id": "sensor-mqtt",
      "type": "mqtt",
      "enabled": true,
      "config": {
        "broker": "mqtt://localhost:1883",
        "topics": ["sensors/+/temperature", "sensors/+/humidity"]
      }
    }
  ]
}
```

## API Endpoints

### Status & Sources
- `GET /api/status` - Stato generale del connettore
- `GET /api/sources` - Lista sources configurate
- `GET /api/sources/:id/status` - Stato di una source specifica
- `POST /api/sources/:id/start` - Avvia una source
- `POST /api/sources/:id/stop` - Ferma una source
- `GET /api/data/latest` - Ultimi dati ricevuti

### Mapping & Export
- `GET /api/mapping/entities` - Tutte le entità mappate
- `GET /api/mapping/entities/:id` - Entità specifica
- `GET /api/mapping/entities/type/:type` - Entità per tipo
- `GET /api/mapping/export/json` - Export in JSON
- `GET /api/mapping/export/ngsi-ld` - Export in NGSI-LD
- `GET /api/mapping/export/toon` - Export in TOON
- `GET /api/mapping/statistics` - Statistiche mapping
- `GET /api/mapping/health` - Health check mapping engine
- `DELETE /api/mapping/entities` - Cancella dati mappati

## Dynamic Configuration

Il Universal Data Connector supporta la **configurazione dinamica** senza riavvio del servizio:

### Configurazione Sources in Real-time
```bash
# Aggiorna la configurazione delle sources
curl -X POST "http://localhost:3000/api/config/sources/configure" \
  -H "Content-Type: application/json" \
  -d '{
    "sources": [
      {
        "id": "new-plc",
        "type": "opcua", 
        "enabled": true,
        "config": {
          "endpoint": "opc.tcp://192.168.1.100:4840",
          "nodes": ["ns=2;s=Temperature"]
        }
      }
    ]
  }'
```

### Configurazione Storage in Real-time
```bash
# Cambia storage da memory a PostgreSQL
curl -X POST "http://localhost:3000/api/config/storage/configure" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "postgresql",
    "config": {
      "host": "localhost",
      "port": 5432,
      "database": "universal_data_connector",
      "username": "postgres",
      "password": "password"
    }
  }'
```

### API di Configurazione Dinamica

- `POST /api/config/sources/configure` - Configura sources con payload completo
- `POST /api/config/sources/reload` - Ricarica configurazione sources
- `POST /api/config/storage/configure` - Configura storage con test connessione
- `POST /api/config/storage/reload` - Ricarica configurazione storage
- `GET /api/config/engine/status` - Stato engine e capacità di riconfigurazione

**Caratteristiche:**
- ✅ Nessun riavvio richiesto
- ✅ Test automatico connessioni storage
- ✅ Migrazione dati automatica
- ✅ Validazione configurazioni
- ✅ Rollback in caso di errori

Per dettagli completi, vedi [Dynamic Configuration Guide](docs/DynamicConfiguration.md).

## Storage Configuration

Il Universal Data Connector supporta diversi backend di storage per persistere i dati raccolti:

### Tipi di Storage Supportati

- **Memory** - Storage temporaneo in memoria (predefinito)
- **PostgreSQL** - Database relazionale per alta performance
- **TimescaleDB** - Database time-series ottimizzato (PostgreSQL extension)
- **MariaDB/MySQL** - Database relazionale compatibile MySQL
- **MongoDB** - Database NoSQL per dati semi-strutturati
- **Redis** - Cache in memoria ad alte prestazioni

### Configurazione Storage

Configura lo storage nel file `config/storage.json`:

```json
{
  "storage": {
    "type": "postgresql",
    "config": {
      "host": "localhost",
      "port": 5432,
      "database": "universal_data_connector",
      "username": "postgres",
      "password": "password",
      "table": "sensor_data",
      "pool": {
        "min": 2,
        "max": 10
      }
    }
  }
}
```

### API Storage

- `GET /api/config/storage` - Configurazione storage corrente
- `PUT /api/config/storage` - Aggiorna configurazione storage
- `POST /api/config/storage/test` - Testa connessione storage
- `GET /api/config/storage/health` - Stato e statistiche storage
- `GET /api/config/storage/types` - Tipi storage disponibili

Per dettagli completi sulla configurazione storage, vedi [Storage Configuration Guide](docs/Storage.md).

## Struttura Progetto

```
src/
├── server.js              # Entry point principale
├── core/                  # Core engine
│   ├── DataConnectorEngine.js    # Orchestratore principale
│   ├── DataProcessor.js           # Elaborazione dati
│   └── DataStore.js               # Cache in-memory
├── connectors/            # Moduli connettori sources
│   ├── BaseConnector.js           # Classe base connettori
│   ├── ConnectorFactory.js        # Factory pattern
│   └── protocols/                 # Implementazioni protocolli
│       ├── OpcUaConnector.js      # OPC-UA
│       ├── MqttConnector.js       # MQTT
│       ├── HttpConnector.js       # HTTP REST
│       ├── ModbusConnector.js     # Modbus TCP/RTU
│       ├── S7Connector.js         # Siemens S7
│       ├── AASConnector.js        # Asset Administration Shell
│       ├── ... (altri 7 connettori)
│       └── index.js               # Export unificato
├── mappingTools/          # Sistema mapping unificato
│   ├── UniversalDataModel.js      # Modello dati unificato
│   ├── MappingEngine.js           # Engine orchestrazione
│   ├── BaseMapper.js              # Classe base mapper
│   └── mappers/                   # Mapper protocolli
│       ├── OPCUAMapper.js
│       ├── ModbusMapper.js
│       ├── AASMapper.js
│       ├── MQTTMapper.js
│       └── GenericMapper.js
├── storage/               # Persistenza dati
│   ├── StorageFactory.js
│   └── adapters/
│       ├── PostgreSQLAdapter.js
│       ├── TimescaleDBAdapter.js
│       ├── MongoDBAdapter.js
│       ├── MariaDBAdapter.js
│       ├── RedisAdapter.js
│       ├── MemoryStorageAdapter.js
│       └── index.js
├── config/                # Sistema configurazione
│   ├── ConfigManager.js
│   └── StorageConfigManager.js
├── api/                   # REST API routes
│   └── routes/
│       ├── status.js
│       ├── sources.js
│       ├── data.js
│       ├── config.js
│       └── mapping.js     # Nuove API mapping
└── utils/                 # Utilities
    └── logger.js
```
