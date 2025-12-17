# Configuration Guide

**[🇬🇧 English](Configuration.md)** | **[🇮🇹 Italiano](Configuration.it.md)**

---

## Overview

The Universal Data Connector uses a JSON file-based configuration system to define data sources and system parameters.

## File di Configurazione

### sources.json

Il file principale di configurazione si trova in `config/sources.json` e contiene la definizione di tutte le sources di dati.

```json
{
  "sources": [
    {
      "id": "unique-source-id",
      "type": "opcua|mqtt|http",
      "enabled": true,
      "name": "Human readable name",
      "description": "Description of the source",
      "config": {
        // Source-specific configuration
      },
      "retryConfig": {
        "enabled": true,
        "maxRetries": 3,
        "retryDelay": 5000
      },
      "dataProcessing": {
        "enabled": true,
        "transforms": ["transform1", "transform2"],
        "validation": {
          // Validation rules
        }
      }
    }
  ]
}
```

## Configurazione Sources

### OPC UA Sources

```json
{
  "id": "plc-001",
  "type": "opcua",
  "enabled": true,
  "name": "Production PLC",
  "config": {
    "endpoint": "opc.tcp://192.168.1.100:4840",
    "securityPolicy": "None|Basic128|Basic256|Basic256Sha256",
    "securityMode": "None|Sign|SignAndEncrypt",
    "username": "optional_username",
    "password": "optional_password",
    "nodes": [
      "ns=2;s=Temperature",
      "ns=2;s=Pressure",
      "ns=2;s=Flow"
    ],
    "subscriptionOptions": {
      "requestedPublishingInterval": 1000,
      "requestedLifetimeCount": 60,
      "requestedMaxKeepAliveCount": 10,
      "maxNotificationsPerPublish": 10,
      "publishingEnabled": true,
      "priority": 10
    },
    "clientOptions": {
      "requestedSessionTimeout": 60000,
      "keepSessionAlive": true
    }
  }
}
```

**Parametri OPC UA:**
- `endpoint`: URL del server OPC UA
- `securityPolicy`: Politica di sicurezza
- `securityMode`: Modalità di sicurezza
- `username/password`: Credenziali opzionali
- `nodes`: Array di node IDs da monitorare (optional - triggers auto-discovery if empty)
- `subscriptionOptions`: Opzioni per la subscription
- `clientOptions`: Opzioni del client OPC UA

**Auto-Discovery Mode:**
If `nodes` array is empty or omitted, the connector will automatically browse the OPC UA address space and discover available nodes. You can then use the discovery API endpoints to view and configure discovered nodes.

### MQTT Sources

```json
{
  "id": "iot-sensors",
  "type": "mqtt",
  "enabled": true,
  "name": "IoT Sensors",
  "config": {
    "broker": "mqtt://192.168.1.200:1883",
    "clientId": "universal-connector-001",
    "username": "mqtt_user",
    "password": "mqtt_password",
    "topics": [
      "sensors/+/temperature",
      "sensors/+/humidity",
      "machines/+/status"
    ],
    "qos": 1,
    "options": {
      "keepalive": 60,
      "connectTimeout": 30000,
      "reconnectPeriod": 1000,
      "clean": true
    }
  }
}
```

**Parametri MQTT:**
- `broker`: URL del broker MQTT
- `clientId`: ID client univoco
- `username/password`: Credenziali del broker
- `topics`: Array di topic da sottoscrivere (supporta wildcards) (optional - triggers auto-discovery if empty)
- `qos`: Quality of Service level (0, 1, 2)
- `options`: Opzioni aggiuntive del client MQTT

**Auto-Discovery Mode:**
If `topics` array is empty or omitted, the connector will subscribe to '#' wildcard topic for 10 seconds to discover all active topics on the broker. You can then use the discovery API endpoints to view and configure discovered topics.

### HTTP Sources

```json
{
  "id": "api-data",
  "type": "http",
  "enabled": true,
  "name": "External API",
  "config": {
    "url": "https://api.example.com/data",
    "method": "GET",
    "headers": {
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    "authentication": {
      "type": "bearer|basic|apikey|custom",
      "token": "bearer_token_here",
      "username": "basic_username",
      "password": "basic_password",
      "key": "api_key_header_name",
      "value": "api_key_value"
    },
    "polling": {
      "enabled": true,
      "interval": 30000
    },
    "timeout": 10000,
    "params": {
      "param1": "value1"
    },
    "data": {
      "request": "data"
    }
  }
}
```

**Parametri HTTP:**
- `url`: URL dell'endpoint
- `method`: Metodo HTTP (GET, POST, PUT, etc.)
- `headers`: Headers HTTP personalizzati
- `authentication`: Configurazione autenticazione
- `polling`: Configurazione polling automatico
- `timeout`: Timeout richiesta in millisecondi
- `params`: Query parameters
- `data`: Body della richiesta (per POST/PUT)

### Modbus Sources

```json
{
  "id": "modbus-plc",
  "type": "modbus",
  "enabled": true,
  "name": "Modbus PLC",
  "config": {
    "transport": "tcp",
    "host": "192.168.1.50",
    "port": 502,
    "unitId": 1,
    "timeout": 5000,
    "registers": [
      {
        "address": 0,
        "type": "HoldingRegister",
        "name": "Temperature",
        "scale": 0.1
      },
      {
        "address": 10,
        "type": "InputRegister",
        "name": "Pressure",
        "scale": 1
      },
      {
        "address": 100,
        "type": "Coil",
        "name": "MotorStatus"
      }
    ],
    "polling": {
      "enabled": true,
      "interval": 1000
    },
    "discoveryRanges": {
      "holdingRegisters": { "start": 0, "count": 100 },
      "inputRegisters": { "start": 0, "count": 100 },
      "coils": { "start": 0, "count": 100 },
      "discreteInputs": { "start": 0, "count": 100 }
    }
  }
}
```

**Parametri Modbus:**
- `transport`: Tipo di trasporto ('tcp' o 'rtu')
- `host`: Indirizzo IP del dispositivo Modbus TCP
- `port`: Porta Modbus (default: 502)
- `unitId`: ID unità Modbus (slave address)
- `timeout`: Timeout richiesta in millisecondi
- `registers`: Array di registri da leggere (optional - triggers auto-discovery if empty)
  - `address`: Indirizzo del registro
  - `type`: Tipo registro (HoldingRegister, InputRegister, Coil, DiscreteInput)
  - `name`: Nome descrittivo
  - `scale`: Fattore di scala (optional)
- `polling`: Configurazione polling
- `discoveryRanges`: Range di indirizzi per l'auto-discovery (optional)

**Auto-Discovery Mode:**
If `registers` array is empty or omitted, the connector will scan the configured address ranges for responsive registers across all function codes (Holding Registers, Input Registers, Coils, Discrete Inputs). The default ranges scan 100 addresses starting from 0 for each register type. You can customize these ranges with the `discoveryRanges` parameter. Use the discovery API endpoints to view discovered registers and configure which ones to monitor.

**RTU Configuration (Serial):**
For Modbus RTU over serial:
```json
{
  "transport": "rtu",
  "serialPort": "COM1",
  "baudRate": 9600,
  "dataBits": 8,
  "stopBits": 1,
  "parity": "none",
  "unitId": 1
}
```

## Configurazione Retry

```json
{
  "retryConfig": {
    "enabled": true,
    "maxRetries": 3,
    "retryDelay": 5000
  }
}
```

- `enabled`: Abilita/disabilita i tentativi di riconnessione
- `maxRetries`: Numero massimo di tentativi
- `retryDelay`: Ritardo tra i tentativi in millisecondi

## Data Processing

```json
{
  "dataProcessing": {
    "enabled": true,
    "transforms": [
      "normalizeTimestamp",
      "convertToNumber",
      "celsiusToFahrenheit",
      "flattenObject",
      "addQualityIndicators"
    ],
    "validation": {
      "range": {
        "field": "temperature",
        "min": -50,
        "max": 200
      },
      "requiredFields": {
        "fields": ["temperature", "pressure"]
      },
      "dataType": {
        "field": "value",
        "type": "number"
      }
    }
  }
}
```

### Transform Disponibili

- `normalizeTimestamp`: Normalizza i timestamp in formato ISO
- `convertToNumber`: Converte stringhe numeriche in numeri
- `celsiusToFahrenheit`: Converte temperature da Celsius a Fahrenheit
- `flattenObject`: Appiattisce oggetti nested
- `addQualityIndicators`: Aggiunge indicatori di qualità

### Validatori Disponibili

- `range`: Valida che un valore sia in un intervallo
- `requiredFields`: Valida che campi richiesti siano presenti
- `dataType`: Valida il tipo di dato

## Variabili d'Ambiente

Crea un file `.env` per configurare l'ambiente:

```bash
# Environment
NODE_ENV=production
PORT=3000
WS_PORT=3001

# Logging
LOG_LEVEL=info
LOG_FILE=logs/connector.log

# Data Storage
DATA_RETENTION_DAYS=7
MAX_DATA_POINTS=10000

# API Security
API_KEY=your-secure-api-key-here
```

## Esempi di Configurazione

### Configurazione Industry 5.0 Completa

```json
{
  "sources": [
    {
      "id": "production-line-plc",
      "type": "opcua",
      "enabled": true,
      "name": "Production Line PLC",
      "description": "Main production line monitoring",
      "config": {
        "endpoint": "opc.tcp://192.168.100.10:4840",
        "nodes": [
          "ns=2;s=Line1.Temperature",
          "ns=2;s=Line1.Pressure",
          "ns=2;s=Line1.Speed",
          "ns=2;s=Line1.Quality.OEE"
        ]
      },
      "dataProcessing": {
        "enabled": true,
        "transforms": ["normalizeTimestamp", "addQualityIndicators"],
        "validation": {
          "range": {
            "field": "temperature",
            "min": 15,
            "max": 85
          }
        }
      }
    },
    {
      "id": "iot-environmental",
      "type": "mqtt",
      "enabled": true,
      "name": "Environmental IoT Network",
      "description": "Factory environmental monitoring",
      "config": {
        "broker": "mqtt://iot-broker.factory.local:1883",
        "topics": [
          "factory/environment/+/temperature",
          "factory/environment/+/humidity",
          "factory/environment/+/air_quality",
          "factory/safety/+/gas_detection"
        ],
        "qos": 2
      }
    },
    {
      "id": "erp-integration",
      "type": "http",
      "enabled": true,
      "name": "ERP System Integration",
      "description": "SAP ERP system data integration",
      "config": {
        "url": "https://erp.company.com/api/production/current",
        "method": "GET",
        "authentication": {
          "type": "bearer",
          "token": "eyJhbGciOiJIUzI1NiIs..."
        },
        "polling": {
          "enabled": true,
          "interval": 60000
        }
      }
    }
  ]
}
```

## Best Practices

1. **Security**: Usa sempre autenticazione quando disponibile
2. **Polling Intervals**: Bilancia frequenza vs carico di rete
3. **Error Handling**: Configura retry appropriati per ogni source
4. **Data Processing**: Usa transforms per normalizzare i dati
5. **Monitoring**: Configura validation per assicurare qualità dati
6. **Naming**: Usa ID e nomi descrittivi per le sources
7. **Documentation**: Aggiungi description per ogni source

## Troubleshooting

### Source non si connette
1. Verifica la configurazione di rete
2. Controlla credenziali di autenticazione
3. Verifica i log per errori specifici
4. Testa la connettività manualmente

### Dati non arrivano
1. Verifica che la source sia enabled
2. Controlla i topic/nodi configurati
3. Verifica i filtri di validazione
4. Monitora i log di processing

### Performance Issues
1. Riduci la frequenza di polling
2. Limita il numero di nodi/topic monitorati
3. Ottimizza i transforms di processing
4. Monitora l'utilizzo di memoria
