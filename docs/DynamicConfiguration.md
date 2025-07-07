# Dynamic Configuration API Guide

Questa guida spiega come utilizzare le API REST per configurare dinamicamente il Universal Data Connector senza dover riavviare il servizio.

## Overview

Il Universal Data Connector supporta la riconfigurazione dinamica di:
- **Sources Configuration**: Aggiungere, modificare o rimuovere fonti dati
- **Storage Configuration**: Cambiare il backend di storage per i dati

Tutte le modifiche vengono applicate immediatamente e persistono su file di configurazione.

## Dynamic Sources Configuration

### POST /api/config/sources/configure
Configura completamente le sources con un payload JSON.

**Request:**
```http
POST /api/config/sources/configure
Content-Type: application/json

{
  "sources": [
    {
      "id": "plc-line1",
      "type": "opcua",
      "name": "PLC Line 1",
      "enabled": true,
      "config": {
        "endpoint": "opc.tcp://192.168.1.100:4840",
        "nodes": [
          "ns=2;s=Temperature",
          "ns=2;s=Pressure"
        ],
        "interval": 1000
      }
    },
    {
      "id": "mqtt-sensors",
      "type": "mqtt",
      "name": "MQTT Sensors",
      "enabled": true,
      "config": {
        "broker": "mqtt://192.168.1.200:1883",
        "topics": [
          "sensors/temperature/+",
          "sensors/humidity/+"
        ],
        "qos": 1
      }
    }
  ]
}
```

**Response:**
```json
{
  "timestamp": "2025-07-03T10:30:00.000Z",
  "message": "Sources configuration updated successfully",
  "configuration": {
    "totalSources": 2,
    "enabledSources": 2,
    "sourceTypes": {
      "opcua": 1,
      "mqtt": 1
    }
  },
  "result": {
    "success": true,
    "totalSources": 2,
    "activeConnectors": 2,
    "message": "Sources configuration reloaded successfully"
  },
  "appliedImmediately": true
}
```

### POST /api/config/sources/reload
Ricarica la configurazione delle sources dal file o con nuovi dati.

**Request (reload from file):**
```http
POST /api/config/sources/reload
Content-Type: application/json

{}
```

**Request (reload with new data):**
```http
POST /api/config/sources/reload
Content-Type: application/json

{
  "sources": [
    {
      "id": "new-source",
      "type": "http",
      "enabled": true,
      "config": {
        "url": "https://api.example.com/data",
        "interval": 5000
      }
    }
  ]
}
```

**Response:**
```json
{
  "timestamp": "2025-07-03T10:30:00.000Z",
  "message": "Sources configuration reloaded successfully",
  "result": {
    "success": true,
    "totalSources": 1,
    "activeConnectors": 1,
    "message": "Sources configuration reloaded successfully"
  },
  "actions": {
    "configurationUpdated": true,
    "connectorsReinitialized": true,
    "engineRestarted": false
  }
}
```

## Dynamic Storage Configuration

### POST /api/config/storage/configure
Configura completamente lo storage con test di connessione automatico.

**Request (PostgreSQL):**
```http
POST /api/config/storage/configure
Content-Type: application/json

{
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
```

**Request (MongoDB):**
```http
POST /api/config/storage/configure
Content-Type: application/json

{
  "type": "mongodb",
  "config": {
    "uri": "mongodb://localhost:27017",
    "database": "universal_data_connector",
    "collection": "sensor_data"
  }
}
```

**Request (Redis):**
```http
POST /api/config/storage/configure
Content-Type: application/json

{
  "type": "redis",
  "config": {
    "host": "localhost",
    "port": 6379,
    "db": 0,
    "keyPrefix": "udc:",
    "ttl": 3600
  }
}
```

**Response:**
```json
{
  "timestamp": "2025-07-03T10:30:00.000Z",
  "message": "Storage configuration updated successfully",
  "storage": {
    "type": "postgresql",
    "connectionTest": {
      "success": true,
      "responseTime": 145
    }
  },
  "result": {
    "success": true,
    "storageType": "postgresql",
    "restoredDataPoints": 1250,
    "message": "Storage configuration reloaded successfully"
  },
  "appliedImmediately": true
}
```

### POST /api/config/storage/reload
Ricarica la configurazione dello storage.

**Request:**
```http
POST /api/config/storage/reload
Content-Type: application/json

{
  "storage": {
    "type": "memory",
    "config": {
      "maxRecords": 5000,
      "ttl": 1800000
    }
  }
}
```

**Response:**
```json
{
  "timestamp": "2025-07-03T10:30:00.000Z",
  "message": "Storage configuration reloaded successfully",
  "result": {
    "success": true,
    "storageType": "memory",
    "restoredDataPoints": 1250,
    "message": "Storage configuration reloaded successfully"
  },
  "actions": {
    "storageReconfigured": true,
    "dataPreserved": true,
    "engineRestarted": false
  }
}
```

## Engine Status

### GET /api/config/engine/status
Ottiene lo stato dell'engine e informazioni sulla configurazione dinamica.

**Response:**
```json
{
  "timestamp": "2025-07-03T10:30:00.000Z",
  "engine": {
    "isRunning": true,
    "stats": {
      "totalDataPoints": 15240,
      "totalErrors": 2,
      "startTime": "2025-07-03T09:30:00.000Z",
      "lastDataReceived": "2025-07-03T10:29:55.123Z",
      "connectorCount": 3,
      "uptime": 3600000
    },
    "dataStore": {
      "type": "postgresql",
      "status": "connected"
    }
  },
  "connectors": {
    "plc-line1": {
      "status": "connected",
      "type": "opcua",
      "enabled": true,
      "lastActivity": "2025-07-03T10:29:55.123Z",
      "stats": {
        "dataPoints": 8450,
        "errors": 0,
        "connections": 1
      }
    }
  },
  "configuration": {
    "canReloadDynamically": true,
    "supportedOperations": [
      "sources/reload",
      "sources/configure",
      "storage/reload",
      "storage/configure"
    ]
  }
}
```

## Esempi di Utilizzo

### 1. Aggiungere una nuova source MQTT
```bash
curl -X POST "http://localhost:3000/api/config/sources/configure" \
  -H "Content-Type: application/json" \
  -d '{
    "sources": [
      {
        "id": "warehouse-sensors",
        "type": "mqtt",
        "name": "Warehouse Sensors",
        "enabled": true,
        "config": {
          "broker": "mqtt://warehouse.company.com:1883",
          "topics": ["warehouse/+/temperature", "warehouse/+/humidity"],
          "qos": 1,
          "auth": {
            "username": "sensor_user",
            "password": "sensor_pass"
          }
        }
      }
    ]
  }'
```

### 2. Cambiare storage da Memory a PostgreSQL
```bash
curl -X POST "http://localhost:3000/api/config/storage/configure" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "postgresql",
    "config": {
      "host": "db.company.com",
      "port": 5432,
      "database": "production_udc",
      "username": "udc_user",
      "password": "secure_password",
      "table": "sensor_measurements",
      "pool": {
        "min": 5,
        "max": 20
      }
    }
  }'
```

### 3. Aggiornare una configurazione esistente
```bash
# Prima ottieni la configurazione corrente
curl -X GET "http://localhost:3000/api/config/sources"

# Modifica e applica
curl -X POST "http://localhost:3000/api/config/sources/configure" \
  -H "Content-Type: application/json" \
  -d @updated-sources-config.json
```

### 4. Monitorare lo stato durante la riconfigurazione
```bash
# Verifica stato prima
curl -X GET "http://localhost:3000/api/config/engine/status"

# Applica nuova configurazione
curl -X POST "http://localhost:3000/api/config/storage/configure" \
  -H "Content-Type: application/json" \
  -d @new-storage-config.json

# Verifica stato dopo
curl -X GET "http://localhost:3000/api/config/engine/status"
```

## Comportamento della Riconfigurazione

### Sources Configuration
1. **Validazione**: Ogni source viene validata prima dell'applicazione
2. **Connettori Esistenti**: I connettori esistenti vengono aggiornati se la configurazione cambia
3. **Nuovi Connettori**: Vengono creati e avviati automaticamente se l'engine è in esecuzione
4. **Connettori Rimossi**: Vengono fermati e rimossi se non più presenti nella configurazione
5. **Persistenza**: La configurazione viene salvata in `config/sources.json`

### Storage Configuration
1. **Test Connessione**: La connessione viene testata prima dell'applicazione
2. **Backup Dati**: I dati esistenti vengono salvati temporaneamente
3. **Riconfigurazione**: Il nuovo storage viene inizializzato
4. **Ripristino Dati**: I dati vengono migrati al nuovo storage
5. **Persistenza**: La configurazione viene salvata in `config/storage.json`

## Gestione Errori

### Errori di Validazione
```json
{
  "error": "Validation Error",
  "message": "Each source must have id, type, and config properties",
  "invalidSource": {
    "id": "incomplete-source"
  }
}
```

### Errori di Connessione Storage
```json
{
  "error": "Connection Test Failed",
  "message": "Cannot connect to specified storage",
  "testResult": {
    "success": false,
    "message": "Connection refused",
    "responseTime": 5000
  }
}
```

### Errori di Engine
```json
{
  "error": "Internal Server Error",
  "message": "Engine not available"
}
```

## Best Practices

1. **Test Prima**: Usa sempre l'endpoint `/test` prima di applicare nuove configurazioni storage
2. **Backup**: Mantieni backup delle configurazioni funzionanti
3. **Monitoraggio**: Controlla lo stato dell'engine dopo ogni modifica
4. **Gradualità**: Applica modifiche incrementali piuttosto che grandi cambiamenti
5. **Logging**: Monitora i log durante la riconfigurazione per identificare problemi

## Limitazioni

1. **Downtime**: Brevi interruzioni durante il cambio di storage
2. **Memoria**: La migrazione dati è limitata dalla memoria disponibile
3. **Connessioni**: I connettori vengono temporaneamente disconnessi durante la riconfigurazione
4. **Validazione**: Configurazioni complesse potrebbero richiedere validazioni aggiuntive
