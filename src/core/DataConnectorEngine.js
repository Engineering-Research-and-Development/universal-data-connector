const EventEmitter = require('events');
const logger = require('../utils/logger');
const configManager = require('../config/ConfigManager');
const ConnectorFactory = require('../connectors/ConnectorFactory');
const DataProcessor = require('./DataProcessor');
const DataStore = require('./DataStore');

class DataConnectorEngine extends EventEmitter {
  constructor(storageConfig = null) {
    super();
    this.connectors = new Map();
    this.dataProcessor = new DataProcessor();
    this.dataStore = new DataStore(storageConfig);
    this.isRunning = false;
    this.stats = {
      totalDataPoints: 0,
      totalErrors: 0,
      startTime: null,
      lastDataReceived: null
    };
  }

  async initialize() {
    try {
      logger.info('Initializing Data Connector Engine...');
      
      // Initialize data processor
      await this.dataProcessor.initialize();
      
      // Initialize data store
      await this.dataStore.initialize();
      
      // Setup data processor event handlers
      this.dataProcessor.on('processed', (data) => {
        this.handleProcessedData(data);
      });
      
      this.dataProcessor.on('error', (error) => {
        logger.error('Data processor error:', error);
        this.stats.totalErrors++;
        this.emit('processingError', error);
      });
      
      // Load and initialize connectors
      await this.initializeConnectors();
      
      logger.info('Data Connector Engine initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Data Connector Engine:', error);
      throw error;
    }
  }

  async initializeConnectors() {
    const sources = configManager.getEnabledSources();
    
    logger.info(`Initializing ${sources.length} connectors...`);
    
    for (const sourceConfig of sources) {
      try {
        await this.createConnector(sourceConfig);
      } catch (error) {
        logger.error(`Failed to initialize connector '${sourceConfig.id}':`, error);
        // Continue with other connectors even if one fails
      }
    }
  }

  async createConnector(sourceConfig) {
    try {
      // Create connector instance
      const connector = ConnectorFactory.create(sourceConfig.type, sourceConfig);
      
      // Setup event handlers
      this.setupConnectorEventHandlers(connector, sourceConfig.id);
      
      // Initialize connector
      await connector.initialize();
      
      // Store connector
      this.connectors.set(sourceConfig.id, {
        connector,
        config: sourceConfig,
        status: 'initialized',
        lastActivity: new Date(),
        stats: {
          dataPoints: 0,
          errors: 0,
          connections: 0
        }
      });
      
      logger.info(`Connector '${sourceConfig.id}' (${sourceConfig.type}) initialized successfully`);
      this.emit('connectorInitialized', sourceConfig.id);
      
    } catch (error) {
      logger.error(`Failed to create connector '${sourceConfig.id}':`, error);
      throw error;
    }
  }

  // Dynamic configuration reload methods
  async reloadSourcesConfiguration(newSources = null) {
    try {
      logger.info('Reloading sources configuration...');
      
      // Save new sources configuration if provided
      if (newSources) {
        const config = { sources: newSources };
        configManager.saveConfig(config);
        logger.info('New sources configuration saved');
      } else {
        // Reload from file
        configManager.loadConfig();
        logger.info('Sources configuration reloaded from file');
      }
      
      // Get current enabled sources
      const enabledSources = configManager.getEnabledSources();
      const currentConnectorIds = Array.from(this.connectors.keys());
      const newConnectorIds = enabledSources.map(s => s.id);
      
      // Stop and remove connectors that are no longer configured
      for (const connectorId of currentConnectorIds) {
        if (!newConnectorIds.includes(connectorId)) {
          await this.removeConnector(connectorId);
        }
      }
      
      // Update or create connectors
      for (const sourceConfig of enabledSources) {
        const existingConnector = this.connectors.get(sourceConfig.id);
        
        if (existingConnector) {
          // Check if configuration changed
          const configChanged = JSON.stringify(existingConnector.config) !== JSON.stringify(sourceConfig);
          
          if (configChanged) {
            logger.info(`Updating connector '${sourceConfig.id}' due to configuration change`);
            await this.updateConnector(sourceConfig.id, sourceConfig);
          }
        } else {
          // Create new connector
          logger.info(`Creating new connector '${sourceConfig.id}'`);
          await this.createConnector(sourceConfig);
          
          // Auto-start if engine is running
          if (this.isRunning) {
            await this.startConnector(sourceConfig.id);
          }
        }
      }
      
      this.emit('sourcesConfigurationReloaded', {
        totalSources: enabledSources.length,
        activeConnectors: this.connectors.size
      });
      
      logger.info('Sources configuration reloaded successfully');
      return {
        success: true,
        totalSources: enabledSources.length,
        activeConnectors: this.connectors.size,
        message: 'Sources configuration reloaded successfully'
      };
      
    } catch (error) {
      logger.error('Failed to reload sources configuration:', error);
      this.emit('sourcesConfigurationError', error);
      throw error;
    }
  }

  async updateConnector(connectorId, newConfig) {
    try {
      const existingConnector = this.connectors.get(connectorId);
      if (!existingConnector) {
        throw new Error(`Connector '${connectorId}' not found`);
      }
      
      const wasRunning = existingConnector.status === 'connected';
      
      // Stop existing connector
      if (wasRunning) {
        await this.stopConnector(connectorId);
      }
      
      // Remove old connector
      await this.removeConnector(connectorId);
      
      // Create new connector with updated config
      await this.createConnector(newConfig);
      
      // Start if it was running before
      if (wasRunning) {
        await this.startConnector(connectorId);
      }
      
      logger.info(`Connector '${connectorId}' updated successfully`);
      
    } catch (error) {
      logger.error(`Failed to update connector '${connectorId}':`, error);
      throw error;
    }
  }

  async removeConnector(connectorId) {
    try {
      const connectorInfo = this.connectors.get(connectorId);
      if (!connectorInfo) {
        logger.warn(`Connector '${connectorId}' not found for removal`);
        return;
      }
      
      // Stop connector if running
      if (connectorInfo.status === 'connected') {
        await this.stopConnector(connectorId);
      }
      
      // Cleanup connector
      if (connectorInfo.connector && typeof connectorInfo.connector.cleanup === 'function') {
        await connectorInfo.connector.cleanup();
      }
      
      // Remove from map
      this.connectors.delete(connectorId);
      
      logger.info(`Connector '${connectorId}' removed successfully`);
      this.emit('connectorRemoved', connectorId);
      
    } catch (error) {
      logger.error(`Failed to remove connector '${connectorId}':`, error);
      throw error;
    }
  }

  async reloadStorageConfiguration(newStorageConfig = null) {
    try {
      logger.info('Reloading storage configuration...');
      
      // Save new storage configuration if provided
      if (newStorageConfig) {
        const StorageConfigManager = require('../config/StorageConfigManager');
        await StorageConfigManager.updateStorageConfig(newStorageConfig);
        logger.info('New storage configuration saved');
      }
      
      // Backup current data if needed
      const currentData = await this.dataStore.getAll();
      logger.info(`Backing up ${currentData.length} data points`);
      
      // Reinitialize data store with new configuration
      this.dataStore = new DataStore(newStorageConfig);
      await this.dataStore.initialize();
      
      // Restore data if any
      if (currentData.length > 0) {
        logger.info(`Restoring ${currentData.length} data points to new storage`);
        for (const dataPoint of currentData) {
          await this.dataStore.store(dataPoint);
        }
      }
      
      this.emit('storageConfigurationReloaded', {
        storageType: newStorageConfig?.type || 'memory',
        restoredDataPoints: currentData.length
      });
      
      logger.info('Storage configuration reloaded successfully');
      return {
        success: true,
        storageType: newStorageConfig?.type || 'memory',
        restoredDataPoints: currentData.length,
        message: 'Storage configuration reloaded successfully'
      };
      
    } catch (error) {
      logger.error('Failed to reload storage configuration:', error);
      this.emit('storageConfigurationError', error);
      throw error;
    }
  }

  setupConnectorEventHandlers(connector, sourceId) {
    connector.on('data', (data) => {
      this.handleConnectorData(sourceId, data);
    });

    connector.on('connected', () => {
      this.updateConnectorStatus(sourceId, 'connected');
      logger.info(`Connector '${sourceId}' connected`);
    });

    connector.on('disconnected', () => {
      this.updateConnectorStatus(sourceId, 'disconnected');
      logger.warn(`Connector '${sourceId}' disconnected`);
    });

    connector.on('error', (error) => {
      this.handleConnectorError(sourceId, error);
    });

    connector.on('reconnecting', () => {
      this.updateConnectorStatus(sourceId, 'reconnecting');
      logger.info(`Connector '${sourceId}' reconnecting...`);
    });
  }

  handleConnectorData(sourceId, data) {
    try {
      const connectorInfo = this.connectors.get(sourceId);
      if (!connectorInfo) {
        logger.warn(`Received data from unknown connector: ${sourceId}`);
        return;
      }

      // Update connector stats
      connectorInfo.stats.dataPoints++;
      connectorInfo.lastActivity = new Date();

      // Update global stats
      this.stats.totalDataPoints++;
      this.stats.lastDataReceived = new Date();

      // Enrich data with metadata
      const enrichedData = {
        sourceId,
        sourceType: connectorInfo.config.type,
        timestamp: new Date().toISOString(),
        data: data,
        metadata: {
          sourceName: connectorInfo.config.name,
          sourceDescription: connectorInfo.config.description
        }
      };

      // Send to data processor
      this.dataProcessor.process(enrichedData);

      // Emit raw data event
      this.emit('rawData', enrichedData);

    } catch (error) {
      logger.error(`Error handling data from connector '${sourceId}':`, error);
      this.stats.totalErrors++;
    }
  }

  handleProcessedData(processedData) {
    try {
      // Store processed data
      this.dataStore.store(processedData);

      // Emit processed data event
      this.emit('data', processedData);

      logger.debug(`Processed data from source '${processedData.sourceId}'`, {
        dataSize: JSON.stringify(processedData.data).length,
        timestamp: processedData.timestamp
      });

    } catch (error) {
      logger.error('Error handling processed data:', error);
      this.stats.totalErrors++;
    }
  }

  handleConnectorError(sourceId, error) {
    const connectorInfo = this.connectors.get(sourceId);
    if (connectorInfo) {
      connectorInfo.stats.errors++;
    }

    this.stats.totalErrors++;
    
    logger.error(`Connector '${sourceId}' error:`, error);
    this.emit('connectorError', sourceId, error);
  }

  updateConnectorStatus(sourceId, status) {
    const connectorInfo = this.connectors.get(sourceId);
    if (connectorInfo) {
      const oldStatus = connectorInfo.status;
      connectorInfo.status = status;
      connectorInfo.lastActivity = new Date();
      
      if (status === 'connected') {
        connectorInfo.stats.connections++;
      }
      
      if (oldStatus !== status) {
        this.emit('sourceStatusChanged', sourceId, status);
      }
    }
  }

  // API Support Methods
  getConnectorStatus() {
    const status = {};
    
    for (const [connectorId, connectorInfo] of this.connectors.entries()) {
      status[connectorId] = {
        status: connectorInfo.status,
        type: connectorInfo.config.type,
        enabled: connectorInfo.config.enabled,
        lastActivity: connectorInfo.lastActivity,
        stats: {
          dataPoints: connectorInfo.stats.dataPoints,
          errors: connectorInfo.stats.errors,
          connections: connectorInfo.stats.connections
        }
      };
    }
    
    return status;
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      stats: {
        totalDataPoints: this.stats.totalDataPoints,
        totalErrors: this.stats.totalErrors,
        startTime: this.stats.startTime,
        lastDataReceived: this.stats.lastDataReceived,
        connectorCount: this.connectors.size,
        uptime: this.stats.startTime ? Date.now() - this.stats.startTime.getTime() : 0
      }
    };
  }

  // Configuration management helpers
  getEnabledSources() {
    return configManager.getEnabledSources();
  }

  getAllSources() {
    return configManager.getSources();
  }

  getStorageInfo() {
    if (this.dataStore && typeof this.dataStore.getStorageInfo === 'function') {
      return this.dataStore.getStorageInfo();
    }
    
    return {
      type: 'unknown',
      status: 'unknown'
    };
  }

  async start() {
    if (this.isRunning) {
      logger.warn('Data Connector Engine is already running');
      return;
    }

    try {
      logger.info('Starting Data Connector Engine...');
      
      this.stats.startTime = new Date();
      this.isRunning = true;

      // Start all connectors
      const startPromises = Array.from(this.connectors.values()).map(async (connectorInfo) => {
        try {
          await connectorInfo.connector.start();
          logger.info(`Started connector '${connectorInfo.config.id}'`);
        } catch (error) {
          logger.error(`Failed to start connector '${connectorInfo.config.id}':`, error);
        }
      });

      await Promise.allSettled(startPromises);

      logger.info('Data Connector Engine started successfully');
      this.emit('started');

    } catch (error) {
      logger.error('Failed to start Data Connector Engine:', error);
      this.isRunning = false;
      throw error;
    }
  }

  async stop() {
    if (!this.isRunning) {
      logger.warn('Data Connector Engine is not running');
      return;
    }

    try {
      logger.info('Stopping Data Connector Engine...');
      
      this.isRunning = false;

      // Stop all connectors
      const stopPromises = Array.from(this.connectors.values()).map(async (connectorInfo) => {
        try {
          await connectorInfo.connector.stop();
          logger.info(`Stopped connector '${connectorInfo.config.id}'`);
        } catch (error) {
          logger.error(`Failed to stop connector '${connectorInfo.config.id}':`, error);
        }
      });

      await Promise.allSettled(stopPromises);

      logger.info('Data Connector Engine stopped successfully');
      this.emit('stopped');

    } catch (error) {
      logger.error('Failed to stop Data Connector Engine:', error);
      throw error;
    }
  }

  async startConnector(sourceId) {
    const connectorInfo = this.connectors.get(sourceId);
    if (!connectorInfo) {
      throw new Error(`Connector '${sourceId}' not found`);
    }

    try {
      await connectorInfo.connector.start();
      logger.info(`Started connector '${sourceId}'`);
      return true;
    } catch (error) {
      logger.error(`Failed to start connector '${sourceId}':`, error);
      throw error;
    }
  }

  async stopConnector(sourceId) {
    const connectorInfo = this.connectors.get(sourceId);
    if (!connectorInfo) {
      throw new Error(`Connector '${sourceId}' not found`);
    }

    try {
      await connectorInfo.connector.stop();
      logger.info(`Stopped connector '${sourceId}'`);
      return true;
    } catch (error) {
      logger.error(`Failed to stop connector '${sourceId}':`, error);
      throw error;
    }
  }

  async restartConnector(sourceId) {
    await this.stopConnector(sourceId);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
    await this.startConnector(sourceId);
  }

  async reloadConfiguration() {
    logger.info('Reloading configuration...');
    
    try {
      // Stop all connectors
      if (this.isRunning) {
        await this.stop();
      }

      // Clear current connectors
      this.connectors.clear();

      // Reload config
      await configManager.reloadConfig();

      // Reinitialize connectors
      await this.initializeConnectors();

      // Restart if it was running
      if (this.isRunning) {
        await this.start();
      }

      logger.info('Configuration reloaded successfully');
      this.emit('configurationReloaded');

    } catch (error) {
      logger.error('Failed to reload configuration:', error);
      throw error;
    }
  }
}

module.exports = DataConnectorEngine;
