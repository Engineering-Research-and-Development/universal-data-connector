const axios = require('axios');
const BaseConnector = require('../BaseConnector');
const logger = require('../../utils/logger');

class HttpConnector extends BaseConnector {
  constructor(config) {
    super(config);
    this.axiosInstance = null;
    this.pollingInterval = null;
    this.pollingTimer = null;
    
    this.validateConfig();
  }

  validateConfig() {
    super.validateConfig();
    
    const { config } = this.config;
    if (!config.url) {
      throw new Error('HTTP connector requires a URL');
    }
    if (config.polling && config.polling.enabled && !config.polling.interval) {
      throw new Error('HTTP connector with polling enabled requires a polling interval');
    }
  }

  async initialize() {
    await super.initialize();
    
    const { config } = this.config;
    
    // Create axios instance with base configuration
    this.axiosInstance = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 10000,
      headers: {
        'User-Agent': 'Universal-Data-Connector/1.0',
        ...config.headers
      },
      validateStatus: (status) => status < 500 // Accept all status codes < 500
    });

    // Setup authentication
    this.setupAuthentication();
    
    // Setup request/response interceptors
    this.setupInterceptors();
    
    // Set polling interval
    if (config.polling && config.polling.enabled) {
      this.pollingInterval = config.polling.interval;
    }
    
    logger.debug(`Initialized HTTP connector for URL: ${config.url}`);
  }

  setupAuthentication() {
    const { config } = this.config;
    
    if (config.authentication) {
      switch (config.authentication.type?.toLowerCase()) {
        case 'bearer':
          if (config.authentication.token) {
            this.axiosInstance.defaults.headers.Authorization = `Bearer ${config.authentication.token}`;
          }
          break;
          
        case 'basic':
          if (config.authentication.username && config.authentication.password) {
            this.axiosInstance.defaults.auth = {
              username: config.authentication.username,
              password: config.authentication.password
            };
          }
          break;
          
        case 'apikey':
          if (config.authentication.key && config.authentication.value) {
            this.axiosInstance.defaults.headers[config.authentication.key] = config.authentication.value;
          }
          break;
          
        case 'custom':
          if (config.authentication.headers) {
            Object.assign(this.axiosInstance.defaults.headers, config.authentication.headers);
          }
          break;
      }
    }
  }

  setupInterceptors() {
    // Request interceptor
    this.axiosInstance.interceptors.request.use(
      (config) => {
        logger.debug(`HTTP connector '${this.id}' making request`, {
          method: config.method?.toUpperCase(),
          url: config.url,
          headers: this.sanitizeHeaders(config.headers)
        });
        return config;
      },
      (error) => {
        logger.error(`HTTP connector '${this.id}' request error:`, error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.axiosInstance.interceptors.response.use(
      (response) => {
        logger.debug(`HTTP connector '${this.id}' response received`, {
          status: response.status,
          statusText: response.statusText,
          dataSize: JSON.stringify(response.data).length
        });
        return response;
      },
      (error) => {
        if (error.response) {
          logger.error(`HTTP connector '${this.id}' response error:`, {
            status: error.response.status,
            statusText: error.response.statusText,
            data: error.response.data
          });
        } else if (error.request) {
          logger.error(`HTTP connector '${this.id}' no response received:`, error.message);
        } else {
          logger.error(`HTTP connector '${this.id}' request setup error:`, error.message);
        }
        return Promise.reject(error);
      }
    );
  }

  async connect() {
    try {
      logger.info(`Starting HTTP connector '${this.id}'`);
      
      // Test initial connection
      await this.makeRequest();
      
      // Start polling if enabled
      if (this.pollingInterval) {
        this.startPolling();
      }
      
      this.onConnected();
      
    } catch (error) {
      logger.error(`Failed to start HTTP connector '${this.id}':`, error);
      throw error;
    }
  }

  async disconnect() {
    this.stopPolling();
    logger.debug(`HTTP connector '${this.id}' stopped`);
  }

  startPolling() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
    }

    logger.info(`HTTP connector '${this.id}' starting polling every ${this.pollingInterval}ms`);
    
    this.pollingTimer = setInterval(async () => {
      if (this.isRunning) {
        try {
          await this.makeRequest();
        } catch (error) {
          this.onError(error);
        }
      }
    }, this.pollingInterval);
  }

  stopPolling() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
      logger.info(`HTTP connector '${this.id}' stopped polling`);
    }
  }

  async makeRequest() {
    try {
      const { config } = this.config;
      
      const requestConfig = {
        method: config.method || 'GET',
        url: config.url,
        params: config.params,
        data: config.data,
        ...config.requestOptions
      };

      const response = await this.axiosInstance.request(requestConfig);
      
      // Process successful response
      await this.handleResponse(response);
      
      return response;
      
    } catch (error) {
      logger.error(`HTTP request failed for connector '${this.id}':`, error.message);
      throw error;
    }
  }

  async handleResponse(response) {
    try {
      const data = {
        url: response.config.url,
        method: response.config.method?.toUpperCase(),
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: response.data,
        timestamp: new Date().toISOString(),
        responseTime: response.config.metadata?.endTime - response.config.metadata?.startTime
      };

      // Add timing metadata
      if (response.config.metadata) {
        data.timing = {
          start: response.config.metadata.startTime,
          end: response.config.metadata.endTime,
          duration: response.config.metadata.endTime - response.config.metadata.startTime
        };
      }

      this.onData(data);
      
    } catch (error) {
      logger.error(`Error handling HTTP response for connector '${this.id}':`, error);
    }
  }

  async makeCustomRequest(method, url, options = {}) {
    if (!this.axiosInstance) {
      throw new Error('HTTP connector not initialized');
    }

    try {
      const requestConfig = {
        method: method.toUpperCase(),
        url: url,
        ...options
      };

      const response = await this.axiosInstance.request(requestConfig);
      return response;
      
    } catch (error) {
      logger.error(`Custom HTTP request failed for connector '${this.id}':`, error);
      throw error;
    }
  }

  async post(data, options = {}) {
    const { config } = this.config;
    return this.makeCustomRequest('POST', config.url, { data, ...options });
  }

  async put(data, options = {}) {
    const { config } = this.config;
    return this.makeCustomRequest('PUT', config.url, { data, ...options });
  }

  async patch(data, options = {}) {
    const { config } = this.config;
    return this.makeCustomRequest('PATCH', config.url, { data, ...options });
  }

  async delete(options = {}) {
    const { config } = this.config;
    return this.makeCustomRequest('DELETE', config.url, options);
  }

  updatePollingInterval(interval) {
    this.pollingInterval = interval;
    
    if (this.isRunning && this.pollingTimer) {
      this.stopPolling();
      this.startPolling();
      logger.info(`HTTP connector '${this.id}' polling interval updated to ${interval}ms`);
    }
  }

  updateUrl(url) {
    this.config.config.url = url;
    logger.info(`HTTP connector '${this.id}' URL updated to ${url}`);
  }

  updateHeaders(headers) {
    Object.assign(this.axiosInstance.defaults.headers, headers);
    logger.info(`HTTP connector '${this.id}' headers updated`);
  }

  sanitizeHeaders(headers) {
    // Remove sensitive headers from logging
    const sanitized = { ...headers };
    const sensitiveKeys = ['authorization', 'x-api-key', 'cookie', 'x-auth-token'];
    
    sensitiveKeys.forEach(key => {
      if (sanitized[key]) {
        sanitized[key] = '[REDACTED]';
      }
      if (sanitized[key.toUpperCase()]) {
        sanitized[key.toUpperCase()] = '[REDACTED]';
      }
    });
    
    return sanitized;
  }

  getStatus() {
    return {
      ...super.getStatus(),
      url: this.config.config.url,
      method: this.config.config.method || 'GET',
      pollingEnabled: !!this.pollingInterval,
      pollingInterval: this.pollingInterval,
      isPolling: !!this.pollingTimer
    };
  }
}

module.exports = HttpConnector;
