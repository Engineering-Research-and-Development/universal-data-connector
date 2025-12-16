const bacnet = require('bacstack');
const BaseConnector = require('./BaseConnector');
const logger = require('../utils/logger');

/**
 * BACnetConnector - Building Automation and Control Networks protocol connector
 * Uses bacstack library for BACnet/IP communication
 * Common in HVAC, lighting, and building automation systems
 */
class BACnetConnector extends BaseConnector {
  constructor(config) {
    super(config);
    this.client = null;
    this.pollingTimer = null;
    this.devices = new Map();
    
    this.validateConfig();
  }

  validateConfig() {
    super.validateConfig();
    
    const { config } = this.config;
    
    if (!config.devices || !Array.isArray(config.devices) || config.devices.length === 0) {
      throw new Error('BACnet connector requires devices array with at least one device definition');
    }
    
    // Validate each device configuration
    config.devices.forEach((device, index) => {
      if (!device.address) {
        throw new Error(`Device at index ${index} requires address (IP address)`);
      }
      if (!device.deviceId && device.deviceId !== 0) {
        throw new Error(`Device at index ${index} requires deviceId`);
      }
      if (!device.objects || !Array.isArray(device.objects) || device.objects.length === 0) {
        throw new Error(`Device at index ${index} requires objects array`);
      }
    });
  }

  async initialize() {
    await super.initialize();
    
    const { config } = this.config;
    
    // Initialize BACnet client
    const options = {
      port: config.port || 47808,
      interface: config.interface,
      broadcastAddress: config.broadcastAddress || '255.255.255.255',
      apduTimeout: config.timeout || 6000
    };
    
    this.client = new bacnet(options);
    
    logger.debug(`Initialized BACnet connector on port ${options.port}`);
  }

  async connect() {
    const { config } = this.config;
    
    try {
      // Verify each device is reachable
      for (const deviceConfig of config.devices) {
        await this.discoverDevice(deviceConfig);
      }
      
      logger.info(`BACnet connector '${this.id}' connected to ${config.devices.length} device(s)`);
      
      this.onConnected();
      this.startPolling();
      
    } catch (error) {
      logger.error(`BACnet connector '${this.id}' connection failed:`, error);
      this.onError(error);
      throw error;
    }
  }

  async discoverDevice(deviceConfig) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Device ${deviceConfig.deviceId} at ${deviceConfig.address} timeout`));
      }, this.config.config.timeout || 6000);
      
      this.client.readProperty(
        deviceConfig.address,
        { type: 8, instance: deviceConfig.deviceId }, // Device object
        76, // Object name property
        (err, value) => {
          clearTimeout(timeout);
          
          if (err) {
            reject(err);
            return;
          }
          
          const device = {
            address: deviceConfig.address,
            deviceId: deviceConfig.deviceId,
            name: value.values[0].value || `Device_${deviceConfig.deviceId}`,
            objects: deviceConfig.objects
          };
          
          this.devices.set(deviceConfig.deviceId, device);
          logger.debug(`BACnet device discovered: ${device.name} (ID: ${device.deviceId})`);
          resolve(device);
        }
      );
    });
  }

  async disconnect() {
    this.stopPolling();
    
    if (this.client) {
      try {
        this.client.close();
        this.client = null;
        logger.info(`BACnet connector '${this.id}' disconnected`);
      } catch (error) {
        logger.error(`Error disconnecting BACnet connector '${this.id}':`, error);
      }
    }
    
    this.devices.clear();
    this.isConnected = false;
  }

  startPolling() {
    const { config } = this.config;
    const interval = config.pollingInterval || 5000;
    
    this.pollingTimer = setInterval(async () => {
      if (this.isConnected && this.isRunning) {
        await this.readAllObjects();
      }
    }, interval);
    
    logger.debug(`BACnet connector '${this.id}' started polling (interval: ${interval}ms)`);
  }

  stopPolling() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
      logger.debug(`BACnet connector '${this.id}' stopped polling`);
    }
  }

  async readAllObjects() {
    const data = {
      timestamp: new Date().toISOString(),
      source: this.id,
      type: this.type,
      devices: {}
    };
    
    try {
      for (const [deviceId, device] of this.devices.entries()) {
        const deviceData = {
          name: device.name,
          deviceId: deviceId,
          objects: {}
        };
        
        for (const obj of device.objects) {
          try {
            const value = await this.readObject(device.address, obj);
            deviceData.objects[obj.name || `${obj.type}_${obj.instance}`] = value;
          } catch (error) {
            logger.warn(`Failed to read object ${obj.type}:${obj.instance} from device ${deviceId}:`, error.message);
          }
        }
        
        data.devices[device.name] = deviceData;
      }
      
      this.onData(data);
      
    } catch (error) {
      logger.error(`BACnet connector '${this.id}' read error:`, error);
      this.onError(error);
    }
  }

  async readObject(address, obj) {
    return new Promise((resolve, reject) => {
      const objectId = {
        type: obj.type,
        instance: obj.instance
      };
      
      const propertyId = obj.property || 85; // 85 = Present Value (default)
      
      this.client.readProperty(
        address,
        objectId,
        propertyId,
        (err, value) => {
          if (err) {
            reject(err);
            return;
          }
          
          // Extract the value
          if (value && value.values && value.values.length > 0) {
            resolve(value.values[0].value);
          } else {
            resolve(null);
          }
        }
      );
    });
  }

  async writeObject(deviceId, objectType, objectInstance, value, property = 85) {
    if (!this.isConnected) {
      throw new Error('BACnet connector is not connected');
    }
    
    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error(`Device ${deviceId} not found`);
    }
    
    return new Promise((resolve, reject) => {
      const objectId = {
        type: objectType,
        instance: objectInstance
      };
      
      const values = [{
        type: this.getBACnetDataType(value),
        value: value
      }];
      
      this.client.writeProperty(
        device.address,
        objectId,
        property,
        values,
        { priority: 8 },
        (err) => {
          if (err) {
            logger.error(`BACnet connector '${this.id}' write error:`, err);
            reject(err);
            return;
          }
          
          logger.info(`BACnet connector '${this.id}' wrote value ${value} to device ${deviceId}, object ${objectType}:${objectInstance}`);
          resolve();
        }
      );
    });
  }

  getBACnetDataType(value) {
    // Map JavaScript types to BACnet application tags
    if (typeof value === 'boolean') return 1; // Boolean
    if (typeof value === 'number') {
      return Number.isInteger(value) ? 2 : 4; // Unsigned int or Real
    }
    if (typeof value === 'string') return 7; // Character string
    return 0; // Null
  }

  async whoIs(lowLimit, highLimit) {
    return new Promise((resolve) => {
      const devices = [];
      
      const timeout = setTimeout(() => {
        resolve(devices);
      }, 3000);
      
      this.client.on('iAm', (device) => {
        devices.push(device);
        logger.debug(`BACnet device found: ${device.deviceId} at ${device.address}`);
      });
      
      this.client.whoIs(lowLimit, highLimit);
      
      setTimeout(() => {
        clearTimeout(timeout);
        resolve(devices);
      }, 3000);
    });
  }

  getStatus() {
    return {
      ...super.getStatus(),
      port: this.config.config.port || 47808,
      deviceCount: this.devices.size,
      devices: Array.from(this.devices.values()).map(d => ({
        name: d.name,
        deviceId: d.deviceId,
        address: d.address,
        objectCount: d.objects.length
      }))
    };
  }
}

module.exports = BACnetConnector;
