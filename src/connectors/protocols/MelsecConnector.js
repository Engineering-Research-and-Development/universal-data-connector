const net = require('net');
const BaseConnector = require('../BaseConnector');
const logger = require('../../utils/logger');

/**
 * MelsecConnector - Mitsubishi MELSEC protocol (MC Protocol)
 * Supports communication with Mitsubishi PLCs (Q, L, FX series)
 * Uses MC Protocol 3E frame format over TCP
 */
class MelsecConnector extends BaseConnector {
  constructor(config) {
    super(config);
    this.socket = null;
    this.pollingTimer = null;
    this.isSocketConnected = false;
    this.serialNumber = 1;
    
    this.validateConfig();
  }

  validateConfig() {
    super.validateConfig();
    
    const { config } = this.config;
    if (!config.host) {
      throw new Error('MELSEC connector requires host (PLC IP address)');
    }
    
    if (!config.devices || !Array.isArray(config.devices) || config.devices.length === 0) {
      throw new Error('MELSEC connector requires devices array with at least one device definition');
    }
  }

  async initialize() {
    await super.initialize();
    
    const { config } = this.config;
    
    this.melsecConfig = {
      host: config.host,
      port: config.port || 5000,
      protocol: config.protocol || '3E', // 3E or 4E frame
      networkNo: config.networkNo || 0x00,
      pcNo: config.pcNo || 0xFF,
      unitIo: config.unitIo || 0x03FF,
      unitStation: config.unitStation || 0x00
    };
    
    logger.debug(`Initialized MELSEC MC Protocol connector for PLC: ${config.host}:${config.port}`);
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.socket = new net.Socket();
      
      this.socket.on('connect', () => {
        logger.info(`MELSEC connector '${this.id}' connected to ${this.melsecConfig.host}:${this.melsecConfig.port}`);
        this.isSocketConnected = true;
        this.onConnected();
        this.startPolling();
        resolve();
      });
      
      this.socket.on('data', (data) => {
        this.handleResponse(data);
      });
      
      this.socket.on('error', (error) => {
        logger.error(`MELSEC connector '${this.id}' socket error:`, error);
        this.onError(error);
        reject(error);
      });
      
      this.socket.on('close', () => {
        logger.warn(`MELSEC connector '${this.id}' socket closed`);
        this.isSocketConnected = false;
        this.onDisconnected();
      });
      
      this.socket.connect(this.melsecConfig.port, this.melsecConfig.host);
    });
  }

  async disconnect() {
    this.stopPolling();
    
    if (this.socket) {
      try {
        this.socket.destroy();
        this.socket = null;
        logger.info(`MELSEC connector '${this.id}' disconnected`);
      } catch (error) {
        logger.error(`Error disconnecting MELSEC connector '${this.id}':`, error);
      }
    }
    
    this.isSocketConnected = false;
    this.isConnected = false;
  }

  startPolling() {
    const { config } = this.config;
    const interval = config.pollingInterval || 1000;
    
    this.pollingTimer = setInterval(async () => {
      if (this.isConnected && this.isRunning && this.isSocketConnected) {
        await this.readDevices();
      }
    }, interval);
    
    logger.debug(`MELSEC connector '${this.id}' started polling (interval: ${interval}ms)`);
  }

  stopPolling() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
      logger.debug(`MELSEC connector '${this.id}' stopped polling`);
    }
  }

  async readDevices() {
    const { config } = this.config;
    const data = {
      timestamp: new Date().toISOString(),
      source: this.id,
      type: this.type,
      devices: {}
    };
    
    try {
      for (const device of config.devices) {
        const { name, deviceCode, address, length = 1, dataType = 'word' } = device;
        
        const value = await this.readDevice(deviceCode, address, length);
        data.devices[name] = this.parseValue(value, dataType, length);
      }
      
      this.onData(data);
      
    } catch (error) {
      logger.error(`MELSEC connector '${this.id}' read error:`, error);
      this.onError(error);
    }
  }

  async readDevice(deviceCode, address, length) {
    return new Promise((resolve, reject) => {
      const command = this.buildReadCommand(deviceCode, address, length);
      
      const timeout = setTimeout(() => {
        reject(new Error('MELSEC read timeout'));
      }, 5000);
      
      const handler = {
        resolve: (data) => {
          clearTimeout(timeout);
          resolve(data);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        }
      };
      
      this.pendingResponse = handler;
      this.socket.write(command);
    });
  }

  buildReadCommand(deviceCode, address, length) {
    // MC Protocol 3E Frame (Binary)
    const subheader = Buffer.from([0x50, 0x00]); // Subheader
    const networkNo = Buffer.from([this.melsecConfig.networkNo]);
    const pcNo = Buffer.from([this.melsecConfig.pcNo]);
    const unitIo = Buffer.alloc(2);
    unitIo.writeUInt16LE(this.melsecConfig.unitIo);
    const unitStation = Buffer.from([this.melsecConfig.unitStation]);
    
    // Request data length
    const dataLength = Buffer.alloc(2);
    dataLength.writeUInt16LE(12); // Fixed for batch read
    
    // Monitoring timer (250ms * 16 = 4s)
    const timer = Buffer.from([0x10, 0x00]);
    
    // Command and subcommand
    const command = Buffer.from([0x01, 0x04]); // Batch read (0401)
    
    // Device code and address
    const deviceAddr = Buffer.alloc(3);
    deviceAddr.writeUInt16LE(address, 0);
    deviceAddr[2] = 0x00;
    
    const devCode = Buffer.from([this.getDeviceCode(deviceCode)]);
    
    // Number of points
    const points = Buffer.alloc(2);
    points.writeUInt16LE(length);
    
    return Buffer.concat([
      subheader,
      networkNo,
      pcNo,
      unitIo,
      unitStation,
      dataLength,
      timer,
      command,
      deviceAddr,
      devCode,
      points
    ]);
  }

  getDeviceCode(device) {
    const deviceCodes = {
      'X': 0x9C,   // Input
      'Y': 0x9D,   // Output
      'M': 0x90,   // Internal relay
      'L': 0x92,   // Latch relay
      'F': 0x93,   // Annunciator
      'B': 0xA0,   // Link relay
      'D': 0xA8,   // Data register
      'W': 0xB4,   // Link register
      'R': 0xAF,   // File register
      'Z': 0xCC,   // Index register
      'T': 0xC1,   // Timer current value
      'C': 0xC5    // Counter current value
    };
    return deviceCodes[device.toUpperCase()] || 0xA8;
  }

  handleResponse(data) {
    if (!this.pendingResponse) {
      logger.warn('No pending response handler');
      return;
    }
    
    // Check response (MC Protocol 3E)
    if (data.length < 11) {
      this.pendingResponse.reject(new Error('Invalid response length'));
      return;
    }
    
    // Check end code
    const endCode = data.readUInt16LE(9);
    if (endCode !== 0x0000) {
      this.pendingResponse.reject(new Error(`MELSEC error code: ${endCode.toString(16)}`));
      return;
    }
    
    // Extract data (skip header)
    const responseData = data.slice(11);
    this.pendingResponse.resolve(responseData);
    this.pendingResponse = null;
  }

  parseValue(buffer, dataType, length) {
    if (length === 1) {
      switch (dataType.toLowerCase()) {
        case 'word':
        case 'uint16':
          return buffer.readUInt16LE(0);
        case 'int16':
          return buffer.readInt16LE(0);
        case 'bool':
        case 'bit':
          return buffer.readUInt16LE(0) !== 0;
        case 'dword':
        case 'uint32':
          return buffer.readUInt32LE(0);
        case 'int32':
          return buffer.readInt32LE(0);
        case 'float':
          return buffer.readFloatLE(0);
        default:
          return buffer.readUInt16LE(0);
      }
    } else {
      const result = [];
      for (let i = 0; i < length; i++) {
        result.push(buffer.readUInt16LE(i * 2));
      }
      return result;
    }
  }

  async writeDevice(deviceCode, address, value, dataType = 'word') {
    if (!this.isConnected) {
      throw new Error('MELSEC connector is not connected');
    }
    
    // Build write command
    const command = this.buildWriteCommand(deviceCode, address, value, dataType);
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('MELSEC write timeout'));
      }, 5000);
      
      this.pendingResponse = {
        resolve: () => {
          clearTimeout(timeout);
          logger.info(`MELSEC connector '${this.id}' wrote value ${value} to ${deviceCode}${address}`);
          resolve();
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        }
      };
      
      this.socket.write(command);
    });
  }

  buildWriteCommand(deviceCode, address, value, dataType) {
    // Similar to read command but with write command code (0x1401)
    // and data to write
    const subheader = Buffer.from([0x50, 0x00]);
    const networkNo = Buffer.from([this.melsecConfig.networkNo]);
    const pcNo = Buffer.from([this.melsecConfig.pcNo]);
    const unitIo = Buffer.alloc(2);
    unitIo.writeUInt16LE(this.melsecConfig.unitIo);
    const unitStation = Buffer.from([this.melsecConfig.unitStation]);
    
    const dataLength = Buffer.alloc(2);
    dataLength.writeUInt16LE(14); // 12 + 2 for data
    
    const timer = Buffer.from([0x10, 0x00]);
    const command = Buffer.from([0x01, 0x14]); // Batch write (1401)
    
    const deviceAddr = Buffer.alloc(3);
    deviceAddr.writeUInt16LE(address, 0);
    deviceAddr[2] = 0x00;
    
    const devCode = Buffer.from([this.getDeviceCode(deviceCode)]);
    const points = Buffer.from([0x01, 0x00]); // Write 1 point
    
    const data = Buffer.alloc(2);
    data.writeUInt16LE(value);
    
    return Buffer.concat([
      subheader,
      networkNo,
      pcNo,
      unitIo,
      unitStation,
      dataLength,
      timer,
      command,
      deviceAddr,
      devCode,
      points,
      data
    ]);
  }

  getStatus() {
    return {
      ...super.getStatus(),
      host: this.melsecConfig.host,
      port: this.melsecConfig.port,
      protocol: this.melsecConfig.protocol
    };
  }
}

module.exports = MelsecConnector;
