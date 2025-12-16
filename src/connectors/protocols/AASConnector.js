const axios = require('axios');
const BaseConnector = require('./BaseConnector');
const logger = require('../utils/logger');

/**
 * AASConnector - Asset Administration Shell (AAS) Connector
 * Connects to AAS servers to fetch submodels and asset information
 * Supports both AAS API v1 and v3
 */
class AASConnector extends BaseConnector {
  constructor(config) {
    super(config);
    this.client = null;
    this.pollingTimer = null;
    this.submodels = new Map();
    this.shells = new Map();
    
    this.validateConfig();
  }

  validateConfig() {
    super.validateConfig();
    
    const { config } = this.config;
    if (!config.endpoint) {
      throw new Error('AAS connector requires endpoint (AAS server URL)');
    }
    
    if (!config.apiVersion) {
      throw new Error('AAS connector requires apiVersion (v1 or v3)');
    }
    
    if (!['v1', 'v3'].includes(config.apiVersion.toLowerCase())) {
      throw new Error('AAS connector apiVersion must be "v1" or "v3"');
    }
  }

  async initialize() {
    await super.initialize();
    
    const { config } = this.config;
    
    // Create axios client for AAS API
    this.client = axios.create({
      baseURL: config.endpoint,
      timeout: config.timeout || 10000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    // Setup authentication if provided
    if (config.authentication) {
      this.setupAuthentication();
    }
    
    logger.debug(`Initialized AAS connector for endpoint: ${config.endpoint} (API ${config.apiVersion})`);
  }

  setupAuthentication() {
    const { config } = this.config;
    
    if (config.authentication.type === 'bearer' && config.authentication.token) {
      this.client.defaults.headers.Authorization = `Bearer ${config.authentication.token}`;
    } else if (config.authentication.type === 'basic') {
      this.client.defaults.auth = {
        username: config.authentication.username,
        password: config.authentication.password
      };
    }
  }

  async connect() {
    const { config } = this.config;
    
    try {
      logger.info(`AAS connector '${this.id}' connecting to ${config.endpoint}`);
      
      // Discover AAS shells and submodels based on API version
      if (config.apiVersion.toLowerCase() === 'v1') {
        await this.discoverSubmodelsV1();
      } else {
        await this.discoverShellsV3();
      }
      
      logger.info(`AAS connector '${this.id}' discovered ${this.submodels.size} submodel(s)`);
      
      this.onConnected();
      this.startPolling();
      
    } catch (error) {
      logger.error(`AAS connector '${this.id}' connection failed:`, error);
      this.onError(error);
      throw error;
    }
  }

  async discoverSubmodelsV1() {
    const { config } = this.config;
    let apiUrl = '/aas/submodels';
    
    try {
      const response = await this.client.get(apiUrl);
      const submodels = Array.isArray(response.data) ? response.data : response.data.result || [];
      
      for (const submodel of submodels) {
        this.submodels.set(submodel.idShort, {
          id: submodel.identification?.id || submodel.idShort,
          idShort: submodel.idShort,
          data: submodel,
          version: 'v1'
        });
        
        logger.debug(`Discovered submodel: ${submodel.idShort}`);
      }
    } catch (error) {
      logger.error(`Failed to discover submodels (v1):`, error.message);
      throw error;
    }
  }

  async discoverShellsV3() {
    const { config } = this.config;
    
    try {
      // Get all AAS shells
      const shellsResponse = await this.client.get('/shells');
      const shells = shellsResponse.data.result || [];
      
      for (const shell of shells) {
        this.shells.set(shell.idShort, shell);
        
        // Get submodel references for this shell
        const shellId = Buffer.from(shell.id).toString('base64');
        const submodelRefsResponse = await this.client.get(`/shells/${shellId}/submodel-refs`);
        const submodelRefs = submodelRefsResponse.data.result || [];
        
        // Fetch each submodel
        for (const ref of submodelRefs) {
          const submodelId = ref.keys[0].value;
          const submodel = await this.fetchSubmodelV3(submodelId);
          
          this.submodels.set(submodel.idShort, {
            id: submodel.id,
            idShort: submodel.idShort,
            shellId: shell.idShort,
            data: submodel,
            version: 'v3'
          });
          
          logger.debug(`Discovered submodel: ${submodel.idShort} (shell: ${shell.idShort})`);
        }
      }
    } catch (error) {
      logger.error(`Failed to discover shells (v3):`, error.message);
      throw error;
    }
  }

  async fetchSubmodelV3(submodelId) {
    const encodedId = Buffer.from(submodelId).toString('base64');
    const response = await this.client.get(`/submodels/${encodedId}`);
    return response.data;
  }

  async disconnect() {
    this.stopPolling();
    
    this.submodels.clear();
    this.shells.clear();
    this.isConnected = false;
    
    logger.info(`AAS connector '${this.id}' disconnected`);
  }

  startPolling() {
    const { config } = this.config;
    const interval = config.pollingInterval || 5000;
    
    this.pollingTimer = setInterval(async () => {
      if (this.isConnected && this.isRunning) {
        await this.readAllSubmodels();
      }
    }, interval);
    
    logger.debug(`AAS connector '${this.id}' started polling (interval: ${interval}ms)`);
  }

  stopPolling() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
      logger.debug(`AAS connector '${this.id}' stopped polling`);
    }
  }

  async readAllSubmodels() {
    const data = {
      timestamp: new Date().toISOString(),
      source: this.id,
      type: this.type,
      apiVersion: this.config.config.apiVersion,
      submodels: {}
    };
    
    try {
      for (const [idShort, submodelInfo] of this.submodels.entries()) {
        // Re-fetch submodel data to get latest values
        const submodelData = await this.readSubmodel(submodelInfo);
        
        data.submodels[idShort] = {
          id: submodelInfo.id,
          idShort: idShort,
          shellId: submodelInfo.shellId,
          elements: this.extractSubmodelElements(submodelData)
        };
      }
      
      this.onData(data);
      
    } catch (error) {
      logger.error(`AAS connector '${this.id}' read error:`, error);
      this.onError(error);
    }
  }

  async readSubmodel(submodelInfo) {
    const { config } = this.config;
    
    try {
      if (config.apiVersion.toLowerCase() === 'v1') {
        // For v1, use the cached data or refetch
        return submodelInfo.data;
      } else {
        // For v3, refetch to get latest data
        return await this.fetchSubmodelV3(submodelInfo.id);
      }
    } catch (error) {
      logger.warn(`Failed to read submodel ${submodelInfo.idShort}:`, error.message);
      return submodelInfo.data; // Return cached data on error
    }
  }

  extractSubmodelElements(submodel) {
    const elements = {};
    
    if (!submodel.submodelElements) {
      return elements;
    }
    
    for (const element of submodel.submodelElements) {
      const elementData = this.parseSubmodelElement(element);
      if (elementData) {
        elements[element.idShort] = elementData;
      }
    }
    
    return elements;
  }

  parseSubmodelElement(element) {
    const baseData = {
      idShort: element.idShort,
      modelType: element.modelType,
      description: element.description?.[0]?.text || element.description
    };
    
    switch (element.modelType) {
      case 'Property':
        return {
          ...baseData,
          valueType: element.valueType,
          value: element.value
        };
        
      case 'MultiLanguageProperty':
        return {
          ...baseData,
          value: element.value
        };
        
      case 'Range':
        return {
          ...baseData,
          valueType: element.valueType,
          min: element.min,
          max: element.max
        };
        
      case 'File':
        return {
          ...baseData,
          contentType: element.contentType,
          value: element.value
        };
        
      case 'ReferenceElement':
        return {
          ...baseData,
          value: element.value
        };
        
      case 'SubmodelElementCollection':
        return {
          ...baseData,
          elements: element.value?.map(e => this.parseSubmodelElement(e)) || []
        };
        
      case 'Operation':
        return {
          ...baseData,
          inputVariables: element.inputVariables || [],
          outputVariables: element.outputVariables || []
        };
        
      default:
        logger.warn(`Unknown AAS element type: ${element.modelType}`);
        return baseData;
    }
  }

  async writeProperty(submodelIdShort, propertyIdShort, value) {
    if (!this.isConnected) {
      throw new Error('AAS connector is not connected');
    }
    
    const submodelInfo = this.submodels.get(submodelIdShort);
    if (!submodelInfo) {
      throw new Error(`Submodel '${submodelIdShort}' not found`);
    }
    
    try {
      const { config } = this.config;
      const encodedId = Buffer.from(submodelInfo.id).toString('base64');
      
      let url;
      if (config.apiVersion.toLowerCase() === 'v1') {
        url = `/aas/submodels/${encodedId}/submodel/submodelElements/${propertyIdShort}/value`;
      } else {
        url = `/submodels/${encodedId}/submodel-elements/${propertyIdShort}/value`;
      }
      
      await this.client.patch(url, { value });
      
      logger.info(`AAS connector '${this.id}' wrote value to ${submodelIdShort}.${propertyIdShort}`);
      return true;
      
    } catch (error) {
      logger.error(`AAS connector '${this.id}' write error:`, error);
      throw error;
    }
  }

  async invokeOperation(submodelIdShort, operationIdShort, inputArguments = []) {
    if (!this.isConnected) {
      throw new Error('AAS connector is not connected');
    }
    
    const submodelInfo = this.submodels.get(submodelIdShort);
    if (!submodelInfo) {
      throw new Error(`Submodel '${submodelIdShort}' not found`);
    }
    
    try {
      const { config } = this.config;
      const encodedId = Buffer.from(submodelInfo.id).toString('base64');
      
      let url;
      if (config.apiVersion.toLowerCase() === 'v1') {
        url = `/aas/submodels/${encodedId}/submodel/submodelElements/${operationIdShort}/invoke`;
      } else {
        url = `/submodels/${encodedId}/submodel-elements/${operationIdShort}/invoke`;
      }
      
      const response = await this.client.post(url, {
        inputArguments
      });
      
      logger.info(`AAS connector '${this.id}' invoked operation ${submodelIdShort}.${operationIdShort}`);
      return response.data;
      
    } catch (error) {
      logger.error(`AAS connector '${this.id}' operation error:`, error);
      throw error;
    }
  }

  getStatus() {
    return {
      ...super.getStatus(),
      endpoint: this.config.config.endpoint,
      apiVersion: this.config.config.apiVersion,
      shellCount: this.shells.size,
      submodelCount: this.submodels.size,
      submodels: Array.from(this.submodels.keys())
    };
  }
}

module.exports = AASConnector;
