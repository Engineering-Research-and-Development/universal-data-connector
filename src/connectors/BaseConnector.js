const EventEmitter = require('events');
const logger = require('../utils/logger');

class BaseConnector extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.id = config.id;
    this.type = config.type;
    this.isConnected = false;
    this.isRunning = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = config.retryConfig?.maxRetries || 3;
    this.reconnectDelay = config.retryConfig?.retryDelay || 5000;
    this.reconnectTimer = null;
  }

  async initialize() {
    logger.debug(`Initializing ${this.type} connector '${this.id}'`);
    // Base initialization - override in subclasses
  }

  async start() {
    if (this.isRunning) {
      logger.warn(`Connector '${this.id}' is already running`);
      return;
    }

    logger.info(`Starting ${this.type} connector '${this.id}'`);
    this.isRunning = true;
    
    try {
      await this.connect();
    } catch (error) {
      this.isRunning = false;
      throw error;
    }
  }

  async stop() {
    if (!this.isRunning) {
      logger.warn(`Connector '${this.id}' is not running`);
      return;
    }

    logger.info(`Stopping ${this.type} connector '${this.id}'`);
    this.isRunning = false;
    
    // Clear reconnection timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    await this.disconnect();
  }

  async connect() {
    // Override in subclasses
    throw new Error('connect() method must be implemented by subclass');
  }

  async disconnect() {
    // Override in subclasses
    throw new Error('disconnect() method must be implemented by subclass');
  }

  onConnected() {
    this.isConnected = true;
    this.reconnectAttempts = 0;
    logger.info(`Connector '${this.id}' connected successfully`);
    this.emit('connected');
  }

  onDisconnected() {
    this.isConnected = false;
    logger.warn(`Connector '${this.id}' disconnected`);
    this.emit('disconnected');
    
    // Attempt reconnection if still running
    if (this.isRunning && this.config.retryConfig?.enabled !== false) {
      this.scheduleReconnect();
    }
  }

  onError(error) {
    logger.error(`Connector '${this.id}' error:`, error);
    this.emit('error', error);
    
    // Trigger disconnection handling if connected
    if (this.isConnected) {
      this.onDisconnected();
    }
  }

  onData(data) {
    if (!this.isRunning) {
      return;
    }

    logger.debug(`Connector '${this.id}' received data`, {
      dataSize: JSON.stringify(data).length
    });
    
    this.emit('data', data);
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error(`Connector '${this.id}' exceeded maximum reconnection attempts (${this.maxReconnectAttempts})`);
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff
    
    logger.info(`Connector '${this.id}' scheduling reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    this.reconnectTimer = setTimeout(async () => {
      if (this.isRunning) {
        try {
          this.emit('reconnecting');
          await this.connect();
        } catch (error) {
          logger.error(`Connector '${this.id}' reconnection attempt ${this.reconnectAttempts} failed:`, error);
          this.scheduleReconnect();
        }
      }
    }, delay);
  }

  getStatus() {
    return {
      id: this.id,
      type: this.type,
      isConnected: this.isConnected,
      isRunning: this.isRunning,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts
    };
  }

  validateConfig() {
    if (!this.config.id) {
      throw new Error('Connector configuration must include an id');
    }
    if (!this.config.type) {
      throw new Error('Connector configuration must include a type');
    }
    if (!this.config.config) {
      throw new Error('Connector configuration must include a config object');
    }
  }
}

module.exports = BaseConnector;
