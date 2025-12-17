# Auto-Discovery Guide

**[🇬🇧 English](AutoDiscovery.md)** | **[🇮🇹 Italiano](AutoDiscovery.it.md)**

---

## Overview

The Universal Data Connector supports **automatic discovery** of data points for protocols that allow exploration and browsing. This enables dynamic configuration and eliminates the need to manually specify all nodes, topics, or registers upfront.

## Supported Protocols

### OPC UA - Address Space Browsing
The OPC UA connector can automatically browse the entire address space to discover available nodes.

**Features:**
- Recursive browsing of the node tree
- Discovers Variables, Objects, and Methods
- Captures node metadata (browseName, displayName, dataType)
- Follows references to explore the complete hierarchy

### MQTT - Topic Discovery
The MQTT connector can discover active topics by subscribing to wildcard patterns.

**Features:**
- Subscribes to '#' wildcard for 10 seconds
- Captures all published topics during discovery period
- Detects message patterns and structures
- Identifies active data streams

### Modbus - Register Scanning
The Modbus connector can scan configured address ranges to find responsive registers.

**Features:**
- Scans Holding Registers (FC3)
- Scans Input Registers (FC4)
- Scans Coils (FC1)
- Scans Discrete Inputs (FC2)
- Tests read operations to identify accessible addresses
- Configurable scan ranges
- Batch reading for efficiency

## Configuration

To enable auto-discovery, configure a source with **empty** arrays for the data points parameter:

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
    "nodes": []  // Empty array triggers discovery
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
    "topics": []  // Empty array triggers discovery
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
    "registers": [],  // Empty array triggers discovery
    "discoveryRanges": {
      "holdingRegisters": { "start": 0, "count": 100 },
      "inputRegisters": { "start": 0, "count": 100 },
      "coils": { "start": 0, "count": 100 },
      "discreteInputs": { "start": 0, "count": 100 }
    }
  }
}
```

**Note:** The `discoveryRanges` parameter is optional for Modbus. If not specified, the default ranges scan 100 addresses starting from 0 for each register type.

## Discovery Workflow

### 1. Configure Source for Discovery

Create or update a source configuration with empty data point arrays:

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

### 2. Start the Connector

```bash
curl -X POST "http://localhost:3000/api/sources/plc-discovery/start"
```

The connector will:
- Connect to the data source
- Detect that data points array is empty
- Automatically trigger discovery process
- Store discovered items in memory

### 3. Monitor Discovery Progress

Check the logs for discovery status:

```bash
# View logs
tail -f logs/app.log

# Expected output:
# [INFO] Starting auto-discovery for OPC UA connector 'plc-discovery'
# [INFO] Browsing node: ns=0;i=85 (Objects)
# [INFO] Discovered 47 nodes for connector 'plc-discovery'
```

### 4. View Discovered Items

Retrieve the discovered items via API:

```bash
curl "http://localhost:3000/api/sources/plc-discovery/discovery"
```

**Example Response - OPC UA:**
```json
{
  "sourceId": "plc-discovery",
  "protocol": "OPC-UA",
  "discoveredNodes": [
    {
      "nodeId": "ns=2;s=Temperature",
      "browseName": "Temperature",
      "displayName": "Temperature Sensor",
      "nodeClass": "Variable",
      "dataType": "Double"
    },
    {
      "nodeId": "ns=2;s=Pressure",
      "browseName": "Pressure",
      "displayName": "Pressure Sensor",
      "nodeClass": "Variable",
      "dataType": "Double"
    }
  ]
}
```

**Example Response - MQTT:**
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

**Example Response - Modbus:**
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

### 5. Select and Configure Items

After reviewing discovered items, configure the connector with selected data points:

**OPC UA Configuration:**
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

**MQTT Configuration:**
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

**Modbus Configuration:**
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

### 6. Connector Restart

The connector will:
- Save the new configuration to `config/sources.json`
- Restart automatically with the selected data points
- Begin active monitoring and data collection

## Discovery Events

The discovery process emits events that can be captured by the mapping engine:

### OPC UA Events
```javascript
connector.on('nodesDiscovered', (data) => {
  console.log(`Discovered ${data.nodes.length} nodes from ${data.sourceId}`);
});
```

### MQTT Events
```javascript
connector.on('topicsDiscovered', (data) => {
  console.log(`Discovered ${data.topics.length} topics from ${data.sourceId}`);
});
```

### Modbus Events
```javascript
connector.on('registersDiscovered', (data) => {
  console.log(`Discovered ${data.registers.length} registers from ${data.sourceId}`);
});
```

## Best Practices

### Discovery Timing
- **OPC UA**: Discovery completes when full address space is browsed (typically 5-30 seconds)
- **MQTT**: Fixed 10-second discovery window - ensure topics are actively publishing
- **Modbus**: Scan time depends on range size (typically 1-5 seconds per 100 addresses)

### Security Considerations
- Discovery requires appropriate permissions on the data source
- OPC UA discovery respects security policies and authentication
- MQTT discovery requires subscribe permissions
- Modbus discovery tests read-only operations

### Performance Optimization
- For large OPC UA address spaces, consider browsing specific subtrees
- For MQTT, ensure discovery window captures all relevant topics
- For Modbus, limit discovery ranges to known register areas
- Use discovery in development/commissioning phase, not production

### Configuration Management
- Review discovered items before activating
- Add meaningful names and units to Modbus registers
- Use MQTT topic patterns with wildcards for flexibility
- Document selected OPC UA nodes with their purpose

## Troubleshooting

### No Items Discovered

**OPC UA:**
- Verify endpoint URL and connectivity
- Check security settings (certificates, authentication)
- Ensure browsing permissions on the server

**MQTT:**
- Verify broker connection
- Ensure topics are actively publishing during discovery window
- Check subscribe permissions

**Modbus:**
- Verify device connectivity and unit ID
- Check discovery ranges match device register map
- Ensure read permissions on the device
- Some devices may not respond to reads on unused addresses

### Discovery Times Out

- Increase timeout values in configuration
- For Modbus, reduce discovery range sizes
- For OPC UA, browse specific subtrees instead of root
- Check network latency and device response times

### Partial Results

- Review logs for errors during discovery
- Some nodes/registers may be protected or unavailable
- Discovery captures what's accessible at that moment
- Re-run discovery to capture additional items

## Integration with Mapping Tools

Discovered items are automatically available to the mapping engine:

1. Discovery emits protocol-specific events
2. Mapping engine receives discovered metadata
3. Automatic entity creation based on data types
4. Integration with intermediate data model generation
5. Export to JSON, NGSI-LD, or TOON formats

See [Mapping Tools Documentation](Mapping.md) for details on automatic mapping of discovered items.

## API Reference

### GET /api/sources/:id/discovery
Retrieve discovered items for a source.

**Parameters:**
- `id` (path): Source ID

**Response:** Protocol-specific discovery results

### POST /api/sources/:id/configure
Configure source with selected items.

**Parameters:**
- `id` (path): Source ID

**Body:** Protocol-specific configuration

**Response:**
```json
{
  "success": true,
  "message": "Configuration updated and connector restarted",
  "sourceId": "plc-discovery"
}
```

## Examples

See `config/modbus.example.json` for complete Modbus configuration examples including discovery mode.

For more protocol-specific examples, refer to:
- [Configuration Guide](Configuration.md)
- [API Documentation](API.md)
- [Industrial Connectors](IndustrialConnectors.md)
