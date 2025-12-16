const net = require('net');
const BaseConnector = require('./BaseConnector');
const logger = require('../utils/logger');

/**
 * FinsTcpConnector - Omron FINS (Factory Interface Network Service) TCP protocol
 * Used for communication with Omron PLCs (CJ, CS, CP, NJ, NX series)
 */
class FinsTcpConnector extends BaseConnector {
  constructor(config) {
    super(config);
    this.socket = null;
    this.pollingTimer = null;
    this.isSocketConnected = false;
    this.messageQueue = [];
    this.currentSid = 0;
    
    this.validateConfig();
  }

  validateConfig() {
    super.validateConfig();
    
    const { config } = this.config;
    if (!config.host) {
      throw new Error('FINS TCP connector requires host (PLC IP address)');
    }
    
    if (!config.memory || !Array.isArray(config.memory) || config.memory.length === 0) {
      throw new Error('FINS TCP connector requires memory array with at least one memory area definition');
    }
  }

  async initialize() {
    await super.initialize();
    
    const { config } = this.config;
    
    // FINS parameters
    this.finsConfig = {
      host: config.host,
      port: config.port || 9600,
      localNode: config.localNode || 0x00,
      remoteNode: config.remoteNode || 0x00,
      localNet: config.localNet || 0x00,
      remoteNet: config.remoteNet || 0x00
    };
    
    logger.debug(`Initialized FINS TCP connector for PLC: ${config.host}:${config.port}`);
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.socket = new net.Socket();
      
      this.socket.on('connect', () => {
        logger.info(`FINS TCP connector '${this.id}' connected to ${this.finsConfig.host}:${this.finsConfig.port}`);
        this.isSocketConnected = true;
        this.onConnected();
        this.startPolling();
        resolve();
      });
      
      this.socket.on('data', (data) => {
        this.handleResponse(data);
      });
      
      this.socket.on('error', (error) => {
        logger.error(`FINS TCP connector '${this.id}' socket error:`, error);
        this.onError(error);
        reject(error);
      });
      
      this.socket.on('close', () => {
        logger.warn(`FINS TCP connector '${this.id}' socket closed`);
        this.isSocketConnected = false;
        this.onDisconnected();
      });
      
      this.socket.connect(this.finsConfig.port, this.finsConfig.host);
    });
  }

  async disconnect() {
    this.stopPolling();
    
    if (this.socket) {
      try {
        this.socket.destroy();
        this.socket = null;
        logger.info(`FINS TCP connector '${this.id}' disconnected`);
      } catch (error) {
        logger.error(`Error disconnecting FINS TCP connector '${this.id}':`, error);
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
        await this.readMemory();
      }
    }, interval);
    
    logger.debug(`FINS TCP connector '${this.id}' started polling (interval: ${interval}ms)`);
  }

  stopPolling() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
      logger.debug(`FINS TCP connector '${this.id}' stopped polling`);
    }
  }

  async readMemory() {
    const { config } = this.config;
    const data = {
      timestamp: new Date().toISOString(),
      source: this.id,
      type: this.type,
      memory: {}
    };
    
    try {
      for (const mem of config.memory) {
        const { name, area, address, length = 1, dataType = 'word' } = mem;
        
        const value = await this.readMemoryArea(area, address, length);
        data.memory[name] = this.parseValue(value, dataType, length);
      }
      
      this.onData(data);
      
    } catch (error) {
      logger.error(`FINS TCP connector '${this.id}' read error:`, error);
      this.onError(error);
    }
  }

  async readMemoryArea(area, address, length) {
    return new Promise((resolve, reject) => {
      const command = this.buildReadCommand(area, address, length);
      
      const timeout = setTimeout(() => {
        reject(new Error('FINS read timeout'));
      }, 5000);
      
      this.messageQueue.push({
        resolve: (data) => {
          clearTimeout(timeout);
          resolve(data);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        }
      });
      
      this.socket.write(command);
    });
  }

  buildReadCommand(area, address, length) {
    // FINS TCP Frame Header (16 bytes)
    const header = Buffer.alloc(16);
    header.write('FINS', 0, 4, 'ascii');
    header.writeUInt32BE(12 + 10, 4); // Length
    header.writeUInt32BE(0x00000002, 8); // Command (2 = data send)
    header.writeUInt32BE(0x00000000, 12); // Error code
    
    // FINS Command
    const command = Buffer.alloc(10);
    command[0] = 0x80; // ICF
    command[1] = 0x00; // RSV
    command[2] = 0x02; // GCT
    command[3] = this.finsConfig.remoteNet;
    command[4] = this.finsConfig.remoteNode;
    command[5] = 0x00; // Unit address
    command[6] = this.finsConfig.localNet;
    command[7] = this.finsConfig.localNode;
    command[8] = 0x00; // Unit address
    command[9] = this.getNextSid();
    
    // Read command
    const readCmd = Buffer.alloc(6);
    readCmd[0] = 0x01; // Memory area read (0101)
    readCmd[1] = 0x01;
    readCmd[2] = this.getAreaCode(area);
    readCmd.writeUInt16BE(address, 3);
    readCmd[5] = length;
    
    return Buffer.concat([header, command, readCmd]);
  }

  getAreaCode(area) {
    const areaCodes = {
      'CIO': 0xB0,
      'WR': 0xB1,
      'HR': 0xB2,
      'AR': 0xB3,
      'DM': 0x82,
      'EM': 0xA0
    };
    return areaCodes[area.toUpperCase()] || 0x82;
  }

  getNextSid() {
    this.currentSid = (this.currentSid + 1) % 256;
    return this.currentSid;
  }

  handleResponse(data) {
    // Parse FINS response
    if (data.length < 16) {
      logger.warn(`FINS response too short: ${data.length} bytes`);
      return;
    }
    
    const handler = this.messageQueue.shift();
    if (!handler) {
      logger.warn('No handler for FINS response');
      return;
    }
    
    // Check for errors
    const endCode = data[15];
    if (endCode !== 0x00) {
      handler.reject(new Error(`FINS error code: ${endCode.toString(16)}`));
      return;
    }
    
    // Extract data (skip header and FINS command)
    const responseData = data.slice(30);
    handler.resolve(responseData);
  }

  parseValue(buffer, dataType, length) {
    if (length === 1) {
      switch (dataType.toLowerCase()) {
        case 'word':
        case 'uint16':
          return buffer.readUInt16BE(0);
        case 'int16':
          return buffer.readInt16BE(0);
        case 'bool':
          return buffer.readUInt16BE(0) !== 0;
        case 'dword':
        case 'uint32':
          return buffer.readUInt32BE(0);
        case 'int32':
          return buffer.readInt32BE(0);
        case 'float':
          return buffer.readFloatBE(0);
        default:
          return buffer.readUInt16BE(0);
      }
    } else {
      const result = [];
      for (let i = 0; i < length; i++) {
        result.push(buffer.readUInt16BE(i * 2));
      }
      return result;
    }
  }

  getStatus() {
    return {
      ...super.getStatus(),
      host: this.finsConfig.host,
      port: this.finsConfig.port,
      remoteNode: this.finsConfig.remoteNode,
      localNode: this.finsConfig.localNode
    };
  }
}

module.exports = FinsTcpConnector;
