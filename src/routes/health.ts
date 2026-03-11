import { Router, Request, Response } from 'express';
import { DatabaseMonitor } from '../services/DatabaseMonitor';

const router = Router();
const dbMonitor = DatabaseMonitor.getInstance();

router.get('/', async (req: Request, res: Response) => {
  try {
    const health = await dbMonitor.getHealthStatus();
    const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 206 : 503;
    res.status(statusCode).json(health);
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

router.get('/ready', async (req: Request, res: Response) => {
  try {
    const health = await dbMonitor.getHealthStatus();
    const ready = health.status !== 'unhealthy';
    res.status(ready ? 200 : 503).json({ ready });
  } catch (error) {
    res.status(503).json({ ready: false });
  }
});

router.get('/live', (req: Request, res: Response) => {
  res.status(200).json({ alive: true });
});

export default router;
