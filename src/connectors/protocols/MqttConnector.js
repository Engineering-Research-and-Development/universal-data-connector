const mqtt = require('mqtt');
const BaseConnector = require('../BaseConnector');
const logger = require('../../utils/logger');

class MqttConnector extends BaseConnector {
  constructor(config) {
    super(config);
    this.client = null;
    this.subscribedTopics = new Set();
    
    this.validateConfig();
  }

  validateConfig() {
    super.validateConfig();
    
    const { config } = this.config;
    if (!config.broker) {
      throw new Error('MQTT connector requires a broker URL');
    }
    if (!config.topics || !Array.isArray(config.topics) || config.topics.length === 0) {
      throw new Error('MQTT connector requires at least one topic to subscribe to');
    }
  }

  async initialize() {
    await super.initialize();
    logger.debug(`Initialized MQTT connector for broker: ${this.config.config.broker}`);
  }

  async connect() {
    try {
      const { config } = this.config;
      
      logger.info(`Connecting to MQTT broker: ${config.broker}`);
      
      // Prepare connection options
      const options = {
        clientId: config.clientId || `udc_${this.id}_${Date.now()}`,
        keepalive: 60,
        connectTimeout: 30000,
        reconnectPeriod: 1000,
        clean: true,
        ...config.options
      };

      // Add authentication if provided
      if (config.username) {
        options.username = config.username;
      }
      if (config.password) {
        options.password = config.password;
      }

      // Create MQTT client
      this.client = mqtt.connect(config.broker, options);

      // Setup event handlers
      this.setupEventHandlers();
      
      // Wait for connection
      await this.waitForConnection();
      
      // Subscribe to topics
      await this.subscribeToTopics();
      
    } catch (error) {
      logger.error(`Failed to connect MQTT connector '${this.id}':`, error);
      await this.cleanup();
      throw error;
    }
  }

  async disconnect() {
    await this.cleanup();
  }

  async cleanup() {
    try {
      if (this.client) {
        // Unsubscribe from all topics
        if (this.subscribedTopics.size > 0) {
          const topics = Array.from(this.subscribedTopics);
          await new Promise((resolve, reject) => {
            this.client.unsubscribe(topics, (error) => {
              if (error) {
                logger.debug(`Error unsubscribing from topics:`, error);
              }
              resolve();
            });
          });
          this.subscribedTopics.clear();
        }

        // End client connection
        await new Promise((resolve) => {
          this.client.end(false, {}, resolve);
        });
        
        this.client = null;
      }

      logger.debug(`MQTT connector '${this.id}' cleanup completed`);
      
    } catch (error) {
      logger.error(`Error during MQTT connector '${this.id}' cleanup:`, error);
    }
  }

  setupEventHandlers() {
    this.client.on('connect', () => {
      logger.info(`MQTT client '${this.id}' connected to broker`);
      this.onConnected();
    });

    this.client.on('disconnect', () => {
      logger.warn(`MQTT client '${this.id}' disconnected from broker`);
      this.onDisconnected();
    });

    this.client.on('offline', () => {
      logger.warn(`MQTT client '${this.id}' went offline`);
      this.onDisconnected();
    });

    this.client.on('error', (error) => {
      logger.error(`MQTT client '${this.id}' error:`, error);
      this.onError(error);
    });

    this.client.on('reconnect', () => {
      logger.info(`MQTT client '${this.id}' attempting to reconnect`);
      this.emit('reconnecting');
    });

    this.client.on('message', (topic, message, packet) => {
      this.handleMessage(topic, message, packet);
    });

    this.client.on('packetsend', (packet) => {
      logger.debug(`MQTT client '${this.id}' sent packet`, { type: packet.cmd });
    });

    this.client.on('packetreceive', (packet) => {
      logger.debug(`MQTT client '${this.id}' received packet`, { type: packet.cmd });
    });
  }

  async waitForConnection() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('MQTT connection timeout'));
      }, 30000);

      this.client.once('connect', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.client.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  async subscribeToTopics() {
    const { config } = this.config;
    const qos = config.qos || 1;

    for (const topic of config.topics) {
      try {
        await this.subscribeToTopic(topic, qos);
      } catch (error) {
        logger.error(`Failed to subscribe to topic '${topic}' on connector '${this.id}':`, error);
        // Continue with other topics
      }
    }
  }

  async subscribeToTopic(topic, qos = 1) {
    return new Promise((resolve, reject) => {
      this.client.subscribe(topic, { qos }, (error, granted) => {
        if (error) {
          reject(error);
        } else {
          this.subscribedTopics.add(topic);
          logger.info(`MQTT connector '${this.id}' subscribed to topic '${topic}' with QoS ${granted[0].qos}`);
          resolve(granted);
        }
      });
    });
  }

  handleMessage(topic, message, packet) {
    try {
      let parsedMessage;
      const messageStr = message.toString();

      // Try to parse as JSON, fallback to string
      try {
        parsedMessage = JSON.parse(messageStr);
      } catch (parseError) {
        parsedMessage = messageStr;
      }

      const data = {
        topic: topic,
        message: parsedMessage,
        qos: packet.qos,
        retain: packet.retain,
        dup: packet.dup,
        messageId: packet.messageId,
        timestamp: new Date().toISOString(),
        raw: messageStr
      };

      this.onData(data);
      
    } catch (error) {
      logger.error(`Error handling MQTT message on topic '${topic}' for connector '${this.id}':`, error);
    }
  }

  async publish(topic, message, options = {}) {
    if (!this.client || !this.isConnected) {
      throw new Error('MQTT client not connected');
    }

    try {
      const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
      
      return new Promise((resolve, reject) => {
        this.client.publish(topic, messageStr, options, (error) => {
          if (error) {
            reject(error);
          } else {
            logger.debug(`MQTT connector '${this.id}' published message to topic '${topic}'`);
            resolve();
          }
        });
      });
      
    } catch (error) {
      logger.error(`Failed to publish message to topic '${topic}' on connector '${this.id}':`, error);
      throw error;
    }
  }

  async addSubscription(topic, qos = 1) {
    if (!this.client || !this.isConnected) {
      throw new Error('MQTT client not connected');
    }

    if (this.subscribedTopics.has(topic)) {
      logger.warn(`Already subscribed to topic '${topic}' on connector '${this.id}'`);
      return;
    }

    await this.subscribeToTopic(topic, qos);
  }

  async removeSubscription(topic) {
    if (!this.client || !this.isConnected) {
      throw new Error('MQTT client not connected');
    }

    if (!this.subscribedTopics.has(topic)) {
      logger.warn(`Not subscribed to topic '${topic}' on connector '${this.id}'`);
      return;
    }

    return new Promise((resolve, reject) => {
      this.client.unsubscribe(topic, (error) => {
        if (error) {
          reject(error);
        } else {
          this.subscribedTopics.delete(topic);
          logger.info(`MQTT connector '${this.id}' unsubscribed from topic '${topic}'`);
          resolve();
        }
      });
    });
  }

  getStatus() {
    return {
      ...super.getStatus(),
      broker: this.config.config.broker,
      clientId: this.client?.options?.clientId,
      subscribedTopics: Array.from(this.subscribedTopics),
      subscriptionCount: this.subscribedTopics.size
    };
  }

  getSubscribedTopics() {
    return Array.from(this.subscribedTopics);
  }
}

module.exports = MqttConnector;
