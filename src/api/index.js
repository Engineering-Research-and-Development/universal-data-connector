const express = require('express');
const router = express.Router();

// Import route modules
const statusRoutes = require('./routes/status');
const sourcesRoutes = require('./routes/sources');
const dataRoutes = require('./routes/data');
const configRoutes = require('./routes/config');

// Middleware per autenticazione (opzionale)
const authMiddleware = (req, res, next) => {
  const apiKey = process.env.API_KEY;
  
  if (apiKey) {
    const providedKey = req.headers['x-api-key'] || req.query.apiKey;
    
    if (!providedKey || providedKey !== apiKey) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Valid API key required' 
      });
    }
  }
  
  next();
};

// Apply authentication middleware if API key is configured
if (process.env.API_KEY) {
  router.use(authMiddleware);
}

// API routes
router.use('/status', statusRoutes);
router.use('/sources', sourcesRoutes);
router.use('/data', dataRoutes);
router.use('/config', configRoutes);

// API documentation endpoint
router.get('/', (req, res) => {
  res.json({
    name: 'Universal Data Connector API',
    version: '1.0.0',
    description: 'REST API for monitoring and controlling the Universal Data Connector',
    endpoints: {
      status: {
        'GET /api/status': 'Get overall system status',
        'GET /api/status/health': 'Get health check information'
      },
      sources: {
        'GET /api/sources': 'Get all configured sources',
        'GET /api/sources/:id': 'Get specific source information',
        'GET /api/sources/:id/status': 'Get source status',
        'POST /api/sources/:id/start': 'Start a source',
        'POST /api/sources/:id/stop': 'Stop a source',
        'POST /api/sources/:id/restart': 'Restart a source'
      },
      data: {
        'GET /api/data/latest': 'Get latest data points',
        'GET /api/data/source/:id': 'Get data from specific source',
        'GET /api/data/search': 'Search data points',
        'GET /api/data/export': 'Export data in various formats'
      },
      config: {
        'GET /api/config': 'Get current configuration',
        'POST /api/config/reload': 'Reload configuration from file',
        'GET /api/config/sources': 'Get sources configuration'
      }
    },
    authentication: process.env.API_KEY ? 'API Key required (x-api-key header or apiKey query param)' : 'No authentication required'
  });
});

module.exports = router;
