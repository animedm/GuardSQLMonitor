import { Router, Request, Response } from 'express';
import { PostgresConnector } from '../connectors/PostgresConnector';
import { MySQLConnector } from '../connectors/MySQLConnector';
import { MSSQLConnector } from '../connectors/MSSQLConnector';
import { AlertSystem } from '../services/AlertSystem';
import { config } from '../config';
import { loadManagedConnections } from '../config/connections';

const router = Router();
const pgConnector = PostgresConnector.getInstance();
const mysqlConnector = MySQLConnector.getInstance();
const mssqlConnector = MSSQLConnector.getInstance();
const alertSystem = AlertSystem.getInstance();

// Get slow queries for a specific database
router.get('/:type/slow-queries', async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

    if (type !== 'postgres' && type !== 'mysql' && type !== 'mssql') {
      return res.status(400).json({ error: 'Invalid database type' });
    }

    const targetConnections = loadManagedConnections().filter(
      (conn) => conn.enabled && conn.type === type
    );

    const allSlowQueries: any[] = [];

    for (const conn of targetConnections) {
      try {
        let connQueries: any[] = [];
        if (conn.type === 'postgres') {
          connQueries = await pgConnector.getSlowQueriesForConnection(conn, limit);
        } else if (conn.type === 'mysql') {
          connQueries = await mysqlConnector.getSlowQueriesForConnection(conn, limit);
        } else {
          connQueries = await mssqlConnector.getSlowQueriesForConnection(conn, limit);
        }

        allSlowQueries.push(
          ...connQueries.map((q: any) => ({
            ...q,
            databaseName: conn.name,
            databaseType: conn.type
          }))
        );
      } catch {
        // Ignore per-connection query failures and continue with others
      }
    }

    const slowQueries = allSlowQueries.slice(0, Math.max(limit, 1) * targetConnections.length);

    res.json(slowQueries);
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to retrieve slow queries',
      message: error.message
    });
  }
});

// Get database list
router.get('/list', (req: Request, res: Response) => {
  const databases = loadManagedConnections()
    .filter((conn) => conn.enabled)
    .map((conn) => ({
      id: conn.id,
      type: conn.type,
      name: conn.name,
      host: conn.host,
      port: conn.port,
      database: conn.database
    }));

  res.json(databases);
});

// Get alerts for a specific database
router.get('/:type/:name/alerts', (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const activeOnly = req.query.active === 'true';
    
    let alerts = alertSystem.getAllAlerts();
    alerts = alerts.filter(a => a.database === name);
    
    if (activeOnly) {
      alerts = alerts.filter(a => !a.resolved);
    }
    
    res.json(alerts);
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to retrieve alerts',
      message: error.message
    });
  }
});

// Get all alerts
router.get('/alerts', (req: Request, res: Response) => {
  try {
    const activeOnly = req.query.active === 'true';
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    
    let alerts = activeOnly ? alertSystem.getActiveAlerts() : alertSystem.getAllAlerts(limit);
    res.json(alerts);
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to retrieve alerts',
      message: error.message
    });
  }
});

// Get alert statistics
router.get('/alerts/stats', (req: Request, res: Response) => {
  try {
    const stats = alertSystem.getAlertStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to retrieve alert stats',
      message: error.message
    });
  }
});

// Resolve an alert
router.patch('/alerts/:id/resolve', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const resolved = alertSystem.resolveAlert(id);
    
    if (resolved) {
      res.json({ success: true, message: 'Alert resolved' });
    } else {
      res.status(404).json({ error: 'Alert not found' });
    }
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to resolve alert',
      message: error.message
    });
  }
});

// Clear resolved alerts
router.delete('/alerts/resolved', (req: Request, res: Response) => {
  try {
    const count = alertSystem.clearResolvedAlerts();
    res.json({ success: true, cleared: count });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to clear alerts',
      message: error.message
    });
  }
});

export default router;
