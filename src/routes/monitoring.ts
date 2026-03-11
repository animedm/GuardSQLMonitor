import { Router, Request, Response } from 'express';
import { DatabaseMonitor } from '../services/DatabaseMonitor';
import DeadlockMonitor from '../services/DeadlockMonitor';
import ConnectionPoolMonitor from '../services/ConnectionPoolMonitor';
import { logger } from '../utils/logger';

const router = Router();
const deadlockMonitor = new DeadlockMonitor();
const poolMonitor = new ConnectionPoolMonitor();

// Detect current deadlocks
router.post('/deadlocks/detect', async (req: Request, res: Response) => {
  try {
    const { databaseType, databaseName } = req.body;

    if (!databaseType || !databaseName) {
      return res.status(400).json({
        error: 'Missing required parameters',
        message: 'databaseType and databaseName are required'
      });
    }

    const dbMonitor = DatabaseMonitor.getInstance();
    let deadlock = null;

    if (databaseType === 'postgres') {
      const pgPool = dbMonitor.getPostgresPool();
      if (!pgPool) {
        return res.status(400).json({ error: 'PostgreSQL not configured' });
      }
      deadlock = await deadlockMonitor.detectPostgresDeadlocks(pgPool, databaseName);
    } else if (databaseType === 'mysql') {
      const mysqlPool = dbMonitor.getMySQLPool();
      if (!mysqlPool) {
        return res.status(400).json({ error: 'MySQL not configured' });
      }
      const mysqlConn = await mysqlPool.getConnection();
      deadlock = await deadlockMonitor.detectMySQLDeadlocks(mysqlConn, databaseName);
      mysqlConn.release();
    } else {
      return res.status(400).json({ error: 'Unsupported database type' });
    }

    res.json({
      deadlockDetected: deadlock !== null,
      deadlock
    });
  } catch (error: any) {
    logger.error('Error detecting deadlocks:', error);
    res.status(500).json({
      error: 'Failed to detect deadlocks',
      message: error.message
    });
  }
});

// Get deadlock history
router.get('/deadlocks/history', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const history = deadlockMonitor.getHistory(limit);

    res.json({
      count: history.length,
      deadlocks: history
    });
  } catch (error: any) {
    logger.error('Error getting deadlock history:', error);
    res.status(500).json({
      error: 'Failed to get deadlock history',
      message: error.message
    });
  }
});

// Get active connections and blocking chains
router.get('/connections', async (req: Request, res: Response) => {
  try {
    const { databaseType, databaseName } = req.query;

    if (!databaseType || !databaseName) {
      return res.status(400).json({
        error: 'Missing required parameters',
        message: 'databaseType and databaseName are required'
      });
    }

    const dbMonitor = DatabaseMonitor.getInstance();
    let connections = [];

    if (databaseType === 'postgres') {
      const pgPool = dbMonitor.getPostgresPool();
      if (!pgPool) {
        return res.status(400).json({ error: 'PostgreSQL not configured' });
      }
      connections = await deadlockMonitor.getPostgresConnections(pgPool);
    } else if (databaseType === 'mysql') {
      const mysqlPool = dbMonitor.getMySQLPool();
      if (!mysqlPool) {
        return res.status(400).json({ error: 'MySQL not configured' });
      }
      const mysqlConn = await mysqlPool.getConnection();
      connections = await deadlockMonitor.getMySQLConnections(mysqlConn);
      mysqlConn.release();
    } else {
      return res.status(400).json({ error: 'Unsupported database type' });
    }

    res.json({
      count: connections.length,
      connections
    });
  } catch (error: any) {
    logger.error('Error getting connections:', error);
    res.status(500).json({
      error: 'Failed to get connections',
      message: error.message
    });
  }
});

// Get connection pool statistics
router.get('/pool/stats', async (req: Request, res: Response) => {
  try {
    const { databaseType, databaseName } = req.query;

    if (!databaseType || !databaseName) {
      return res.status(400).json({
        error: 'Missing required parameters',
        message: 'databaseType and databaseName are required'
      });
    }

    const dbMonitor = DatabaseMonitor.getInstance();
    let poolStats = null;

    if (databaseType === 'postgres') {
      const pgPool = dbMonitor.getPostgresPool();
      if (!pgPool) {
        return res.status(400).json({ error: 'PostgreSQL not configured' });
      }
      poolStats = await poolMonitor.monitorPostgresPool(pgPool, databaseName as string, 100);
    } else if (databaseType === 'mysql') {
      const mysqlPool = dbMonitor.getMySQLPool();
      if (!mysqlPool) {
        return res.status(400).json({ error: 'MySQL not configured' });
      }
      const mysqlConn = await mysqlPool.getConnection();
      poolStats = await poolMonitor.monitorMySQLPool(mysqlConn, databaseName as string, 151);
      mysqlConn.release();
    } else {
      return res.status(400).json({ error: 'Unsupported database type' });
    }

    res.json(poolStats);
  } catch (error: any) {
    logger.error('Error getting pool stats:', error);
    res.status(500).json({
      error: 'Failed to get pool statistics',
      message: error.message
    });
  }
});

// Get pool metrics history
router.get('/pool/history', async (req: Request, res: Response) => {
  try {
    const { databaseName } = req.query;
    const limit = parseInt(req.query.limit as string) || 50;

    if (!databaseName) {
      return res.status(400).json({
        error: 'Missing required parameter: databaseName'
      });
    }

    const history = poolMonitor.getMetricsHistory(databaseName as string, limit);

    res.json({
      count: history.length,
      metrics: history
    });
  } catch (error: any) {
    logger.error('Error getting pool history:', error);
    res.status(500).json({
      error: 'Failed to get pool history',
      message: error.message
    });
  }
});

// Get pool trends analysis
router.get('/pool/trends', async (req: Request, res: Response) => {
  try {
    const { databaseName } = req.query;

    if (!databaseName) {
      return res.status(400).json({
        error: 'Missing required parameter: databaseName'
      });
    }

    const trends = poolMonitor.analyzePoolTrends(databaseName as string);

    res.json(trends);
  } catch (error: any) {
    logger.error('Error analyzing pool trends:', error);
    res.status(500).json({
      error: 'Failed to analyze pool trends',
      message: error.message
    });
  }
});

// Clear deadlock history
router.delete('/deadlocks/history', async (req: Request, res: Response) => {
  try {
    deadlockMonitor.clearHistory();
    res.json({ message: 'Deadlock history cleared' });
  } catch (error: any) {
    logger.error('Error clearing deadlock history:', error);
    res.status(500).json({
      error: 'Failed to clear history',
      message: error.message
    });
  }
});

export default router;
