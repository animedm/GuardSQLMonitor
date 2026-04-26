import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import mysql from 'mysql2/promise';
import sql from 'mssql';
import { logger } from '../utils/logger';
import { DatabaseMonitor } from '../services/DatabaseMonitor';
import {
  GlobalAlertSettings,
  ManagedConnection,
  loadManagedConfiguration,
  saveManagedConfiguration,
  applyPrimaryConnectionsToRuntimeConfig
} from '../config/connections';

const router = Router();

// GET /api/connections — returns current connection list
router.get('/', (req: Request, res: Response) => {
  const managedConfig = loadManagedConfiguration();
  res.json(managedConfig);
});

// PUT /api/connections — saves list and restarts the monitor
router.put('/', async (req: Request, res: Response) => {
  try {
    const payload = req.body as { connections?: ManagedConnection[]; alerts?: Partial<GlobalAlertSettings> };
    const connections = payload.connections;

    if (!Array.isArray(connections)) {
      return res.status(400).json({ error: 'connections must be an array' });
    }

    const saved = saveManagedConfiguration({
      connections,
      alerts: payload.alerts
    });
    applyPrimaryConnectionsToRuntimeConfig(saved.connections);

    // Restart monitor with the new connection set
    try {
      const monitor = DatabaseMonitor.getInstance();
      await monitor.stop();
      await monitor.start();
      logger.info('Database monitor restarted with new connection config');
    } catch (monitorErr) {
      logger.warn('Monitor restart warning:', monitorErr);
    }

    res.json({
      success: true,
      message: 'Connections and alerts saved, monitor restarted',
      connections: saved.connections,
      alerts: saved.alerts
    });
  } catch (error: any) {
    logger.error('Failed to save connections:', error);
    res.status(500).json({ error: 'Failed to save connections', message: error.message });
  }
});

// POST /api/connections/test — test a single connection without saving
router.post('/test', async (req: Request, res: Response) => {
  const { type, host, port, database, user, password } = req.body;

  if (!type || !host || !port || !database || !user) {
    return res.status(400).json({ error: 'type, host, port, database and user are required' });
  }

  const start = Date.now();

  try {
    switch (type) {
      case 'postgres': {
        const pool = new Pool({
          host,
          port: Number(port),
          database,
          user,
          password: password || '',
          connectionTimeoutMillis: 5000,
          ssl: { rejectUnauthorized: false },
        });
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        await pool.end();
        break;
      }
      case 'mysql': {
        const conn = await mysql.createConnection({
          host,
          port: Number(port),
          database,
          user,
          password: password || '',
          connectTimeout: 5000,
        });
        await conn.query('SELECT 1');
        await conn.end();
        break;
      }
      case 'mssql': {
        const pool = new sql.ConnectionPool({
          server: host,
          port: Number(port),
          database,
          user,
          password: password || '',
          options: { encrypt: false, trustServerCertificate: true },
          connectionTimeout: 5000,
        });
        await pool.connect();
        await pool.request().query('SELECT 1');
        await pool.close();
        break;
      }
      default:
        return res.status(400).json({ error: 'Invalid type. Use postgres, mysql or mssql' });
    }

    res.json({ success: true, responseTime: Date.now() - start });
  } catch (error: any) {
    res.status(200).json({ success: false, error: error.message });
  }
});

export default router;
