# Industrial Connectors Documentation

This document provides detailed information about all industrial protocol connectors available in the Universal Data Connector.

## Table of Contents

1. [Modbus Connector](#modbus-connector)
2. [Siemens S7 Connector](#siemens-s7-connector)
3. [EtherCAT Connector](#ethercat-connector)
4. [PROFINET Connector](#profinet-connector)
5. [BACnet Connector](#bacnet-connector)
6. [FINS (Omron) Connector](#fins-omron-connector)
7. [MELSEC (Mitsubishi) Connector](#melsec-mitsubishi-connector)
8. [CIP/EtherNet/IP Connector](#cipethernet-ip-connector)
9. [Serial Connector](#serial-connector)

---

## Modbus Connector

**Type:** `modbus`  
**Library:** `modbus-serial`  
**Protocols:** Modbus TCP, Modbus RTU

### Description
Modbus is one of the most widely used protocols in industrial automation, supporting both TCP/IP and serial communication.

### Configuration Example

#### Modbus TCP
```json
{
  "id": "modbus-plc-1",
  "type": "modbus",
  "enabled": true,
  "config": {
    "connectionType": "tcp",
    "host": "192.168.1.10",
    "port": 502,
    "unitId": 1,
    "pollingInterval": 1000,
    "timeout": 5000,
    "registers": [
      {
        "name": "temperature",
        "address": 0,
        "type": "holding",
        "dataType": "float",
        "count": 2
      },
      {
        "name": "pressure",
        "address": 10,
        "type": "input",
        "dataType": "uint16",
        "count": 1
      },
      {
        "name": "valve_open",
        "address": 0,
        "type": "coil",
        "dataType": "bool",
        "count": 1
      }
    ]
  }
}
```

#### Modbus RTU
```json
{
  "id": "modbus-rtu-1",
  "type": "modbus",
  "enabled": true,
  "config": {
    "connectionType": "rtu",
    "serialPort": "/dev/ttyUSB0",
    "baudRate": 9600,
    "dataBits": 8,
    "stopBits": 1,
    "parity": "none",
    "unitId": 1,
    "pollingInterval": 1000,
    "registers": [...]
  }
}
```

### Register Types
- `holding`: Read/Write registers
- `input`: Read-only input registers
- `coil`: Read/Write coils (single bits)
- `discrete`: Read-only discrete inputs

### Data Types
- `uint16`, `int16`: 16-bit integers
- `uint32`, `int32`: 32-bit integers
- `float`: 32-bit floating point
- `bool`: Boolean

---

## Siemens S7 Connector

**Type:** `s7` or `siemens-s7`  
**Library:** `nodes7`  
**PLCs:** S7-300, S7-400, S7-1200, S7-1500

### Description
Connects to Siemens S7 PLCs using the S7 protocol over Ethernet.

### Configuration Example
```json
{
  "id": "siemens-plc-1",
  "type": "s7",
  "enabled": true,
  "config": {
    "host": "192.168.1.20",
    "port": 102,
    "rack": 0,
    "slot": 2,
    "timeout": 5000,
    "pollingInterval": 1000,
    "variables": {
      "motor_speed": "DB1,INT0",
      "conveyor_running": "DB1,X2.0",
      "temperature_sp": "DB2,REAL4",
      "production_count": "DB3,DINT10"
    }
  }
}
```

### Variable Addressing
- `DBx,Ty`: Data Block addressing
  - `DB1,INT0`: Integer at byte 0 in DB1
  - `DB1,X2.0`: Bit 0 at byte 2 in DB1
  - `DB2,REAL4`: Real (float) at byte 4 in DB2
  - `DB3,DINT10`: Double integer at byte 10 in DB3

### Supported Data Types
- `X` (Bit), `BYTE`, `WORD`, `DWORD`
- `INT`, `DINT` (Integers)
- `REAL` (Float)
- `STRING`

---

## EtherCAT Connector

**Type:** `ethercat`  
**Protocol:** EtherCAT

### Description
EtherCAT (Ethernet for Control Automation Technology) is a high-performance, low-latency industrial Ethernet protocol. 

**Note:** Direct EtherCAT support requires specialized hardware and real-time OS. This is a conceptual implementation. For production use, consider using Beckhoff TwinCAT or similar EtherCAT master software.

### Configuration Example
```json
{
  "id": "ethercat-master-1",
  "type": "ethercat",
  "enabled": true,
  "config": {
    "networkInterface": "eth0",
    "cycleTime": 1,
    "slaves": [
      {
        "position": 0,
        "name": "IO_Module_1",
        "vendorId": "0x00000002",
        "productCode": "0x044c2c52",
        "inputs": [
          { "name": "input_1", "type": "digital" },
          { "name": "analog_in", "type": "analog" }
        ],
        "outputs": [
          { "name": "output_1", "type": "digital" }
        ]
      }
    ]
  }
}
```

---

## PROFINET Connector

**Type:** `profinet`  
**Protocol:** PROFINET IO

### Description
PROFINET is a widely used industrial Ethernet protocol, particularly in Siemens automation systems.

**Note:** Direct PROFINET requires specialized drivers. This implementation uses controller interface communication.

### Configuration Example
```json
{
  "id": "profinet-controller-1",
  "type": "profinet",
  "enabled": true,
  "config": {
    "controllerIp": "192.168.1.30",
    "cycleTime": 10,
    "devices": [
      {
        "name": "IO_Device_1",
        "slot": 1,
        "type": "ET200S",
        "vendorId": "0x002a",
        "deviceId": "0x0101",
        "inputs": [
          { "name": "sensor_1", "type": "digital" },
          { "name": "sensor_2", "type": "analog" }
        ],
        "outputs": [
          { "name": "valve_1", "type": "digital" }
        ]
      }
    ]
  }
}
```

---

## BACnet Connector

**Type:** `bacnet`  
**Library:** `bacstack`  
**Protocol:** BACnet/IP

### Description
BACnet (Building Automation and Control Networks) is commonly used in HVAC and building automation systems.

### Configuration Example
```json
{
  "id": "bacnet-controller-1",
  "type": "bacnet",
  "enabled": true,
  "config": {
    "port": 47808,
    "interface": "192.168.1.100",
    "broadcastAddress": "192.168.1.255",
    "timeout": 6000,
    "pollingInterval": 5000,
    "devices": [
      {
        "address": "192.168.1.40",
        "deviceId": 1234,
        "objects": [
          {
            "name": "room_temperature",
            "type": 2,
            "instance": 1,
            "property": 85
          },
          {
            "name": "hvac_mode",
            "type": 19,
            "instance": 1,
            "property": 85
          }
        ]
      }
    ]
  }
}
```

### Common Object Types
- `0`: Analog Input
- `1`: Analog Output
- `2`: Analog Value
- `3`: Binary Input
- `4`: Binary Output
- `5`: Binary Value
- `19`: Multi-state Value

### Property ID
- `85`: Present Value (most common)
- `77`: Out of Service
- `111`: Status Flags

---

## FINS (Omron) Connector

**Type:** `fins` or `omron-fins`  
**Protocol:** FINS TCP
**PLCs:** Omron CJ, CS, CP, NJ, NX series

### Description
FINS (Factory Interface Network Service) is Omron's proprietary protocol for PLC communication.

### Configuration Example
```json
{
  "id": "omron-plc-1",
  "type": "fins",
  "enabled": true,
  "config": {
    "host": "192.168.1.50",
    "port": 9600,
    "localNode": 0,
    "remoteNode": 0,
    "localNet": 0,
    "remoteNet": 0,
    "pollingInterval": 1000,
    "memory": [
      {
        "name": "cio_100",
        "area": "CIO",
        "address": 100,
        "length": 1,
        "dataType": "word"
      },
      {
        "name": "dm_1000",
        "area": "DM",
        "address": 1000,
        "length": 2,
        "dataType": "float"
      }
    ]
  }
}
```

### Memory Areas
- `CIO`: Core I/O area
- `WR`: Work area
- `HR`: Holding relay area
- `AR`: Auxiliary relay area
- `DM`: Data memory area
- `EM`: Extended memory area

---

## MELSEC (Mitsubishi) Connector

**Type:** `melsec` or `mitsubishi`  
**Protocol:** MC Protocol (3E Frame)
**PLCs:** Mitsubishi Q, L, FX series

### Description
MC Protocol is Mitsubishi's communication protocol for MELSEC PLCs.

### Configuration Example
```json
{
  "id": "mitsubishi-plc-1",
  "type": "melsec",
  "enabled": true,
  "config": {
    "host": "192.168.1.60",
    "port": 5000,
    "protocol": "3E",
    "networkNo": 0,
    "pcNo": 255,
    "pollingInterval": 1000,
    "devices": [
      {
        "name": "input_x0",
        "deviceCode": "X",
        "address": 0,
        "length": 1,
        "dataType": "bool"
      },
      {
        "name": "output_y10",
        "deviceCode": "Y",
        "address": 10,
        "length": 1,
        "dataType": "bool"
      },
      {
        "name": "data_d100",
        "deviceCode": "D",
        "address": 100,
        "length": 2,
        "dataType": "float"
      }
    ]
  }
}
```

### Device Codes
- `X`: Input
- `Y`: Output
- `M`: Internal relay
- `D`: Data register
- `W`: Link register
- `R`: File register
- `T`: Timer
- `C`: Counter

---

## CIP/EtherNet/IP Connector

**Type:** `cip`, `ethernet-ip`, or `rockwell`  
**Protocol:** Common Industrial Protocol / EtherNet/IP
**PLCs:** Allen-Bradley/Rockwell ControlLogix, CompactLogix, Micro800

### Description
EtherNet/IP is widely used in North America and is the standard protocol for Allen-Bradley PLCs.

**Note:** Requires `ethernet-ip` library: `npm install ethernet-ip`

### Configuration Example
```json
{
  "id": "rockwell-plc-1",
  "type": "cip",
  "enabled": true,
  "config": {
    "host": "192.168.1.70",
    "slot": 0,
    "pollingInterval": 1000,
    "tags": [
      {
        "name": "conveyor_speed",
        "address": "ConveyorSpeed",
        "dataType": "DINT"
      },
      {
        "name": "motor_running",
        "address": "Motor1.Running",
        "dataType": "BOOL"
      },
      {
        "name": "temperature",
        "address": "ProcessTemp",
        "dataType": "REAL"
      }
    ]
  }
}
```

### Data Types
- `BOOL`: Boolean
- `SINT`, `INT`, `DINT`: Signed integers
- `REAL`: Floating point
- `STRING`: String

---

## Serial Connector

**Type:** `serial`, `rs232`, or `rs485`  
**Library:** `serialport`
**Protocols:** Generic serial, RS232, RS485

### Description
Generic serial communication connector for devices using custom protocols, legacy equipment, or standard serial interfaces.

### Configuration Example

#### Active Polling Mode
```json
{
  "id": "serial-device-1",
  "type": "serial",
  "enabled": true,
  "config": {
    "portName": "/dev/ttyUSB0",
    "baudRate": 9600,
    "dataBits": 8,
    "stopBits": 1,
    "parity": "none",
    "mode": "active",
    "pollingInterval": 1000,
    "queryCommand": {
      "hex": "01030000000A"
    },
    "terminator": "0D0A",
    "parser": {
      "type": "ascii"
    }
  }
}
```

#### Passive Listening Mode
```json
{
  "id": "serial-sensor-1",
  "type": "serial",
  "enabled": true,
  "config": {
    "portName": "COM3",
    "baudRate": 115200,
    "dataBits": 8,
    "stopBits": 1,
    "parity": "none",
    "mode": "passive",
    "terminator": "0A",
    "parser": {
      "type": "json"
    }
  }
}
```

### Parser Types
- `ascii`: ASCII string
- `utf8`: UTF-8 string
- `json`: JSON parsing
- `hex`: Hexadecimal string (default)
- `custom`: Custom parser implementation

---

## Installation

Install all connector dependencies:

```bash
npm install
```

Or install specific connector libraries:

```bash
# Modbus
npm install modbus-serial

# Siemens S7
npm install nodes7

# BACnet
npm install bacstack

# Serial
npm install serialport

# EtherNet/IP (optional)
npm install ethernet-ip
```

---

## Protocol Support Matrix

| Protocol | Read | Write | Subscription | Real-time | Library Required |
|----------|------|-------|--------------|-----------|------------------|
| Modbus TCP/RTU | ✅ | ✅ | ❌ | ⚡ Fast | modbus-serial |
| Siemens S7 | ✅ | ✅ | ❌ | ⚡ Fast | nodes7 |
| EtherCAT | ✅ | ✅ | ✅ | ⚡⚡ Ultra-fast | Hardware dependent |
| PROFINET | ✅ | ✅ | ✅ | ⚡⚡ Ultra-fast | Hardware dependent |
| BACnet | ✅ | ✅ | ✅ | 🔄 Medium | bacstack |
| FINS (Omron) | ✅ | ✅ | ❌ | ⚡ Fast | Built-in |
| MELSEC | ✅ | ✅ | ❌ | ⚡ Fast | Built-in |
| EtherNet/IP | ✅ | ✅ | ✅ | ⚡ Fast | ethernet-ip |
| Serial | ✅ | ✅ | ❌ | 🔄 Variable | serialport |

---

## Best Practices

1. **Polling Intervals**: Adjust based on network load and data criticality
   - Real-time control: 1-10ms (EtherCAT, PROFINET)
   - Fast monitoring: 100-500ms (Modbus, S7)
   - Standard monitoring: 1000-5000ms (BACnet, Serial)

2. **Error Handling**: All connectors implement automatic reconnection with exponential backoff

3. **Data Buffering**: Consider implementing data buffering for critical applications

4. **Network Segmentation**: Use separate networks for real-time protocols (EtherCAT, PROFINET)

5. **Security**: Implement VLANs and firewall rules for industrial networks

---

## Troubleshooting

### Connection Issues
- Verify IP addresses and port numbers
- Check firewall settings
- Ensure PLC/device is in RUN mode
- Verify network connectivity (ping test)

### Data Reading Issues
- Confirm correct addressing format for the protocol
- Check data types match PLC configuration
- Verify register/tag permissions

### Performance Issues
- Reduce polling intervals
- Limit number of registers/tags per request
- Use batch reading where supported

---

## Additional Resources

- [Modbus Protocol Specification](http://www.modbus.org/)
- [Siemens S7 Communication](https://support.industry.siemens.com/)
- [BACnet Standard](http://www.bacnet.org/)
- [ODVA EtherNet/IP](https://www.odva.org/)
- [PROFINET IO](https://www.profibus.com/technology/profinet/)

---

## License

MIT License - See LICENSE file for details
