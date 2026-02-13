const axios = require('axios');
const logger = require('../utils/logger');
const EventEmitter = require('events');

/**
 * HttpPushTransport - HTTP Push transport layer
 * 
 * Invia i dati in formato JSON o TOON tramite HTTP POST/PUT
 */
class HttpPushTransport extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = config;
    this.endpoint = config.endpoint || process.env.HTTP_PUSH_ENDPOINT;
    this.method = (config.method || 'POST').toUpperCase();
    this.format = config.format || 'json'; // 'json' or 'toon'
    this.batchSize = config.batchSize || 1; // Number of devices per request
    this.timeout = config.timeout || 30000;
    
    this.headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'Universal-Data-Connector/2.0',
      ...config.headers
    };

    // Authentication
    this.auth = config.auth || null; // { username, password } or { bearer: 'token' }

    this.connectionStats = {
      requestsSent: 0,
      requestsFailed: 0,
      bytesTransferred: 0,
      lastRequest: null,
      lastError: null
    };

    // Buffer per batch
    this.buffer = [];
    this.flushInterval = config.flushInterval || 5000; // Flush ogni 5 secondi
    this.flushTimer = null;
  }

  /**
   * Initialize HTTP Push transport
   */
  async initialize() {
    if (!this.endpoint) {
      throw new Error('HTTP Push endpoint not configured');
    }

    logger.info(`HTTP Push Transport initialized: ${this.method} ${this.endpoint}`);
    
    // Start auto-flush timer for batching
    if (this.batchSize > 1) {
      this.startAutoFlush();
    }
  }

  /**
   * Connect (HTTP doesn't need persistent connection, just validate)
   */
  async connect() {
    try {
      // Test connection with a health check (if endpoint supports it)
      logger.info(`HTTP Push transport ready: ${this.endpoint}`);
      this.emit('connected');
      return true;
    } catch (error) {
      logger.error('HTTP Push transport validation failed:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Publish device data via HTTP
   * @param {Object} deviceData - Device data in unified format
   * @param {Object} options - Publish options
   */
  async publish(deviceData, options = {}) {
    if (!this.endpoint) {
      throw new Error('HTTP Push endpoint not configured');
    }

    // Se batching è abilitato, aggiungi al buffer
    if (this.batchSize > 1 && !options.immediate) {
      this.buffer.push(deviceData);
      
      if (this.buffer.length >= this.batchSize) {
        return this.flush();
      }
      
      return true;
    }

    // Invio immediato
    return this.sendData([deviceData], options);
  }

  /**
   * Publish multiple devices (batch)
   * @param {Array} devices - Array of device data
   * @param {Object} options - Publish options
   */
  async publishBatch(devices, options = {}) {
    return this.sendData(devices, options);
  }

  /**
   * Send data to HTTP endpoint
   * @param {Array} devices - Array of device data
   * @param {Object} options - Options
   * @private
   */
  async sendData(devices, options = {}) {
    try {
      const payload = this.formatPayload(devices, options.format);
      const endpoint = options.endpoint || this.endpoint;

      const config = {
        method: this.method,
        url: endpoint,
        data: payload,
        headers: { ...this.headers, ...options.headers },
        timeout: this.timeout
      };

      // Add authentication
      if (this.auth) {
        if (this.auth.bearer) {
          config.headers['Authorization'] = `Bearer ${this.auth.bearer}`;
        } else if (this.auth.username && this.auth.password) {
          config.auth = {
            username: this.auth.username,
            password: this.auth.password
          };
        }
      }

      const response = await axios(config);

      // Update statistics
      this.connectionStats.requestsSent++;
      this.connectionStats.bytesTransferred += JSON.stringify(payload).length;
      this.connectionStats.lastRequest = new Date().toISOString();

      logger.debug(`HTTP Push sent ${devices.length} device(s) to ${endpoint}: ${response.status}`);

      this.emit('published', {
        devices: devices.length,
        status: response.status,
        endpoint
      });

      return {
        success: true,
        status: response.status,
        data: response.data,
        devices: devices.length
      };

    } catch (error) {
      this.connectionStats.requestsFailed++;
      this.connectionStats.lastError = {
        message: error.message,
        timestamp: new Date().toISOString()
      };

      logger.error('HTTP Push failed:', error.message);
      
      this.emit('error', error);

      throw error;
    }
  }

  /**
   * Format payload according to specified format
   * @param {Array} devices - Device data array
   * @param {string} format - Format type ('json' or 'toon')
   * @returns {Object|Array} Formatted payload
   */
  formatPayload(devices, format) {
    const outputFormat = format || this.format;

    if (outputFormat === 'toon') {
      // TOON format
      return {
        format: 'TOON',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        count: devices.length,
        devices: devices.map(device => ({
          i: device.id,
          t: device.type,
          ts: device.metadata.timestamp,
          m: device.measurements.map(m => ({
            i: m.id,
            t: m.type,
            v: m.value
          })),
          meta: this.filterMetadata(device.metadata)
        }))
      };
    } else {
      // Standard JSON format
      if (devices.length === 1) {
        return devices[0];
      }
      return {
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        count: devices.length,
        devices
      };
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
   * Flush buffer (send accumulated data)
   */
  async flush() {
    if (this.buffer.length === 0) {
      return null;
    }

    const devicesToSend = [...this.buffer];
    this.buffer = [];

    logger.debug(`Flushing ${devicesToSend.length} devices from buffer`);

    return this.sendData(devicesToSend, { immediate: true });
  }

  /**
   * Start auto-flush timer
   * @private
   */
  startAutoFlush() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(async () => {
      try {
        await this.flush();
      } catch (error) {
        logger.error('Auto-flush error:', error);
      }
    }, this.flushInterval);

    logger.debug(`Auto-flush started: every ${this.flushInterval}ms`);
  }

  /**
   * Stop auto-flush timer
   * @private
   */
  stopAutoFlush() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Check if connected (always true for HTTP)
   * @returns {boolean} Connection status
   */
  isConnected() {
    return !!this.endpoint;
  }

  /**
   * Get connection statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      endpoint: this.endpoint,
      method: this.method,
      format: this.format,
      batchSize: this.batchSize,
      bufferSize: this.buffer.length,
      ...this.connectionStats
    };
  }

  /**
   * Close connection (cleanup)
   */
  async close() {
    this.stopAutoFlush();
    
    // Flush remaining buffer
    if (this.buffer.length > 0) {
      try {
        await this.flush();
      } catch (error) {
        logger.error('Error flushing buffer on close:', error);
      }
    }

    logger.info('HTTP Push Transport closed');
  }
}

module.exports = HttpPushTransport;
