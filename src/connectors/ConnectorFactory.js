const logger = require('../utils/logger');

// Import connector implementations
const OpcUaConnector = require('./OpcUaConnector');
const MqttConnector = require('./MqttConnector');
const HttpConnector = require('./HttpConnector');
const ModbusConnector = require('./ModbusConnector');
const EtherCATConnector = require('./EtherCATConnector');
const S7Connector = require('./S7Connector');
const BACnetConnector = require('./BACnetConnector');
const ProfinetConnector = require('./ProfinetConnector');
const FinsTcpConnector = require('./FinsTcpConnector');
const MelsecConnector = require('./MelsecConnector');
const CIPConnector = require('./CIPConnector');
const SerialConnector = require('./SerialConnector');

class ConnectorFactory {
  static connectorTypes = {
    'opcua': OpcUaConnector,
    'mqtt': MqttConnector,
    'http': HttpConnector,
    'modbus': ModbusConnector,
    'ethercat': EtherCATConnector,
    's7': S7Connector,
    'siemens-s7': S7Connector,
    'bacnet': BACnetConnector,
    'profinet': ProfinetConnector,
    'fins': FinsTcpConnector,
    'omron-fins': FinsTcpConnector,
    'melsec': MelsecConnector,
    'mitsubishi': MelsecConnector,
    'cip': CIPConnector,
    'ethernet-ip': CIPConnector,
    'rockwell': CIPConnector,
    'serial': SerialConnector,
    'rs232': SerialConnector,
    'rs485': SerialConnector
  };

  static create(type, config) {
    const ConnectorClass = this.connectorTypes[type];
    
    if (!ConnectorClass) {
      throw new Error(`Unsupported connector type: ${type}`);
    }

    try {
      const connector = new ConnectorClass(config);
      logger.debug(`Created ${type} connector for source '${config.id}'`);
      return connector;
    } catch (error) {
      logger.error(`Failed to create ${type} connector:`, error);
      throw error;
    }
  }

  static getSupportedTypes() {
    return Object.keys(this.connectorTypes);
  }

  static registerConnectorType(type, ConnectorClass) {
    this.connectorTypes[type] = ConnectorClass;
    logger.info(`Registered custom connector type: ${type}`);
  }

  static isTypeSupported(type) {
    return type in this.connectorTypes;
  }
}

module.exports = ConnectorFactory;
