const mqtt = require('mqtt');
const logger = require('../utils/logger');
const EventEmitter = require('events');

/**
 * MqttTransport - MQTT transport layer for publishing data
 * 
 * Pubblica i dati in formato JSON o TOON su topic MQTT
 */
class MqttTransport extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = config;
    this.broker = config.broker || process.env.MQTT_BROKER || 'mqtt://localhost:1883';
    this.clientId = config.clientId || `udc-${Date.now()}`;
    this.baseTopic = config.baseTopic || 'udc/data';
    this.qos = config.qos || 1;
    this.retain = config.retain || false;
    this.format = config.format || 'json'; // 'json' or 'toon'
    
    this.client = null;
    this.connected = false;
    this.connectionStats = {
      messagesPublished: 0,
      errors: 0,
      lastPublish: null,
      lastError: null
    };

    this.auth = {
      username: config.username || process.env.MQTT_USERNAME,
      password: config.password || process.env.MQTT_PASSWORD
    };
  }

  /**
   * Initialize MQTT transport
   */
  async initialize() {
    logger.info('MQTT Transport initialized (not connected yet)');
  }

  /**
   * Connect to MQTT broker
   */
  async connect() {
    return new Promise((resolve, reject) => {
      try {
        logger.info(`Connecting to MQTT broker at ${this.broker}...`);

        const options = {
          clientId: this.clientId,
          clean: true,
          reconnectPeriod: 5000,
          connectTimeout: 30000
        };

        // Add authentication if provided
        if (this.auth.username) {
          options.username = this.auth.username;
          options.password = this.auth.password;
        }

        this.client = mqtt.connect(this.broker, options);

        this.client.on('connect', () => {
          this.connected = true;
          logger.info(`MQTT Connected to ${this.broker}`);
          this.emit('connected');
          resolve();
        });

        this.client.on('error', (error) => {
          this.connectionStats.errors++;
          this.connectionStats.lastError = error;
          logger.error('MQTT Connection error:', error);
          this.emit('error', error);
          
          if (!this.connected) {
            reject(error);
          }
        });

        this.client.on('reconnect', () => {
          logger.info('MQTT Reconnecting...');
          this.emit('reconnecting');
        });

        this.client.on('close', () => {
          this.connected = false;
          logger.warn('MQTT Connection closed');
          this.emit('disconnected');
        });

        this.client.on('offline', () => {
          this.connected = false;
          logger.warn('MQTT Client offline');
          this.emit('offline');
        });

      } catch (error) {
        logger.error('Failed to connect to MQTT broker:', error);
        reject(error);
      }
    });
  }

  /**
   * Publish device data to MQTT
   * @param {Object} deviceData - Device data in unified format
   * @param {Object} options - Publish options
   */
  async publish(deviceData, options = {}) {
    if (!this.isConnected()) {
      throw new Error('MQTT not connected');
    }

    try {
      const topic = options.topic || this.buildTopic(deviceData);
      const payload = this.formatPayload(deviceData, options.format);
      const qos = options.qos !== undefined ? options.qos : this.qos;
      const retain = options.retain !== undefined ? options.retain : this.retain;

      return new Promise((resolve, reject) => {
        this.client.publish(topic, payload, { qos, retain }, (error) => {
          if (error) {
            this.connectionStats.errors++;
            this.connectionStats.lastError = error;
            logger.error(`Failed to publish to ${topic}:`, error);
            reject(error);
          } else {
            this.connectionStats.messagesPublished++;
            this.connectionStats.lastPublish = new Date().toISOString();
            logger.debug(`Published to ${topic}: ${payload.length} bytes`);
            resolve(true);
          }
        });
      });

    } catch (error) {
      this.connectionStats.errors++;
      this.connectionStats.lastError = error;
      logger.error('Error publishing to MQTT:', error);
      throw error;
    }
  }

  /**
   * Publish multiple devices (batch)
   * @param {Array} devices - Array of device data
   * @param {Object} options - Publish options
   */
  async publishBatch(devices, options = {}) {
    if (!this.isConnected()) {
      throw new Error('MQTT not connected');
    }

    const results = [];
    for (const device of devices) {
      try {
        await this.publish(device, options);
        results.push({ success: true, deviceId: device.id });
      } catch (error) {
        results.push({ success: false, deviceId: device.id, error: error.message });
      }
    }

    return results;
  }

  /**
   * Build MQTT topic from device data
   * @param {Object} deviceData - Device data
   * @returns {string} MQTT topic
   */
  buildTopic(deviceData) {
    // Format: baseTopic/deviceType/deviceId
    return `${this.baseTopic}/${deviceData.type}/${deviceData.id}`;
  }

  /**
   * Format payload according to specified format
   * @param {Object} deviceData - Device data
   * @param {string} format - Format type ('json' or 'toon')
   * @returns {string} Formatted payload
   */
  formatPayload(deviceData, format) {
    const outputFormat = format || this.format;

    if (outputFormat === 'toon') {
      // TOON format (compatto)
      const toon = {
        i: deviceData.id,
        t: deviceData.type,
        ts: deviceData.metadata.timestamp,
        m: deviceData.measurements.map(m => ({
          i: m.id,
          t: m.type,
          v: m.value
        })),
        meta: this.filterMetadata(deviceData.metadata)
      };
      return JSON.stringify(toon);
    } else {
      // Standard JSON format
      return JSON.stringify(deviceData);
    }
  }

  /**
   * Filter metadata (exclude timestamp)
   * @private
   */
  filterMetadata(metadata) {
    const filtered = { ...metadata };
    delete filtered.timestamp;
    return filtered;
  }

  /**
   * Check if connected
   * @returns {boolean} Connection status
   */
  isConnected() {
    return this.connected && this.client && this.client.connected;
  }

  /**
   * Subscribe to topic (for bidirectional communication)
   * @param {string} topic - Topic to subscribe
   * @param {Function} callback - Message callback
   */
  subscribe(topic, callback) {
    if (!this.isConnected()) {
      throw new Error('MQTT not connected');
    }

    this.client.subscribe(topic, (error) => {
      if (error) {
        logger.error(`Failed to subscribe to ${topic}:`, error);
        throw error;
      }
      logger.info(`Subscribed to MQTT topic: ${topic}`);
    });

    this.client.on('message', (receivedTopic, message) => {
      if (receivedTopic === topic || this.topicMatches(topic, receivedTopic)) {
        try {
          const data = JSON.parse(message.toString());
          callback(data, receivedTopic);
        } catch (error) {
          logger.error('Error parsing MQTT message:', error);
        }
      }
    });
  }

  /**
   * Check if topic matches pattern (supports wildcards)
   * @private
   */
  topicMatches(pattern, topic) {
    const patternParts = pattern.split('/');
    const topicParts = topic.split('/');

    if (patternParts.length !== topicParts.length && !pattern.includes('#')) {
      return false;
    }

    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i] === '#') return true;
      if (patternParts[i] === '+') continue;
      if (patternParts[i] !== topicParts[i]) return false;
    }

    return true;
  }

  /**
   * Get connection statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      connected: this.connected,
      broker: this.broker,
      clientId: this.clientId,
      ...this.connectionStats
    };
  }

  /**
   * Close connection
   */
  async close() {
    if (this.client) {
      return new Promise((resolve) => {
        this.client.end(false, () => {
          this.connected = false;
          logger.info('MQTT Transport closed');
          resolve();
        });
      });
    }
  }
}

module.exports = MqttTransport;
