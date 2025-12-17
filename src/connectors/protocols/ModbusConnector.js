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
    
    // Registers are optional - if empty, auto-discovery will be triggered
    if (config.registers && !Array.isArray(config.registers)) {
      throw new Error('Modbus registers must be an array');
    }
    this.autoDiscovery = !config.registers || config.registers.length === 0;
    this.discoveredRegisters = [];
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
      
      // If auto-discovery is enabled, discover registers
      if (this.autoDiscovery) {
        logger.info(`Auto-discovery enabled for Modbus connector '${this.id}'`);
        await this.discoverRegisters();
        logger.info(`Auto-discovery completed. Use /api/sources/${this.id}/discovery to see discovered registers`);
      } else {
        // Start normal polling
        this.startPolling();
      }
      
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

  /**
   * Discover available Modbus registers by scanning common address ranges
   * Scans for responsive registers in typical industrial ranges
   */
  async discoverRegisters() {
    try {
      logger.info(`Starting register discovery for Modbus connector '${this.id}'`);
      
      const { config } = this.config;
      const unitId = config.unitId || 1;
      const discoveryRanges = config.discoveryRanges || {
        holdingRegisters: { start: 0, count: 100 },
        inputRegisters: { start: 0, count: 100 },
        coils: { start: 0, count: 100 },
        discreteInputs: { start: 0, count: 100 }
      };
      
      this.client.setID(unitId);
      const discovered = [];
      
      // Scan Holding Registers (FC3)
      logger.info(`Scanning Holding Registers (${discoveryRanges.holdingRegisters.start}-${discoveryRanges.holdingRegisters.start + discoveryRanges.holdingRegisters.count - 1})`);
      const holdingRegs = await this.scanRegisters('holding', discoveryRanges.holdingRegisters.start, discoveryRanges.holdingRegisters.count);
      discovered.push(...holdingRegs);
      
      // Scan Input Registers (FC4)
      logger.info(`Scanning Input Registers (${discoveryRanges.inputRegisters.start}-${discoveryRanges.inputRegisters.start + discoveryRanges.inputRegisters.count - 1})`);
      const inputRegs = await this.scanRegisters('input', discoveryRanges.inputRegisters.start, discoveryRanges.inputRegisters.count);
      discovered.push(...inputRegs);
      
      // Scan Coils (FC1)
      logger.info(`Scanning Coils (${discoveryRanges.coils.start}-${discoveryRanges.coils.start + discoveryRanges.coils.count - 1})`);
      const coils = await this.scanRegisters('coil', discoveryRanges.coils.start, discoveryRanges.coils.count);
      discovered.push(...coils);
      
      // Scan Discrete Inputs (FC2)
      logger.info(`Scanning Discrete Inputs (${discoveryRanges.discreteInputs.start}-${discoveryRanges.discreteInputs.start + discoveryRanges.discreteInputs.count - 1})`);
      const discreteInputs = await this.scanRegisters('discrete', discoveryRanges.discreteInputs.start, discoveryRanges.discreteInputs.count);
      discovered.push(...discreteInputs);
      
      this.discoveredRegisters = discovered;
      
      logger.info(`Discovered ${discovered.length} responsive registers for connector '${this.id}'`);
      
      // Emit discovery event
      this.emit('registersDiscovered', {
        sourceId: this.id,
        protocol: 'Modbus',
        registers: discovered
      });
      
      return discovered;
      
    } catch (error) {
      logger.error(`Failed to discover registers for connector '${this.id}':`, error);
      throw error;
    }
  }

  /**
   * Scan a specific range of registers
   */
  async scanRegisters(type, startAddress, count) {
    const discovered = [];
    const batchSize = 10; // Read registers in batches
    
    for (let addr = startAddress; addr < startAddress + count; addr += batchSize) {
      const readCount = Math.min(batchSize, startAddress + count - addr);
      
      try {
        let result;
        
        switch (type) {
          case 'holding':
            result = await this.client.readHoldingRegisters(addr, readCount);
            if (result.data) {
              for (let i = 0; i < result.data.length; i++) {
                discovered.push({
                  address: addr + i,
                  type: 'HoldingRegister',
                  name: `HR_${addr + i}`,
                  value: result.data[i],
                  functionCode: 3
                });
              }
            }
            break;
            
          case 'input':
            result = await this.client.readInputRegisters(addr, readCount);
            if (result.data) {
              for (let i = 0; i < result.data.length; i++) {
                discovered.push({
                  address: addr + i,
                  type: 'InputRegister',
                  name: `IR_${addr + i}`,
                  value: result.data[i],
                  functionCode: 4
                });
              }
            }
            break;
            
          case 'coil':
            result = await this.client.readCoils(addr, readCount);
            if (result.data) {
              for (let i = 0; i < result.data.length; i++) {
                discovered.push({
                  address: addr + i,
                  type: 'Coil',
                  name: `C_${addr + i}`,
                  value: result.data[i],
                  functionCode: 1
                });
              }
            }
            break;
            
          case 'discrete':
            result = await this.client.readDiscreteInputs(addr, readCount);
            if (result.data) {
              for (let i = 0; i < result.data.length; i++) {
                discovered.push({
                  address: addr + i,
                  type: 'DiscreteInput',
                  name: `DI_${addr + i}`,
                  value: result.data[i],
                  functionCode: 2
                });
              }
            }
            break;
        }
        
        // Small delay between batches to avoid overwhelming the device
        await new Promise(resolve => setTimeout(resolve, 50));
        
      } catch (error) {
        // Register not available or error reading - skip this range
        logger.debug(`No response for ${type} registers ${addr}-${addr + readCount - 1}`);
      }
    }
    
    return discovered;
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
