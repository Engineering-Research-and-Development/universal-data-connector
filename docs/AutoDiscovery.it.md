# Guida Auto-Discovery

**[🇬🇧 English](AutoDiscovery.md)** | **[🇮🇹 Italiano](AutoDiscovery.it.md)**

---

## Panoramica

L'Universal Data Connector supporta la **discovery automatica** dei data point per i protocolli che permettono esplorazione e browsing. Questo consente una configurazione dinamica ed elimina la necessità di specificare manualmente tutti i nodi, topic o registri in anticipo.

## Protocolli Supportati

### OPC UA - Browsing Address Space
Il connettore OPC UA può esplorare automaticamente l'intero address space per scoprire i nodi disponibili.

**Caratteristiche:**
- Browsing ricorsivo dell'albero dei nodi
- Scopre Variabili, Oggetti e Metodi
- Cattura i metadati dei nodi (browseName, displayName, dataType)
- Segue i riferimenti per esplorare la gerarchia completa

### MQTT - Discovery Topic
Il connettore MQTT può scoprire i topic attivi sottoscrivendosi a pattern wildcard.

**Caratteristiche:**
- Sottoscrive al wildcard '#' per 10 secondi
- Cattura tutti i topic pubblicati durante il periodo di discovery
- Rileva pattern e strutture dei messaggi
- Identifica flussi di dati attivi

### Modbus - Scansione Registri
Il connettore Modbus può scansionare range di indirizzi configurati per trovare registri che rispondono.

**Caratteristiche:**
- Scansiona Holding Registers (FC3)
- Scansiona Input Registers (FC4)
- Scansiona Coils (FC1)
- Scansiona Discrete Inputs (FC2)
- Testa operazioni di lettura per identificare indirizzi accessibili
- Range di scansione configurabili
- Lettura batch per efficienza

## Configurazione

Per abilitare l'auto-discovery, configura una source con array **vuoti** per il parametro dei data point:

### OPC UA Discovery
```json
{
  "id": "plc-001",
  "type": "opcua",
  "enabled": true,
  "config": {
    "endpoint": "opc.tcp://192.168.1.100:4840",
    "securityPolicy": "None",
    "securityMode": "None",
    "nodes": []  // Array vuoto attiva la discovery
  }
}
```

### MQTT Discovery
```json
{
  "id": "mqtt-sensors",
  "type": "mqtt",
  "enabled": true,
  "config": {
    "broker": "mqtt://192.168.1.200:1883",
    "clientId": "discovery-client",
    "topics": []  // Array vuoto attiva la discovery
  }
}
```

### Modbus Discovery
```json
{
  "id": "modbus-plc",
  "type": "modbus",
  "enabled": true,
  "config": {
    "transport": "tcp",
    "host": "192.168.1.50",
    "port": 502,
    "unitId": 1,
    "registers": [],  // Array vuoto attiva la discovery
    "discoveryRanges": {
      "holdingRegisters": { "start": 0, "count": 100 },
      "inputRegisters": { "start": 0, "count": 100 },
      "coils": { "start": 0, "count": 100 },
      "discreteInputs": { "start": 0, "count": 100 }
    }
  }
}
```

**Nota:** Il parametro `discoveryRanges` è opzionale per Modbus. Se non specificato, i range predefiniti scansionano 100 indirizzi partendo da 0 per ogni tipo di registro.

## Workflow Discovery

### 1. Configura Source per Discovery

Crea o aggiorna una configurazione source con array di data point vuoti:

```bash
curl -X POST "http://localhost:3000/api/config/sources/configure" \
  -H "Content-Type: application/json" \
  -d '{
    "sources": [{
      "id": "plc-discovery",
      "type": "opcua",
      "enabled": true,
      "config": {
        "endpoint": "opc.tcp://192.168.1.100:4840",
        "nodes": []
      }
    }]
  }'
```

### 2. Avvia il Connettore

```bash
curl -X POST "http://localhost:3000/api/sources/plc-discovery/start"
```

Il connettore:
- Si connette alla sorgente dati
- Rileva che l'array dei data point è vuoto
- Attiva automaticamente il processo di discovery
- Memorizza gli elementi scoperti in memoria

### 3. Monitora il Progresso della Discovery

Controlla i log per lo stato della discovery:

```bash
# Visualizza i log
tail -f logs/app.log

# Output atteso:
# [INFO] Starting auto-discovery for OPC UA connector 'plc-discovery'
# [INFO] Browsing node: ns=0;i=85 (Objects)
# [INFO] Discovered 47 nodes for connector 'plc-discovery'
```

### 4. Visualizza Elementi Scoperti

Recupera gli elementi scoperti via API:

```bash
curl "http://localhost:3000/api/sources/plc-discovery/discovery"
```

**Esempio Response - OPC UA:**
```json
{
  "sourceId": "plc-discovery",
  "protocol": "OPC-UA",
  "discoveredNodes": [
    {
      "nodeId": "ns=2;s=Temperature",
      "browseName": "Temperature",
      "displayName": "Sensore Temperatura",
      "nodeClass": "Variable",
      "dataType": "Double"
    },
    {
      "nodeId": "ns=2;s=Pressure",
      "browseName": "Pressure",
      "displayName": "Sensore Pressione",
      "nodeClass": "Variable",
      "dataType": "Double"
    }
  ]
}
```

**Esempio Response - MQTT:**
```json
{
  "sourceId": "mqtt-sensors",
  "protocol": "MQTT",
  "discoveredTopics": [
    "sensors/temp/room1",
    "sensors/temp/room2",
    "sensors/humidity/room1",
    "machines/status/line1",
    "machines/status/line2"
  ]
}
```

**Esempio Response - Modbus:**
```json
{
  "sourceId": "modbus-plc",
  "protocol": "Modbus",
  "discoveredRegisters": [
    {
      "address": 0,
      "type": "HoldingRegister",
      "name": "HR_0",
      "value": 234,
      "functionCode": 3
    },
    {
      "address": 1,
      "type": "HoldingRegister",
      "name": "HR_1",
      "value": 567,
      "functionCode": 3
    },
    {
      "address": 10,
      "type": "InputRegister",
      "name": "IR_10",
      "value": 123,
      "functionCode": 4
    },
    {
      "address": 100,
      "type": "Coil",
      "name": "C_100",
      "value": true,
      "functionCode": 1
    }
  ]
}
```

### 5. Seleziona e Configura Elementi

Dopo aver revisionato gli elementi scoperti, configura il connettore con i data point selezionati:

**Configurazione OPC UA:**
```bash
curl -X POST "http://localhost:3000/api/sources/plc-discovery/configure" \
  -H "Content-Type: application/json" \
  -d '{
    "nodes": [
      "ns=2;s=Temperature",
      "ns=2;s=Pressure"
    ]
  }'
```

**Configurazione MQTT:**
```bash
curl -X POST "http://localhost:3000/api/sources/mqtt-sensors/configure" \
  -H "Content-Type: application/json" \
  -d '{
    "topics": [
      "sensors/+/temperature",
      "machines/+/status"
    ]
  }'
```

**Configurazione Modbus:**
```bash
curl -X POST "http://localhost:3000/api/sources/modbus-plc/configure" \
  -H "Content-Type: application/json" \
  -d '{
    "registers": [
      {
        "address": 0,
        "type": "HoldingRegister",
        "name": "Temperature",
        "scale": 0.1,
        "unit": "°C"
      },
      {
        "address": 10,
        "type": "InputRegister",
        "name": "Pressure",
        "scale": 0.01,
        "unit": "bar"
      },
      {
        "address": 100,
        "type": "Coil",
        "name": "MotorStatus"
      }
    ]
  }'
```

### 6. Riavvio Connettore

Il connettore:
- Salva la nuova configurazione in `config/sources.json`
- Si riavvia automaticamente con i data point selezionati
- Inizia il monitoraggio attivo e la raccolta dati

## Eventi Discovery

Il processo di discovery emette eventi che possono essere catturati dal mapping engine:

### Eventi OPC UA
```javascript
connector.on('nodesDiscovered', (data) => {
  console.log(`Scoperti ${data.nodes.length} nodi da ${data.sourceId}`);
});
```

### Eventi MQTT
```javascript
connector.on('topicsDiscovered', (data) => {
  console.log(`Scoperti ${data.topics.length} topic da ${data.sourceId}`);
});
```

### Eventi Modbus
```javascript
connector.on('registersDiscovered', (data) => {
  console.log(`Scoperti ${data.registers.length} registri da ${data.sourceId}`);
});
```

## Best Practice

### Tempistiche Discovery
- **OPC UA**: Discovery si completa quando l'intero address space è esplorato (tipicamente 5-30 secondi)
- **MQTT**: Finestra di discovery fissa di 10 secondi - assicurati che i topic stiano pubblicando attivamente
- **Modbus**: Tempo di scansione dipende dalla dimensione del range (tipicamente 1-5 secondi per 100 indirizzi)

### Considerazioni di Sicurezza
- La discovery richiede permessi appropriati sulla sorgente dati
- La discovery OPC UA rispetta le policy di sicurezza e autenticazione
- La discovery MQTT richiede permessi di subscribe
- La discovery Modbus testa solo operazioni di lettura

### Ottimizzazione Performance
- Per grandi address space OPC UA, considera di esplorare specifici subtree
- Per MQTT, assicurati che la finestra di discovery catturi tutti i topic rilevanti
- Per Modbus, limita i range di discovery alle aree di registri note
- Usa la discovery in fase di sviluppo/commissioning, non in produzione

### Gestione Configurazione
- Rivedi gli elementi scoperti prima di attivarli
- Aggiungi nomi significativi e unità ai registri Modbus
- Usa pattern di topic MQTT con wildcard per flessibilità
- Documenta i nodi OPC UA selezionati con il loro scopo

## Risoluzione Problemi

### Nessun Elemento Scoperto

**OPC UA:**
- Verifica URL endpoint e connettività
- Controlla impostazioni di sicurezza (certificati, autenticazione)
- Assicurati dei permessi di browsing sul server

**MQTT:**
- Verifica connessione al broker
- Assicurati che i topic stiano pubblicando attivamente durante la finestra di discovery
- Controlla permessi di subscribe

**Modbus:**
- Verifica connettività dispositivo e unit ID
- Controlla che i range di discovery corrispondano alla mappa registri del dispositivo
- Assicurati dei permessi di lettura sul dispositivo
- Alcuni dispositivi potrebbero non rispondere a letture su indirizzi non usati

### Discovery in Timeout

- Aumenta i valori di timeout nella configurazione
- Per Modbus, riduci le dimensioni dei range di discovery
- Per OPC UA, esplora subtree specifici invece del root
- Controlla latenza di rete e tempi di risposta del dispositivo

### Risultati Parziali

- Rivedi i log per errori durante la discovery
- Alcuni nodi/registri potrebbero essere protetti o non disponibili
- La discovery cattura ciò che è accessibile in quel momento
- Riesegui la discovery per catturare elementi aggiuntivi

## Integrazione con Mapping Tools

Gli elementi scoperti sono automaticamente disponibili al mapping engine:

1. Discovery emette eventi specifici per protocollo
2. Mapping engine riceve i metadati scoperti
3. Creazione automatica di entità basata sui tipi di dati
4. Integrazione con generazione modello dati intermedio
5. Export in formati JSON, NGSI-LD o TOON

Vedi [Documentazione Mapping Tools](Mapping.it.md) per dettagli sulla mappatura automatica degli elementi scoperti.

## Riferimento API

### GET /api/sources/:id/discovery
Recupera gli elementi scoperti per una source.

**Parametri:**
- `id` (path): Source ID

**Response:** Risultati discovery specifici per protocollo

### POST /api/sources/:id/configure
Configura source con elementi selezionati.

**Parametri:**
- `id` (path): Source ID

**Body:** Configurazione specifica per protocollo

**Response:**
```json
{
  "success": true,
  "message": "Configurazione aggiornata e connettore riavviato",
  "sourceId": "plc-discovery"
}
```

## Esempi

Vedi `config/modbus.example.json` per esempi completi di configurazione Modbus inclusa la modalità discovery.

Per ulteriori esempi specifici per protocollo, consulta:
- [Guida Configurazione](Configuration.it.md)
- [Documentazione API](API.it.md)
- [Connettori Industriali](IndustrialConnectors.it.md)
