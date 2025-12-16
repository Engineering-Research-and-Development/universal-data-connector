const ModbusRTU = require('modbus-serial');
const BaseConnector = require('../BaseConnector');
const logger = require('../../utils/logger');

/**
 * ModbusConnector - Supports Modbus TCP and RTU protocols
 * Uses modbus-serial library for communication
 */
class ModbusConnector extends BaseConnector {
  constructor(config) {
    super(config);
    this.client = null;
    this.pollingTimer = null;
    
    this.validateConfig();
  }

  validateConfig() {
    super.validateConfig();
    
    const { config } = this.config;
    if (!config.connectionType || !['tcp', 'rtu'].includes(config.connectionType.toLowerCase())) {
      throw new Error('Modbus connector requires connectionType: "tcp" or "rtu"');
    }
    
    if (config.connectionType.toLowerCase() === 'tcp') {
      if (!config.host) {
        throw new Error('Modbus TCP requires host');
      }
      if (!config.port) {
        throw new Error('Modbus TCP requires port');
      }
    } else if (config.connectionType.toLowerCase() === 'rtu') {
      if (!config.serialPort) {
        throw new Error('Modbus RTU requires serialPort (e.g., COM3 or /dev/ttyUSB0)');
      }
      if (!config.baudRate) {
        throw new Error('Modbus RTU requires baudRate');
      }
    }
    
    if (!config.registers || !Array.isArray(config.registers) || config.registers.length === 0) {
      throw new Error('Modbus connector requires registers array with at least one register definition');
    }
  }

  async initialize() {
    await super.initialize();
    
    this.client = new ModbusRTU();
    
    // Set timeouts
    const { config } = this.config;
    this.client.setTimeout(config.timeout || 5000);
    
    logger.debug(`Initialized Modbus ${config.connectionType.toUpperCase()} connector '${this.id}'`);
  }

  async connect() {
    const { config } = this.config;
    
    try {
      if (config.connectionType.toLowerCase() === 'tcp') {
        await this.client.connectTCP(config.host, { 
          port: config.port || 502 
        });
        logger.info(`Modbus TCP connector '${this.id}' connected to ${config.host}:${config.port}`);
      } else if (config.connectionType.toLowerCase() === 'rtu') {
        await this.client.connectRTUBuffered(config.serialPort, {
          baudRate: config.baudRate,
          dataBits: config.dataBits || 8,
          stopBits: config.stopBits || 1,
          parity: config.parity || 'none'
        });
        logger.info(`Modbus RTU connector '${this.id}' connected to ${config.serialPort}`);
      }
      
      // Set unit ID (slave ID)
      if (config.unitId !== undefined) {
        this.client.setID(config.unitId);
      }
      
      this.onConnected();
      this.startPolling();
      
    } catch (error) {
      logger.error(`Modbus connector '${this.id}' connection failed:`, error);
      this.onError(error);
      throw error;
    }
  }

  async disconnect() {
    this.stopPolling();
    
    if (this.client && this.client.isOpen) {
      try {
        this.client.close(() => {
          logger.info(`Modbus connector '${this.id}' disconnected`);
        });
      } catch (error) {
        logger.error(`Error closing Modbus connector '${this.id}':`, error);
      }
    }
    
    this.isConnected = false;
  }

  startPolling() {
    const { config } = this.config;
    const interval = config.pollingInterval || 1000;
    
    this.pollingTimer = setInterval(async () => {
      if (this.isConnected && this.isRunning) {
        await this.readRegisters();
      }
    }, interval);
    
    logger.debug(`Modbus connector '${this.id}' started polling (interval: ${interval}ms)`);
  }

  stopPolling() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
      logger.debug(`Modbus connector '${this.id}' stopped polling`);
    }
  }

  async readRegisters() {
    const { config } = this.config;
    const data = {
      timestamp: new Date().toISOString(),
      source: this.id,
      type: this.type,
      registers: {}
    };
    
    try {
      for (const register of config.registers) {
        const { name, address, type, count = 1, unitId } = register;
        
        // Switch unit ID if specified for this register
        if (unitId !== undefined && unitId !== this.client.getID()) {
          this.client.setID(unitId);
        }
        
        let result;
        
        switch (type.toLowerCase()) {
          case 'holding':
            result = await this.client.readHoldingRegisters(address, count);
            break;
          case 'input':
            result = await this.client.readInputRegisters(address, count);
            break;
          case 'coil':
            result = await this.client.readCoils(address, count);
            break;
          case 'discrete':
            result = await this.client.readDiscreteInputs(address, count);
            break;
          default:
            logger.warn(`Unknown register type '${type}' for register '${name}'`);
            continue;
        }
        
        // Parse the value based on data type
        data.registers[name] = this.parseValue(result.data, register);
      }
      
      this.onData(data);
      
    } catch (error) {
      logger.error(`Modbus connector '${this.id}' read error:`, error);
      this.onError(error);
    }
  }

  parseValue(buffer, register) {
    const { dataType = 'uint16', count = 1 } = register;
    
    if (count === 1) {
      switch (dataType.toLowerCase()) {
        case 'uint16':
          return buffer[0];
        case 'int16':
          return buffer[0] > 32767 ? buffer[0] - 65536 : buffer[0];
        case 'bool':
          return buffer[0] !== 0;
        case 'uint32':
          return (buffer[0] << 16) | buffer[1];
        case 'int32':
          const val = (buffer[0] << 16) | buffer[1];
          return val > 2147483647 ? val - 4294967296 : val;
        case 'float':
          const floatBuffer = Buffer.allocUnsafe(4);
          floatBuffer.writeUInt16BE(buffer[0], 0);
          floatBuffer.writeUInt16BE(buffer[1], 2);
          return floatBuffer.readFloatBE(0);
        default:
          return buffer[0];
      }
    } else {
      return buffer;
    }
  }

  async writeRegister(address, value, type = 'holding', unitId) {
    if (!this.isConnected) {
      throw new Error('Modbus connector is not connected');
    }
    
    try {
      // Switch unit ID if specified
      if (unitId !== undefined) {
        this.client.setID(unitId);
      }
      
      let result;
      
      switch (type.toLowerCase()) {
        case 'holding':
          result = await this.client.writeRegister(address, value);
          break;
        case 'coil':
          result = await this.client.writeCoil(address, value);
          break;
        default:
          throw new Error(`Cannot write to register type '${type}'`);
      }
      
      logger.info(`Modbus connector '${this.id}' wrote value ${value} to ${type} register ${address}`);
      return result;
      
    } catch (error) {
      logger.error(`Modbus connector '${this.id}' write error:`, error);
      throw error;
    }
  }

  getStatus() {
    return {
      ...super.getStatus(),
      connectionType: this.config.config.connectionType,
      host: this.config.config.host,
      port: this.config.config.port,
      serialPort: this.config.config.serialPort,
      unitId: this.client ? this.client.getID() : null
    };
  }
}

module.exports = ModbusConnector;
