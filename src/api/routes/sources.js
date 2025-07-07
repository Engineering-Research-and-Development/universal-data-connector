const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');
const configManager = require('../../config/ConfigManager');

// Get all sources
router.get('/', (req, res) => {
  try {
    const connector = global.connector;
    const engine = connector?.getEngine();
    
    if (!engine) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Data connector engine not available'
      });
    }

    const sources = configManager.getSources();
    const engineStatus = engine.getStatus();

    const sourcesWithStatus = sources.map(source => {
      const connectorStatus = engineStatus.connectors[source.id];
      return {
        ...source,
        runtime: {
          status: connectorStatus?.status || 'unknown',
          lastActivity: connectorStatus?.lastActivity,
          stats: connectorStatus?.stats
        }
      };
    });

    res.json({
      timestamp: new Date().toISOString(),
      total: sources.length,
      enabled: sources.filter(s => s.enabled).length,
      sources: sourcesWithStatus
    });

  } catch (error) {
    logger.error('Error getting sources:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve sources'
    });
  }
});

// Get specific source
router.get('/:id', (req, res) => {
  try {
    const sourceId = req.params.id;
    const source = configManager.getSourceById(sourceId);
    
    if (!source) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Source '${sourceId}' not found`
      });
    }

    const connector = global.connector;
    const engine = connector?.getEngine();
    
    let runtimeStatus = null;
    if (engine) {
      runtimeStatus = engine.getConnectorStatus(sourceId);
    }

    res.json({
      timestamp: new Date().toISOString(),
      source: {
        ...source,
        runtime: runtimeStatus
      }
    });

  } catch (error) {
    logger.error('Error getting source:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve source'
    });
  }
});

// Get source status
router.get('/:id/status', (req, res) => {
  try {
    const sourceId = req.params.id;
    const source = configManager.getSourceById(sourceId);
    
    if (!source) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Source '${sourceId}' not found`
      });
    }

    const connector = global.connector;
    const engine = connector?.getEngine();
    
    if (!engine) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Data connector engine not available'
      });
    }

    const status = engine.getConnectorStatus(sourceId);
    
    if (!status) {
      return res.json({
        timestamp: new Date().toISOString(),
        sourceId,
        status: 'not_initialized',
        message: 'Source connector not initialized'
      });
    }

    res.json({
      timestamp: new Date().toISOString(),
      ...status
    });

  } catch (error) {
    logger.error('Error getting source status:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve source status'
    });
  }
});

// Start source
router.post('/:id/start', async (req, res) => {
  try {
    const sourceId = req.params.id;
    const source = configManager.getSourceById(sourceId);
    
    if (!source) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Source '${sourceId}' not found`
      });
    }

    const connector = global.connector;
    const engine = connector?.getEngine();
    
    if (!engine) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Data connector engine not available'
      });
    }

    await engine.startConnector(sourceId);
    
    logger.info(`Source '${sourceId}' started via API`);
    
    res.json({
      timestamp: new Date().toISOString(),
      sourceId,
      action: 'start',
      status: 'success',
      message: `Source '${sourceId}' started successfully`
    });

  } catch (error) {
    logger.error(`Error starting source '${req.params.id}':`, error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: `Failed to start source: ${error.message}`
    });
  }
});

// Stop source
router.post('/:id/stop', async (req, res) => {
  try {
    const sourceId = req.params.id;
    const source = configManager.getSourceById(sourceId);
    
    if (!source) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Source '${sourceId}' not found`
      });
    }

    const connector = global.connector;
    const engine = connector?.getEngine();
    
    if (!engine) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Data connector engine not available'
      });
    }

    await engine.stopConnector(sourceId);
    
    logger.info(`Source '${sourceId}' stopped via API`);
    
    res.json({
      timestamp: new Date().toISOString(),
      sourceId,
      action: 'stop',
      status: 'success',
      message: `Source '${sourceId}' stopped successfully`
    });

  } catch (error) {
    logger.error(`Error stopping source '${req.params.id}':`, error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: `Failed to stop source: ${error.message}`
    });
  }
});

// Restart source
router.post('/:id/restart', async (req, res) => {
  try {
    const sourceId = req.params.id;
    const source = configManager.getSourceById(sourceId);
    
    if (!source) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Source '${sourceId}' not found`
      });
    }

    const connector = global.connector;
    const engine = connector?.getEngine();
    
    if (!engine) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Data connector engine not available'
      });
    }

    await engine.restartConnector(sourceId);
    
    logger.info(`Source '${sourceId}' restarted via API`);
    
    res.json({
      timestamp: new Date().toISOString(),
      sourceId,
      action: 'restart',
      status: 'success',
      message: `Source '${sourceId}' restarted successfully`
    });

  } catch (error) {
    logger.error(`Error restarting source '${req.params.id}':`, error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: `Failed to restart source: ${error.message}`
    });
  }
});

// Get source data
router.get('/:id/data', (req, res) => {
  try {
    const sourceId = req.params.id;
    const limit = parseInt(req.query.limit) || 100;
    
    const source = configManager.getSourceById(sourceId);
    if (!source) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Source '${sourceId}' not found`
      });
    }

    const connector = global.connector;
    const engine = connector?.getEngine();
    
    if (!engine) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Data connector engine not available'
      });
    }

    const data = engine.getDataBySource(sourceId, limit);
    
    res.json({
      timestamp: new Date().toISOString(),
      sourceId,
      limit,
      total: data.length,
      data
    });

  } catch (error) {
    logger.error(`Error getting data for source '${req.params.id}':`, error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve source data'
    });
  }
});

module.exports = router;
