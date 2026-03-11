import { Router, Request, Response } from 'express';
import { ReplicationMonitor } from '../services/ReplicationMonitor';

const router = Router();
const replicationMonitor = ReplicationMonitor.getInstance();

// Get all replication statuses
router.get('/replication', async (req: Request, res: Response) => {
  try {
    const statuses = await replicationMonitor.getAllReplicationStatuses();
    res.json(statuses);
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to retrieve replication statuses',
      message: error.message
    });
  }
});

// Get replication status for specific database
router.get('/replication/:type/:name', async (req: Request, res: Response) => {
  try {
    const { type, name } = req.params;
    const dbKey = `${type}:${name}`;
    
    let status;
    if (type === 'postgres') {
      status = await replicationMonitor.getPostgresReplicationStatus();
    } else {
      return res.status(400).json({ error: 'Database type not supported yet' });
    }
    
    res.json(status);
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to retrieve replication status',
      message: error.message
    });
  }
});

// Get all backup statuses
router.get('/backup', async (req: Request, res: Response) => {
  try {
    const statuses = await replicationMonitor.getAllBackupStatuses();
    res.json(statuses);
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to retrieve backup statuses',
      message: error.message
    });
  }
});

// Get backup status for specific database
router.get('/backup/:type/:name', async (req: Request, res: Response) => {
  try {
    const { type, name } = req.params;
    
    let status;
    if (type === 'postgres') {
      status = await replicationMonitor.getPostgresBackupStatus();
    } else {
      return res.status(400).json({ error: 'Database type not supported yet' });
    }
    
    res.json(status);
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to retrieve backup status',
      message: error.message
    });
  }
});

// Clear replication/backup cache
router.delete('/cache', (req: Request, res: Response) => {
  try {
    replicationMonitor.clearCache();
    res.json({ success: true, message: 'Cache cleared' });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to clear cache',
      message: error.message
    });
  }
});

export default router;
