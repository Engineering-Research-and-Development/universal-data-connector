const {
  OPCUAClient,
  MessageSecurityMode,
  SecurityPolicy,
  AttributeIds,
  ClientSubscription,
  TimestampsToReturn,
  MonitoringMode,
  DataChangeFilter,
  DeadbandType,
  DataChangeTrigger
} = require('node-opcua');
const BaseConnector = require('../BaseConnector');
const logger = require('../../utils/logger');

class OpcUaConnector extends BaseConnector {
  constructor(config) {
    super(config);
    this.client = null;
    this.session = null;
    this.subscription = null;
    this.monitoredItems = new Map();
    
    this.validateConfig();
  }

  validateConfig() {
    super.validateConfig();
    
    const { config } = this.config;
    if (!config.endpoint) {
      throw new Error('OPC UA connector requires an endpoint URL');
    }
    if (!config.nodes || !Array.isArray(config.nodes) || config.nodes.length === 0) {
      throw new Error('OPC UA connector requires at least one node to monitor');
    }
  }

  async initialize() {
    await super.initialize();
    
    const { config } = this.config;
    
    // Create OPC UA client
    this.client = OPCUAClient.create({
      applicationName: "Universal Data Connector",
      connectionStrategy: {
        initialDelay: 1000,
        maxRetry: this.maxReconnectAttempts,
        maxDelay: 10000
      },
      securityMode: this.getSecurityMode(config.securityMode),
      securityPolicy: this.getSecurityPolicy(config.securityPolicy),
      endpoint_must_exist: false,
      keepSessionAlive: true,
      requestedSessionTimeout: 60000,
      ...config.clientOptions
    });

    // Setup client event handlers
    this.client.on('connection_reestablished', () => {
      logger.info(`OPC UA client '${this.id}' connection reestablished`);
      this.onConnected();
    });

    this.client.on('connection_lost', () => {
      logger.warn(`OPC UA client '${this.id}' connection lost`);
      this.onDisconnected();
    });

    this.client.on('backoff', (retryCount, delay) => {
      logger.debug(`OPC UA client '${this.id}' backoff: retry ${retryCount}, delay ${delay}ms`);
    });

    logger.debug(`Initialized OPC UA connector for endpoint: ${config.endpoint}`);
  }

  async connect() {
    try {
      const { config } = this.config;
      
      logger.info(`Connecting to OPC UA server: ${config.endpoint}`);
      
      // Connect to the OPC UA server
      await this.client.connect(config.endpoint);
      
      // Create session
      this.session = await this.client.createSession({
        userName: config.username,
        password: config.password
      });
      
      logger.info(`OPC UA session created for connector '${this.id}'`);
      
      // Create subscription for monitoring data changes
      await this.createSubscription();
      
      // Monitor configured nodes
      await this.monitorNodes();
      
      this.onConnected();
      
    } catch (error) {
      logger.error(`Failed to connect OPC UA connector '${this.id}':`, error);
      await this.cleanup();
      throw error;
    }
  }

  async disconnect() {
    await this.cleanup();
  }

  async cleanup() {
    try {
      // Clear monitored items
      if (this.subscription && this.monitoredItems.size > 0) {
        for (const [nodeId, monitoredItem] of this.monitoredItems) {
          try {
            await monitoredItem.terminate();
          } catch (error) {
            logger.debug(`Error terminating monitored item for ${nodeId}:`, error);
          }
        }
        this.monitoredItems.clear();
      }

      // Terminate subscription
      if (this.subscription) {
        try {
          await this.subscription.terminate();
          this.subscription = null;
        } catch (error) {
          logger.debug(`Error terminating OPC UA subscription:`, error);
        }
      }

      // Close session
      if (this.session) {
        try {
          await this.session.close();
          this.session = null;
        } catch (error) {
          logger.debug(`Error closing OPC UA session:`, error);
        }
      }

      // Disconnect client
      if (this.client) {
        try {
          await this.client.disconnect();
        } catch (error) {
          logger.debug(`Error disconnecting OPC UA client:`, error);
        }
      }

      logger.debug(`OPC UA connector '${this.id}' cleanup completed`);
      
    } catch (error) {
      logger.error(`Error during OPC UA connector '${this.id}' cleanup:`, error);
    }
  }

  async createSubscription() {
    const { config } = this.config;
    const subscriptionOptions = {
      requestedPublishingInterval: 1000,
      requestedLifetimeCount: 60,
      requestedMaxKeepAliveCount: 10,
      maxNotificationsPerPublish: 10,
      publishingEnabled: true,
      priority: 10,
      ...config.subscriptionOptions
    };

    this.subscription = ClientSubscription.create(this.session, subscriptionOptions);

    this.subscription.on('started', () => {
      logger.info(`OPC UA subscription started for connector '${this.id}'`);
    });

    this.subscription.on('keepalive', () => {
      logger.debug(`OPC UA subscription keepalive for connector '${this.id}'`);
    });

    this.subscription.on('terminated', () => {
      logger.info(`OPC UA subscription terminated for connector '${this.id}'`);
    });
  }

  async monitorNodes() {
    const { config } = this.config;
    
    for (const nodeId of config.nodes) {
      try {
        await this.monitorNode(nodeId);
      } catch (error) {
        logger.error(`Failed to monitor node '${nodeId}' on connector '${this.id}':`, error);
        // Continue with other nodes
      }
    }
  }

  async monitorNode(nodeId) {
    const monitoringParameters = {
      samplingInterval: 1000,
      discardOldest: true,
      queueSize: 10,
      filter: new DataChangeFilter({
        trigger: DataChangeTrigger.StatusValueTimestamp,
        deadbandType: DeadbandType.None,
        deadbandValue: 0.0
      })
    };

    const monitoredItem = ClientSubscription.prototype.monitor.call(
      this.subscription,
      {
        nodeId: nodeId,
        attributeId: AttributeIds.Value
      },
      monitoringParameters,
      TimestampsToReturn.Both,
      MonitoringMode.Reporting
    );

    monitoredItem.on('changed', (dataValue) => {
      this.handleNodeValueChange(nodeId, dataValue);
    });

    monitoredItem.on('err', (error) => {
      logger.error(`Monitoring error for node '${nodeId}' on connector '${this.id}':`, error);
    });

    this.monitoredItems.set(nodeId, monitoredItem);
    logger.debug(`Started monitoring node '${nodeId}' on connector '${this.id}'`);
  }

  handleNodeValueChange(nodeId, dataValue) {
    try {
      const data = {
        nodeId: nodeId,
        value: dataValue.value.value,
        dataType: dataValue.value.dataType,
        statusCode: dataValue.statusCode.value,
        timestamp: dataValue.sourceTimestamp || dataValue.serverTimestamp || new Date(),
        quality: {
          good: dataValue.statusCode.isGood(),
          bad: dataValue.statusCode.isBad(),
          uncertain: dataValue.statusCode.isUncertain()
        }
      };

      this.onData(data);
      
    } catch (error) {
      logger.error(`Error handling node value change for '${nodeId}' on connector '${this.id}':`, error);
    }
  }

  getSecurityMode(mode) {
    switch (mode?.toLowerCase()) {
      case 'none':
        return MessageSecurityMode.None;
      case 'sign':
        return MessageSecurityMode.Sign;
      case 'signandencrypt':
        return MessageSecurityMode.SignAndEncrypt;
      default:
        return MessageSecurityMode.None;
    }
  }

  getSecurityPolicy(policy) {
    switch (policy?.toLowerCase()) {
      case 'none':
        return SecurityPolicy.None;
      case 'basic128':
        return SecurityPolicy.Basic128;
      case 'basic128rsa15':
        return SecurityPolicy.Basic128Rsa15;
      case 'basic256':
        return SecurityPolicy.Basic256;
      case 'basic256sha256':
        return SecurityPolicy.Basic256Sha256;
      case 'aes128_sha256_rsaoaep':
        return SecurityPolicy.Aes128_Sha256_RsaOaep;
      case 'aes256_sha256_rsapss':
        return SecurityPolicy.Aes256_Sha256_RsaPss;
      default:
        return SecurityPolicy.None;
    }
  }

  async readNode(nodeId) {
    if (!this.session) {
      throw new Error('OPC UA session not available');
    }

    try {
      const dataValue = await this.session.read({
        nodeId: nodeId,
        attributeId: AttributeIds.Value
      });

      return {
        nodeId: nodeId,
        value: dataValue.value.value,
        dataType: dataValue.value.dataType,
        statusCode: dataValue.statusCode.value,
        timestamp: dataValue.sourceTimestamp || dataValue.serverTimestamp || new Date(),
        quality: {
          good: dataValue.statusCode.isGood(),
          bad: dataValue.statusCode.isBad(),
          uncertain: dataValue.statusCode.isUncertain()
        }
      };
    } catch (error) {
      logger.error(`Failed to read node '${nodeId}' on connector '${this.id}':`, error);
      throw error;
    }
  }

  async writeNode(nodeId, value, dataType) {
    if (!this.session) {
      throw new Error('OPC UA session not available');
    }

    try {
      const statusCode = await this.session.write({
        nodeId: nodeId,
        attributeId: AttributeIds.Value,
        value: {
          value: value,
          dataType: dataType
        }
      });

      logger.debug(`Wrote value to node '${nodeId}' on connector '${this.id}', status: ${statusCode.toString()}`);
      return statusCode.isGood();
      
    } catch (error) {
      logger.error(`Failed to write to node '${nodeId}' on connector '${this.id}':`, error);
      throw error;
    }
  }

  getStatus() {
    return {
      ...super.getStatus(),
      sessionActive: this.session !== null,
      subscriptionActive: this.subscription !== null,
      monitoredNodesCount: this.monitoredItems.size,
      endpoint: this.config.config.endpoint
    };
  }
}

module.exports = OpcUaConnector;
