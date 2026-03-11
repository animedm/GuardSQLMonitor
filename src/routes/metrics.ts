import { Router, Request, Response } from 'express';
import { MetricsCollector } from '../services/MetricsCollector';
import { config } from '../config';

const router = Router();
const metricsCollector = MetricsCollector.getInstance();

// Get latest metrics for all databases
router.get('/latest', (req: Request, res: Response) => {
  try {
    const metrics = metricsCollector.getAllLatestMetrics();
    res.json(metrics);
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to retrieve metrics',
      message: error.message
    });
  }
});

// Get metrics history for a specific database
router.get('/history/:type/:name', (req: Request, res: Response) => {
  try {
    const { type, name } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    
    const history = metricsCollector.getMetricsHistory(type, name, limit);
    res.json(history);
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to retrieve metrics history',
      message: error.message
    });
  }
});

// Get aggregated metrics
router.get('/aggregate/:type/:name', (req: Request, res: Response) => {
  try {
    const { type, name } = req.params;
    const minutes = req.query.minutes ? parseInt(req.query.minutes as string) : 5;
    
    const aggregated = metricsCollector.getAggregatedMetrics(type, name, minutes);
    
    if (!aggregated) {
      return res.status(404).json({
        error: 'No metrics found for the specified database'
      });
    }
    
    res.json(aggregated);
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to aggregate metrics',
      message: error.message
    });
  }
});

// Get monitoring configuration
router.get('/config', (req: Request, res: Response) => {
  res.json({
    interval: config.monitoring.metricsInterval,
    slowQueryThreshold: config.monitoring.slowQueryThreshold,
    databases: {
      postgres: config.databases.postgres.enabled,
      mysql: config.databases.mysql.enabled,
      mssql: config.databases.mssql.enabled
    }
  });
});

export default router;
