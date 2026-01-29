const mqtt = require('mqtt');
const BaseConnector = require('../BaseConnector');
const logger = require('../../utils/logger');

class MqttConnector extends BaseConnector {
  constructor(config) {
    super(config);
    
    this.client = null;
    this.isConnected = false;
    this.previousData = new Map(); // Store per rilevare cambiamenti
    this.subscribedTopics = new Map(); // Map<topic, qos>
  }

  /*  validateConfig() {
     super.validateConfig();
     
     const { config } = this.config;
     if (!config.broker) {
       throw new Error('MQTT connector requires a broker URL');
     }
     // Topics are optional - if empty, auto-discovery will be triggered
     if (config.topics && !Array.isArray(config.topics)) {
       throw new Error('MQTT topics must be an array');
     }
     this.autoDiscovery = !config.topics || config.topics.length === 0;
     this.discoveredTopics = [];
   } */

  /* async initialize() {
    await super.initialize();
    logger.debug(`Initialized MQTT connector for broker: ${this.config.config.broker}`);
  } */

  /* async connect() {
    try {
      const { config } = this.config;
      
      logger.info(`Connecting to MQTT broker: ${config.broker}`);
      
      // Prepare connection options
      const options = {
        clientId: config.clientId || `udc_${this.id}_${Date.now()}`,
        keepalive: 60,
        connectTimeout: 30000,
        reconnectPeriod: 1000,
        clean: true,
        ...config.options
      };

      // Add authentication if provided
      if (config.username) {
        options.username = config.username;
      }
      if (config.password) {
        options.password = config.password;
      }

      // Create MQTT client
      this.client = mqtt.connect(config.broker, options);

      // Setup event handlers
      this.setupEventHandlers();
      
      // Wait for connection
      await this.waitForConnection();
      
      // If auto-discovery is enabled, discover topics
      if (this.autoDiscovery) {
        logger.info(`Auto-discovery enabled for MQTT connector '${this.id}'`);
        await this.discoverTopics();
        logger.info(`Auto-discovery completed. Use /api/sources/${this.id}/discovery to see discovered topics`);
      } else {
        // Subscribe to configured topics
        await this.subscribeToTopics();
      }
      
    } catch (error) {
      logger.error(`Failed to connect MQTT connector '${this.id}':`, error);
      await this.cleanup();
      throw error;
    }
  } */

  /*  async disconnect() {
     await this.cleanup();
   } */

  /* async cleanup() {
    try {
      if (this.client) {
        // Unsubscribe from all topics
        if (this.subscribedTopics.size > 0) {
          const topics = Array.from(this.subscribedTopics);
          await new Promise((resolve, reject) => {
            this.client.unsubscribe(topics, (error) => {
              if (error) {
                logger.debug(`Error unsubscribing from topics:`, error);
              }
              resolve();
            });
          });
          this.subscribedTopics.clear();
        }

        // End client connection
        await new Promise((resolve) => {
          this.client.end(false, {}, resolve);
        });
        
        this.client = null;
      }

      logger.debug(`MQTT connector '${this.id}' cleanup completed`);
      
    } catch (error) {
      logger.error(`Error during MQTT connector '${this.id}' cleanup:`, error);
    }
  } */

  /**
   * Discover topics by subscribing to wildcard and logging received topics
   * Note: This requires broker support for $SYS topics or wildcard subscriptions
   */
  /* async discoverTopics() {
    try {
      logger.info(`Starting topic discovery for MQTT connector '${this.id}'`);
      
      const discoveryTopics = new Set();
      const discoveryTimeout = 10000; // 10 seconds discovery period
      
      // Subscribe to wildcard to capture all topics
      const wildcardTopic = '#';
      
      const tempHandler = (topic, message) => {
        // Filter out $SYS topics if not desired
        if (!topic.startsWith('$SYS/')) {
          discoveryTopics.add(topic);
          logger.debug(`Discovered MQTT topic: ${topic}`);
        }
      };
      
      this.client.on('message', tempHandler);
      
      await new Promise((resolve, reject) => {
        this.client.subscribe(wildcardTopic, { qos: 0 }, (error) => {
          if (error) {
            reject(error);
          } else {
            logger.info(`Subscribed to wildcard for discovery on connector '${this.id}'`);
            resolve();
          }
        });
      });
      
      // Wait for discovery period
      await new Promise(resolve => setTimeout(resolve, discoveryTimeout));
      
      // Unsubscribe from wildcard
      await new Promise((resolve) => {
        this.client.unsubscribe(wildcardTopic, () => resolve());
      });
      
      this.client.removeListener('message', tempHandler);
      
      this.discoveredTopics = Array.from(discoveryTopics).map(topic => ({
        topic,
        discovered: new Date().toISOString()
      }));
      
      logger.info(`Discovered ${this.discoveredTopics.length} topics for connector '${this.id}'`);
      
      // Emit discovery event
      this.emit('topicsDiscovered', {
        sourceId: this.id,
        protocol: 'MQTT',
        topics: this.discoveredTopics
      });
      
      return this.discoveredTopics;
      
    } catch (error) {
      logger.error(`Failed to discover topics for connector '${this.id}':`, error);
      throw error;
    }
  } */

  /* setupEventHandlers() {
    this.client.on('connect', () => {
      logger.info(`MQTT client '${this.id}' connected to broker`);
      this.onConnected();
    });

    this.client.on('disconnect', () => {
      logger.warn(`MQTT client '${this.id}' disconnected from broker`);
      this.onDisconnected();
    });

    this.client.on('offline', () => {
      logger.warn(`MQTT client '${this.id}' went offline`);
      this.onDisconnected();
    });

    this.client.on('error', (error) => {
      logger.error(`MQTT client '${this.id}' error:`, error);
      this.onError(error);
    });

    this.client.on('reconnect', () => {
      logger.info(`MQTT client '${this.id}' attempting to reconnect`);
      this.emit('reconnecting');
    });

    this.client.on('message', (topic, message, packet) => {
      this.handleMessage(topic, message, packet);
    });

    this.client.on('packetsend', (packet) => {
      logger.debug(`MQTT client '${this.id}' sent packet`, { type: packet.cmd });
    });

    this.client.on('packetreceive', (packet) => {
      logger.debug(`MQTT client '${this.id}' received packet`, { type: packet.cmd });
    });
  } */

  /* async waitForConnection() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('MQTT connection timeout'));
      }, 30000);

      this.client.once('connect', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.client.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  } */

  /* async subscribeToTopics() {
    const { config } = this.config;
    const qos = config.qos || 1;

    for (const topic of config.topics) {
      try {
        await this.subscribeToTopic(topic, qos);
      } catch (error) {
        logger.error(`Failed to subscribe to topic '${topic}' on connector '${this.id}':`, error);
        // Continue with other topics
      }
    }
  } */

  async subscribeToTopic(topic, qos = 0) {
    if (!this.client || !this.isConnected) {
      throw new Error('Client MQTT non connesso');
    }
    if (this.subscribedTopics.has(topic)) {
      console.log(`⚠️ Già sottoscritto al topic: ${topic}`);
      return;
    }

    return new Promise((resolve, reject) => {
      this.client.subscribe(topic, { qos }, (error, granted) => {
        if (error) {
          console.error(`❌ Errore sottoscrizione topic '${topic}':`, err.message);
          reject(error);
        } else {
          this.subscribedTopics.set(topic, qos);
          console.log(`📥 Sottoscritto al topic: ${topic} (QoS: ${granted[0].qos})`);
          resolve(granted);
        }
      });
    });
  }

  async unsubscribeFromTopic(topic) {
    if (!this.client || !this.isConnected) {
      throw new Error('Client MQTT non connesso');
    }
    if (!this.subscribedTopics.has(topic)) {
      console.log(`⚠️ Non sottoscritto al topic: ${topic}`);
      return;
    }

    return new Promise((resolve, reject) => {
      this.client.unsubscribe(topic, (err) => {
        if (err) {
          console.error(`❌ Errore rimozione sottoscrizione topic '${topic}':`, err.message);
          reject(err);
        } else {
          this.subscribedTopics.delete(topic);
          this.previousData.delete(topic);
          console.log(`📤 Rimossa sottoscrizione dal topic: ${topic}`);
          resolve();
        }
      });
    });
  }

  async addSubscriptions(topics, qos = 0) {
    if (!Array.isArray(topics)) {
      topics = [topics];
    }
    if (!this.client || !this.isConnected) {
      throw new Error('MQTT client not connected');
    }
    const results = {
      success: [],
      failed: []
    };

    for (const topic of topics) {
      try {
        await this.subscribeToTopic(topic, qos);
        results.success.push(topic);
      } catch (error) {
        results.failed.push({ topic, error: error.message });
      }
    }

    console.log(`✅ Sottoscritti ${results.success.length}/${topics.length} topic`);
    return results;
  }

  async removeSubscriptions(topics) {
    if (!Array.isArray(topics)) {
      topics = [topics];
    }
    const results = {
      success: [],
      failed: []
    };

    for (const topic of topics) {
      try {
        await this.unsubscribeFromTopic(topic);
        results.success.push(topic);
      } catch (error) {
        results.failed.push({ topic, error: error.message });
      }
    }

    console.log(`✅ Rimossi ${results.success.length}/${topics.length} topic`);
    return results;
  }

  async updateTopicQos(topic, newQos) {
    if (![0, 1, 2].includes(newQos)) {
      throw new Error('QoS deve essere 0, 1 o 2');
    }
    await this.unsubscribeFromTopic(topic);
    await this.subscribeToTopic(topic, newQos);
    console.log(`🔄 Aggiornato QoS del topic '${topic}' a ${newQos}`);
  }

  async unsubscribeAll() {
    const topics = Array.from(this.subscribedTopics.keys());
    if (topics.length === 0) {
      console.log('⚠️ Nessun topic da rimuovere');
      return;
    }
    await this.removeSubscriptions(topics);
    console.log('✅ Tutte le sottoscrizioni rimosse');
  }

  isSubscribedTo(topic) {
    return this.subscribedTopics.has(topic);
  }

  
  getSubscribedTopics() {
    return Array.from(this.subscribedTopics.entries()).map(([topic, qos]) => ({ topic, qos }));
  }
 


  async connect() {
  return new Promise((resolve, reject) => {
  try {
      const brokerConfig = this.config.config || this.config;
      console.log(`🔌 Connessione al broker MQTT: ${brokerConfig.broker}`);

      const options = {
        clientId: brokerConfig.clientId || `udc-mqtt-${Math.random().toString(16).substr(2, 8)}`,
        clean: brokerConfig.clean !== false,
        connectTimeout: brokerConfig.timeout || 30000,
        reconnectPeriod: brokerConfig.reconnectPeriod || 5000
      };

      if (brokerConfig.auth && brokerConfig.auth.username) {
        options.username = brokerConfig.auth.username;
        options.password = brokerConfig.auth.password;
      }

      this.client = mqtt.connect(brokerConfig.broker, options);

      this.client.on('connect', () => {
        console.log('✅ Connesso al broker MQTT');
        this.isConnected = true;
        this.subscribeToTopics();
        resolve();
      });

      this.client.on('error', (err) => {
        console.error('❌ Errore MQTT:', err.message);
        if (!this.isConnected) {
          reject(err);
        }
      });

      this.client.on('message', (topic, message) => {
        this.handleMessage(topic, message);
      });

      this.client.on('close', () => {
        console.log('🔌 Connessione MQTT chiusa');
        this.isConnected = false;
      });

      this.client.on('reconnect', () => {
        console.log('🔄 Riconnessione al broker MQTT...');
      });

    } catch (error) {
      reject(error);
    }
  });
}

subscribeToTopics() {
  const brokerConfig = this.config.config || this.config;
  const topics = Array.isArray(brokerConfig.topics) ? brokerConfig.topics : [brokerConfig.topics];
  const qos = brokerConfig.qos || 0;

  topics.forEach(topic => {
    this.subscribeToTopic(topic, qos).catch(err => {
      console.error(`❌ Errore sottoscrizione topic '${topic}':`, err.message);
    });
  });
}

handleMessage(topic, message) {
  try {
    const brokerConfig = this.config.config || this.config;
    const payload = message.toString();
    let data;

    try {
      data = JSON.parse(payload);
    } catch (e) {
      data = { raw: payload };
    }

    // Rilevamento cambiamenti se abilitato
    if (brokerConfig.detectChanges) {
      const dataKey = topic;
      const previousDataStr = this.previousData.get(dataKey);
      const currentDataStr = JSON.stringify(data);

      if (previousDataStr === currentDataStr) {
        // Dati non cambiati, non emettere evento
        return;
      }

      this.previousData.set(dataKey, currentDataStr);
    }

    // Auto-mapping se abilitato
    if (brokerConfig.autoMapping) {
      const mappedData = this.autoMapData(data, topic);

      console.log('\n📊 Dati ricevuti e mappati:');
      console.log('━'.repeat(50));
      console.log(`Topic: ${topic}`);
      console.log(`Timestamp: ${new Date().toISOString()}`);
      console.log('Dati:');
      console.log(JSON.stringify(mappedData, null, 2));
      console.log('━'.repeat(50) + '\n');

      this.emit('data', {
        topic,
        data: mappedData,
        timestamp: new Date().toISOString()
      });
    } else {
      console.log(`📨 Messaggio ricevuto su '${topic}':`, data);
      this.emit('data', { topic, data, timestamp: new Date().toISOString() });
    }

  } catch (error) {
    console.error('❌ Errore elaborazione messaggio:', error.message);
    this.emit('error', error);
  }
}

autoMapData(data, topic) {
  const mapped = {
    source: {
      type: 'mqtt',
      topic: topic,
      timestamp: new Date().toISOString()
    },
    data: {}
  };

  // Mappa automaticamente tutti i campi
  Object.keys(data).forEach(key => {
    const value = data[key];
    const type = typeof value;

    mapped.data[key] = {
      value: value,
      type: type,
      dataType: this.detectDataType(value)
    };
  });

  return mapped;
}

detectDataType(value) {
  if (typeof value === 'boolean') return 'Boolean';
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'Integer' : 'Float';
  }
  if (typeof value === 'string') return 'String';
  if (value === null) return 'Null';
  if (typeof value === 'object') return 'Object';
  return 'Unknown';
}

getStatus() {
  const brokerConfig = this.config.config || this.config;
  return {
    ...super.getStatus(),
    connected: this.isConnected,
    broker: brokerConfig.broker,
    clientId: this.client?.options?.clientId || null,
    subscribedTopics: this.getSubscribedTopics(),
    topicCount: this.subscribedTopics.size,
    autoMapping: brokerConfig.autoMapping || false,
    detectChanges: brokerConfig.detectChanges || false
  };
}

  async disconnect() {
  if (this.client) {
    return new Promise((resolve) => {
      this.client.end(false, () => {
        console.log('✅ Disconnesso dal broker MQTT');
        this.isConnected = false;
        this.subscribedTopics.clear();
        this.previousData.clear();
        resolve();
      });
    });
  }
}

  async read() {
  // MQTT è event-driven, non necessita di polling
  return null;
}
}

module.exports = MqttConnector;
