<div align="center">
  <img src="docs/logo.png" alt="Universal Data Connector Logo" width="300"/>
  
  # Universal Data Connector

  A configurable universal data connector for Industry 5.0 supporting data ingestion from multiple sources.

  ---

  **[🇬🇧 English](README.md)** | **[🇮🇹 Italiano](README.it.md)**
</div>

## Features

- 🔌 **Multi-Source Support**: OPC UA, MQTT, HTTP REST, AAS + 10+ industrial protocols
- 🔄 **Data Mapping**: Unified transformation to Universal Data Model
- 📤 **Multi-Format Export**: JSON, NGSI-LD, TOON
- ⚙️ **Flexible Configuration**: JSON file-based configuration
- 🚀 **REST API**: Status monitoring and control
- 📊 **Real-time Processing**: Real-time data processing
- 🏭 **Industry 4.0/5.0 Ready**: AAS support and industrial protocols
- 🔀 **Modular Architecture**: Modular and extensible architecture
- 📝 **Advanced Logging**: Structured logging system

## Supported Sources

### IT/IoT Protocols
- **OPC UA** - OPC UA server with node subscriptions and certificate management
- **MQTT** - MQTT broker with multi-topic subscriptions and QoS
- **HTTP REST** - REST endpoint polling with authentication (Bearer, Basic, API Key)

### Industrial PLC Protocols
- **Modbus TCP/RTU** - Read/write Holding, Input, Coil, Discrete registers
- **Siemens S7** - S7-300, S7-400, S7-1200, S7-1500 via S7 protocol
- **EtherCAT** - Real-time automation protocol (requires dedicated hardware)
- **PROFINET** - Siemens standard for industrial Ethernet networks
- **FINS (Omron)** - Omron CJ, CS, CP, NJ, NX series PLCs
- **MELSEC (Mitsubishi)** - MC Protocol for Q, L, FX series
- **CIP/EtherNet/IP** - Allen-Bradley/Rockwell ControlLogix, CompactLogix

### Building Automation Protocols
- **BACnet/IP** - Building automation for HVAC, lighting, access control

### Serial Communication
- **Serial/RS232/RS485** - Custom protocols over serial port with configurable parsers

### Industry 4.0/5.0
- **AAS (Asset Administration Shell)** - Industry 4.0 standard for Digital Twin and interoperability

📖 **[Complete Industrial Connectors Documentation](docs/IndustrialConnectors.md)**

## Mapping Tools

The **Mapping Tools** module automatically transforms data from all protocols into a unified **Universal Data Model**, exportable to:
- **JSON** - Universal standard format
- **NGSI-LD** - FIWARE standard for IoT and Smart Cities
- **TOON** - Ontological format (under definition)

### Mapping Features
- ✅ Automatic mapping of all protocols
- ✅ Unified data model with entities and relationships
- ✅ Protocol-specific mappers (OPC-UA, Modbus, AAS, MQTT, Generic)
- ✅ Multi-format export
- ✅ REST API for mapped data access
- ✅ Mapping rules configuration

📖 **[Complete Mapping Tools Documentation](docs/Mapping.md)**

## Quick Start

```bash
# Install dependencies
npm install

# Start in development mode
npm run dev

# Start in production
npm start
```

## Configuration

The connector uses a `config/sources.json` file to define data sources.

Configuration example:

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

## Auto-Discovery

The connector supports **automatic discovery** of available data points for protocols that allow exploration:

### Discovery-Enabled Protocols
- **OPC UA** - Browse address space to discover nodes
- **MQTT** - Listen to wildcard topics to discover message streams
- **Modbus** - Scan register ranges to find responsive addresses

### How to Use Discovery
1. Configure source with **empty** nodes/topics/registers array
2. Start the connector - it will automatically discover available data points
3. Use `GET /api/sources/:id/discovery` to view discovered items
4. Select desired items and configure with `POST /api/sources/:id/configure`
5. Connector restarts with active monitoring

**Example: OPC UA Auto-Discovery**
```json
{
  "id": "plc-001",
  "type": "opcua",
  "config": {
    "endpoint": "opc.tcp://192.168.1.100:4840",
    "nodes": []  // Empty = auto-discovery mode
  }
}
```

After connection, call discovery endpoint:
```bash
GET /api/sources/plc-001/discovery
# Returns all discovered nodes with metadata
```

Configure selected nodes:
```bash
POST /api/sources/plc-001/configure
{
  "nodes": ["ns=2;s=Temperature", "ns=2;s=Pressure"]
}
```

📖 **[Complete Discovery Documentation](docs/API.md#discovery-endpoints)**

## API Endpoints

### Status & Sources
- `GET /api/status` - Overall connector status
- `GET /api/sources` - List configured sources
- `GET /api/sources/:id/status` - Specific source status
- `POST /api/sources/:id/start` - Start a source
- `POST /api/sources/:id/stop` - Stop a source
- `GET /api/data/latest` - Latest received data

### Discovery
- `GET /api/sources/:id/discovery` - Get auto-discovered items
- `POST /api/sources/:id/configure` - Configure and activate discovered items

### Mapping & Export
- `GET /api/mapping/entities` - All mapped entities
- `GET /api/mapping/entities/:id` - Specific entity
- `GET /api/mapping/entities/type/:type` - Entities by type
- `GET /api/mapping/export/json` - Export to JSON
- `GET /api/mapping/export/ngsi-ld` - Export to NGSI-LD
- `GET /api/mapping/export/toon` - Export to TOON
- `GET /api/mapping/statistics` - Mapping statistics
- `GET /api/mapping/health` - Mapping engine health check
- `DELETE /api/mapping/entities` - Clear mapped data

## Dynamic Configuration

The Universal Data Connector supports **dynamic configuration** without service restart:

### Real-time Sources Configuration
```bash
# Update sources configuration
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

### Real-time Storage Configuration
```bash
# Change storage from memory to PostgreSQL
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

### Dynamic Configuration API

- `POST /api/config/sources/configure` - Configure sources with full payload
- `POST /api/config/sources/reload` - Reload sources configuration
- `POST /api/config/storage/configure` - Configure storage with connection test
- `POST /api/config/storage/reload` - Reload storage configuration
- `GET /api/config/engine/status` - Engine status and reconfiguration capabilities

**Features:**
- ✅ No restart required
- ✅ Automatic storage connection test
- ✅ Automatic data migration
- ✅ Configuration validation
- ✅ Rollback on errors

For complete details, see [Dynamic Configuration Guide](docs/DynamicConfiguration.md).

## Storage Configuration

The Universal Data Connector supports multiple storage backends to persist collected data:

### Supported Storage Types

- **Memory** - Temporary in-memory storage (default)
- **PostgreSQL** - Relational database for high performance
- **TimescaleDB** - Time-series optimized database (PostgreSQL extension)
- **MariaDB/MySQL** - MySQL-compatible relational database
- **MongoDB** - NoSQL database for semi-structured data
- **Redis** - High-performance in-memory cache

### Storage Configuration

Configure storage in the `config/storage.json` file:

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

### Storage API

- `GET /api/config/storage` - Current storage configuration
- `PUT /api/config/storage` - Update storage configuration
- `POST /api/config/storage/test` - Test storage connection
- `GET /api/config/storage/health` - Storage status and statistics
- `GET /api/config/storage/types` - Available storage types

For complete storage configuration details, see [Storage Configuration Guide](docs/Storage.md).

## Project Structure

```
src/
├── server.js              # Main entry point
├── core/                  # Core engine
│   ├── DataConnectorEngine.js    # Main orchestrator
│   ├── DataProcessor.js           # Data processing
│   └── DataStore.js               # In-memory cache
├── connectors/            # Source connector modules
│   ├── BaseConnector.js           # Base connector class
│   ├── ConnectorFactory.js        # Factory pattern
│   └── protocols/                 # Protocol implementations
│       ├── OpcUaConnector.js      # OPC-UA
│       ├── MqttConnector.js       # MQTT
│       ├── HttpConnector.js       # HTTP REST
│       ├── ModbusConnector.js     # Modbus TCP/RTU
│       ├── S7Connector.js         # Siemens S7
│       ├── AASConnector.js        # Asset Administration Shell
│       ├── ... (7 more connectors)
│       └── index.js               # Unified export
├── mappingTools/          # Unified mapping system
│   ├── UniversalDataModel.js      # Unified data model
│   ├── MappingEngine.js           # Orchestration engine
│   ├── BaseMapper.js              # Base mapper class
│   └── mappers/                   # Protocol mappers
│       ├── OPCUAMapper.js
│       ├── ModbusMapper.js
│       ├── AASMapper.js
│       ├── MQTTMapper.js
│       └── GenericMapper.js
├── storage/               # Data persistence
│   ├── StorageFactory.js
│   └── adapters/
│       ├── PostgreSQLAdapter.js
│       ├── TimescaleDBAdapter.js
│       ├── MongoDBAdapter.js
│       ├── MariaDBAdapter.js
│       ├── RedisAdapter.js
│       ├── MemoryStorageAdapter.js
│       └── index.js
├── config/                # Configuration system
│   ├── ConfigManager.js
│   └── StorageConfigManager.js
├── api/                   # REST API routes
│   └── routes/
│       ├── status.js
│       ├── sources.js
│       ├── data.js
│       ├── config.js
│       └── mapping.js     # New mapping API
└── utils/                 # Utilities
    └── logger.js
```
