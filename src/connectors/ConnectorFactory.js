const logger = require('../utils/logger');

// Import all connector implementations
const {
  OpcUaConnector,
  MqttConnector,
  HttpConnector,
  ModbusConnector,
  EtherCATConnector,
  S7Connector,
  BACnetConnector,
  ProfinetConnector,
  FinsTcpConnector,
  MelsecConnector,
  CIPConnector,
  SerialConnector,
  AASConnector
} = require('./protocols');

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
    'rs485': SerialConnector,
    'aas': AASConnector,
    'asset-administration-shell': AASConnector
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
