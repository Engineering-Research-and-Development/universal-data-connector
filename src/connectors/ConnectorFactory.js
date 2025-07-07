const logger = require('../utils/logger');

// Import connector implementations
const OpcUaConnector = require('./OpcUaConnector');
const MqttConnector = require('./MqttConnector');
const HttpConnector = require('./HttpConnector');

class ConnectorFactory {
  static connectorTypes = {
    'opcua': OpcUaConnector,
    'mqtt': MqttConnector,
    'http': HttpConnector
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
