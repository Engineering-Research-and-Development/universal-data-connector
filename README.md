# Universal Data Connector

Un connettore dati universale configurabile per Industry 5.0 che supporta l'ingestion di dati da multiple sources.

## Caratteristiche

- 🔌 **Multi-Source Support**: OPC UA, MQTT, HTTP REST
- ⚙️ **Configurazione Flessibile**: Configurazione tramite file JSON
- 🚀 **API REST**: Monitoraggio stato e controllo
- 📊 **Real-time Processing**: Elaborazione dati in tempo reale
- 🔄 **Modular Architecture**: Architettura modulare ed estensibile
- 📝 **Logging Avanzato**: Sistema di logging strutturato

## Sources Supportate

### OPC UA
- Connessione a server OPC UA
- Subscription a nodi specifici
- Gestione autenticazione e certificati

### MQTT
- Connessione a broker MQTT
- Subscription a topic multipli
- Supporto QoS levels

### HTTP REST
- Polling di endpoint REST
- Supporto autenticazione (Bearer, Basic)
- Scheduling configurabile

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

- `GET /api/status` - Stato generale del connettore
- `GET /api/sources` - Lista sources configurate
- `GET /api/sources/:id/status` - Stato di una source specifica
- `POST /api/sources/:id/start` - Avvia una source
- `POST /api/sources/:id/stop` - Ferma una source
- `GET /api/data/latest` - Ultimi dati ricevuti

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
├── connectors/            # Moduli connettori sources
├── config/                # Sistema configurazione
├── api/                   # REST API routes
├── utils/                 # Utilities
└── types/                 # Type definitions
```
