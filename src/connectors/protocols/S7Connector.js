const nodes7 = require('nodes7');
const BaseConnector = require('./BaseConnector');
const logger = require('../utils/logger');

/**
 * S7Connector - Siemens S7 PLC connector (S7-300, S7-400, S7-1200, S7-1500)
 * Uses nodes7 library for S7 protocol communication
 */
class S7Connector extends BaseConnector {
  constructor(config) {
    super(config);
    this.conn = null;
    this.pollingTimer = null;
    this.variables = {};
    
    this.validateConfig();
  }

  validateConfig() {
    super.validateConfig();
    
    const { config } = this.config;
    if (!config.host) {
      throw new Error('S7 connector requires host (PLC IP address)');
    }
    
    if (!config.variables || typeof config.variables !== 'object' || Object.keys(config.variables).length === 0) {
      throw new Error('S7 connector requires variables object with at least one variable definition');
    }
  }

  async initialize() {
    await super.initialize();
    
    this.conn = new nodes7();
    
    const { config } = this.config;
    
    // Set connection parameters
    this.conn.initiateConnection({
      port: config.port || 102,
      host: config.host,
      rack: config.rack || 0,
      slot: config.slot || 2,
      timeout: config.timeout || 5000
    }, (err) => {
      if (err) {
        logger.error(`S7 connector '${this.id}' initialization error:`, err);
      }
    });
    
    logger.debug(`Initialized S7 connector for PLC: ${config.host}`);
  }

  async connect() {
    const { config } = this.config;
    
    return new Promise((resolve, reject) => {
      this.conn.initiateConnection({
        port: config.port || 102,
        host: config.host,
        rack: config.rack || 0,
        slot: config.slot || 2,
        timeout: config.timeout || 5000
      }, (err) => {
        if (err) {
          logger.error(`S7 connector '${this.id}' connection failed:`, err);
          this.onError(err);
          reject(err);
          return;
        }
        
        // Add variables to read list
        this.conn.addItems(Object.keys(config.variables));
        this.conn.setTranslationCB((tag) => config.variables[tag]);
        
        logger.info(`S7 connector '${this.id}' connected to PLC ${config.host} (Rack: ${config.rack}, Slot: ${config.slot})`);
        
        this.onConnected();
        this.startPolling();
        resolve();
      });
    });
  }

  async disconnect() {
    this.stopPolling();
    
    if (this.conn) {
      try {
        this.conn.dropConnection(() => {
          logger.info(`S7 connector '${this.id}' disconnected`);
        });
      } catch (error) {
        logger.error(`Error disconnecting S7 connector '${this.id}':`, error);
      }
    }
    
    this.isConnected = false;
  }

  startPolling() {
    const { config } = this.config;
    const interval = config.pollingInterval || 1000;
    
    this.pollingTimer = setInterval(async () => {
      if (this.isConnected && this.isRunning) {
        await this.readVariables();
      }
    }, interval);
    
    logger.debug(`S7 connector '${this.id}' started polling (interval: ${interval}ms)`);
  }

  stopPolling() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
      logger.debug(`S7 connector '${this.id}' stopped polling`);
    }
  }

  async readVariables() {
    return new Promise((resolve) => {
      this.conn.readAllItems((err, values) => {
        if (err) {
          logger.error(`S7 connector '${this.id}' read error:`, err);
          this.onError(err);
          resolve();
          return;
        }
        
        const data = {
          timestamp: new Date().toISOString(),
          source: this.id,
          type: this.type,
          variables: values
        };
        
        this.variables = values;
        this.onData(data);
        resolve();
      });
    });
  }

  async writeVariable(variableName, value) {
    if (!this.isConnected) {
      throw new Error('S7 connector is not connected');
    }
    
    const { config } = this.config;
    
    if (!config.variables[variableName]) {
      throw new Error(`Variable '${variableName}' not found in configuration`);
    }
    
    return new Promise((resolve, reject) => {
      this.conn.writeItems(variableName, value, (err) => {
        if (err) {
          logger.error(`S7 connector '${this.id}' write error:`, err);
          reject(err);
          return;
        }
        
        logger.info(`S7 connector '${this.id}' wrote value ${value} to variable '${variableName}'`);
        resolve();
      });
    });
  }

  async readVariable(variableName) {
    if (!this.isConnected) {
      throw new Error('S7 connector is not connected');
    }
    
    const { config } = this.config;
    
    if (!config.variables[variableName]) {
      throw new Error(`Variable '${variableName}' not found in configuration`);
    }
    
    return new Promise((resolve, reject) => {
      this.conn.readItems(variableName, (err, values) => {
        if (err) {
          logger.error(`S7 connector '${this.id}' read error:`, err);
          reject(err);
          return;
        }
        
        resolve(values[variableName]);
      });
    });
  }

  getStatus() {
    return {
      ...super.getStatus(),
      host: this.config.config.host,
      port: this.config.config.port || 102,
      rack: this.config.config.rack || 0,
      slot: this.config.config.slot || 2,
      variableCount: Object.keys(this.config.config.variables).length,
      variables: Object.keys(this.config.config.variables)
    };
  }
}

module.exports = S7Connector;
