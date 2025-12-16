const SerialPort = require('serialport');
const BaseConnector = require('../BaseConnector');
const logger = require('../../utils/logger');

/**
 * SerialConnector - Generic Serial/RS232/RS485 communication
 * Supports various industrial serial protocols and custom protocols
 * Useful for legacy devices, sensors, and instruments
 */
class SerialConnector extends BaseConnector {
  constructor(config) {
    super(config);
    this.port = null;
    this.pollingTimer = null;
    this.buffer = Buffer.alloc(0);
    
    this.validateConfig();
  }

  validateConfig() {
    super.validateConfig();
    
    const { config } = this.config;
    if (!config.portName) {
      throw new Error('Serial connector requires portName (e.g., COM3 or /dev/ttyUSB0)');
    }
    
    if (!config.baudRate) {
      throw new Error('Serial connector requires baudRate');
    }
  }

  async initialize() {
    await super.initialize();
    
    const { config } = this.config;
    
    // Serial port options
    this.portOptions = {
      path: config.portName,
      baudRate: config.baudRate,
      dataBits: config.dataBits || 8,
      stopBits: config.stopBits || 1,
      parity: config.parity || 'none',
      flowControl: config.flowControl || false,
      autoOpen: false
    };
    
    logger.debug(`Initialized Serial connector for port: ${config.portName} @ ${config.baudRate} baud`);
  }

  async connect() {
    const { config } = this.config;
    
    return new Promise((resolve, reject) => {
      try {
        // Create serial port instance
        this.port = new SerialPort(this.portOptions);
        
        this.port.on('open', () => {
          logger.info(`Serial connector '${this.id}' opened port ${config.portName}`);
          this.onConnected();
          this.startPolling();
          resolve();
        });
        
        this.port.on('data', (data) => {
          this.handleData(data);
        });
        
        this.port.on('error', (error) => {
          logger.error(`Serial connector '${this.id}' port error:`, error);
          this.onError(error);
        });
        
        this.port.on('close', () => {
          logger.warn(`Serial connector '${this.id}' port closed`);
          this.onDisconnected();
        });
        
        // Open the port
        this.port.open((err) => {
          if (err) {
            logger.error(`Serial connector '${this.id}' failed to open:`, err);
            reject(err);
          }
        });
        
      } catch (error) {
        logger.error(`Serial connector '${this.id}' connection failed:`, error);
        this.onError(error);
        reject(error);
      }
    });
  }

  async disconnect() {
    this.stopPolling();
    
    if (this.port && this.port.isOpen) {
      return new Promise((resolve) => {
        this.port.close((err) => {
          if (err) {
            logger.error(`Error closing serial port '${this.id}':`, err);
          } else {
            logger.info(`Serial connector '${this.id}' disconnected`);
          }
          this.port = null;
          this.isConnected = false;
          resolve();
        });
      });
    } else {
      this.isConnected = false;
    }
  }

  startPolling() {
    const { config } = this.config;
    
    if (config.mode === 'passive') {
      // Passive mode: just listen for incoming data
      logger.debug(`Serial connector '${this.id}' in passive mode (listening)`);
      return;
    }
    
    // Active mode: poll device
    const interval = config.pollingInterval || 1000;
    
    this.pollingTimer = setInterval(async () => {
      if (this.isConnected && this.isRunning) {
        await this.sendQuery();
      }
    }, interval);
    
    logger.debug(`Serial connector '${this.id}' started polling (interval: ${interval}ms)`);
  }

  stopPolling() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
      logger.debug(`Serial connector '${this.id}' stopped polling`);
    }
  }

  async sendQuery() {
    const { config } = this.config;
    
    if (!config.queryCommand) {
      return;
    }
    
    try {
      const command = this.buildCommand(config.queryCommand);
      await this.write(command);
      
    } catch (error) {
      logger.error(`Serial connector '${this.id}' query error:`, error);
      this.onError(error);
    }
  }

  buildCommand(commandConfig) {
    // Support different command formats
    if (typeof commandConfig === 'string') {
      // String command
      return Buffer.from(commandConfig, commandConfig.encoding || 'ascii');
    } else if (Array.isArray(commandConfig)) {
      // Byte array
      return Buffer.from(commandConfig);
    } else if (commandConfig.hex) {
      // Hex string
      return Buffer.from(commandConfig.hex, 'hex');
    } else if (commandConfig.ascii) {
      // ASCII string
      return Buffer.from(commandConfig.ascii, 'ascii');
    }
    
    return Buffer.from(commandConfig);
  }

  async write(data) {
    if (!this.port || !this.port.isOpen) {
      throw new Error('Serial port is not open');
    }
    
    return new Promise((resolve, reject) => {
      this.port.write(data, (err) => {
        if (err) {
          reject(err);
        } else {
          logger.debug(`Serial connector '${this.id}' sent ${data.length} bytes`);
          resolve();
        }
      });
    });
  }

  handleData(data) {
    const { config } = this.config;
    
    // Append to buffer
    this.buffer = Buffer.concat([this.buffer, data]);
    
    // Parse based on terminator or fixed length
    if (config.terminator) {
      this.parseWithTerminator(config.terminator);
    } else if (config.messageLength) {
      this.parseFixedLength(config.messageLength);
    } else {
      // No parsing, emit raw data
      this.emitData(this.buffer);
      this.buffer = Buffer.alloc(0);
    }
  }

  parseWithTerminator(terminator) {
    const terminatorBuffer = Buffer.from(terminator, 'hex');
    
    while (true) {
      const index = this.buffer.indexOf(terminatorBuffer);
      if (index === -1) {
        break; // No complete message
      }
      
      // Extract message
      const message = this.buffer.slice(0, index);
      this.buffer = this.buffer.slice(index + terminatorBuffer.length);
      
      this.emitData(message);
    }
  }

  parseFixedLength(length) {
    while (this.buffer.length >= length) {
      const message = this.buffer.slice(0, length);
      this.buffer = this.buffer.slice(length);
      
      this.emitData(message);
    }
  }

  emitData(buffer) {
    const { config } = this.config;
    
    const data = {
      timestamp: new Date().toISOString(),
      source: this.id,
      type: this.type,
      raw: buffer.toString('hex'),
      parsed: this.parseData(buffer, config)
    };
    
    this.onData(data);
  }

  parseData(buffer, config) {
    if (!config.parser) {
      // No parser, return hex string
      return buffer.toString('hex');
    }
    
    switch (config.parser.type) {
      case 'ascii':
        return buffer.toString('ascii');
      case 'utf8':
        return buffer.toString('utf8');
      case 'json':
        try {
          return JSON.parse(buffer.toString('utf8'));
        } catch (e) {
          return buffer.toString('utf8');
        }
      case 'custom':
        // Custom parser function would go here
        return buffer.toString('hex');
      default:
        return buffer.toString('hex');
    }
  }

  async sendCommand(command) {
    if (!this.isConnected) {
      throw new Error('Serial connector is not connected');
    }
    
    try {
      const buffer = this.buildCommand(command);
      await this.write(buffer);
      
      logger.info(`Serial connector '${this.id}' sent command: ${buffer.toString('hex')}`);
      return true;
      
    } catch (error) {
      logger.error(`Serial connector '${this.id}' send error:`, error);
      throw error;
    }
  }

  getStatus() {
    return {
      ...super.getStatus(),
      portName: this.config.config.portName,
      baudRate: this.config.config.baudRate,
      dataBits: this.config.config.dataBits || 8,
      stopBits: this.config.config.stopBits || 1,
      parity: this.config.config.parity || 'none',
      isOpen: this.port ? this.port.isOpen : false
    };
  }
}

module.exports = SerialConnector;
