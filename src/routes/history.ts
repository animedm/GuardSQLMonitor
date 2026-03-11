import { Router, Request, Response } from 'express';
import { DatabaseMonitor } from '../services/DatabaseMonitor';

const router = Router();

// Get slow queries history
router.get('/slow-queries', (req: Request, res: Response) => {
  try {
    const dbMonitor = DatabaseMonitor.getInstance();
    const historicalDb = dbMonitor.getHistoricalDb();
    
    const {
      databaseType,
      databaseName,
      limit = '100',
      minExecutionTime
    } = req.query;

    const slowQueries = historicalDb.getSlowQueries(
      databaseType as string,
      databaseName as string,
      parseInt(limit as string),
      minExecutionTime ? parseFloat(minExecutionTime as string) : undefined
    );

    res.json(slowQueries);
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to retrieve slow queries',
      message: error.message
    });
  }
});

// Get slow queries by time range
router.get('/slow-queries/range', (req: Request, res: Response) => {
  try {
    const dbMonitor = DatabaseMonitor.getInstance();
    const historicalDb = dbMonitor.getHistoricalDb();
    
    const { startTime, endTime, databaseType, databaseName } = req.query;

    if (!startTime || !endTime) {
      return res.status(400).json({ error: 'startTime and endTime are required' });
    }

    const slowQueries = historicalDb.getSlowQueriesByTimeRange(
      startTime as string,
      endTime as string,
      databaseType as string,
      databaseName as string
    );

    res.json(slowQueries);
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to retrieve slow queries',
      message: error.message
    });
  }
});

// Get slow query statistics
router.get('/slow-queries/stats', (req: Request, res: Response) => {
  try {
    const dbMonitor = DatabaseMonitor.getInstance();
    const historicalDb = dbMonitor.getHistoricalDb();
    
    const { databaseType, databaseName } = req.query;

    const stats = historicalDb.getSlowQueryStats(
      databaseType as string,
      databaseName as string
    );

    res.json(stats || {});
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to retrieve slow query stats',
      message: error.message
    });
  }
});

// Get metrics history
router.get('/metrics', (req: Request, res: Response) => {
  try {
    const dbMonitor = DatabaseMonitor.getInstance();
    const historicalDb = dbMonitor.getHistoricalDb();
    
    const { databaseType, databaseName, hours = '24', startTime, endTime } = req.query;

    if (!databaseType || !databaseName) {
      return res.status(400).json({ error: 'databaseType and databaseName are required' });
    }

    let metrics;
    if (startTime && endTime) {
      // Use time range if provided
      metrics = historicalDb.getMetricsByTimeRange(
        databaseType as string,
        databaseName as string,
        startTime as string,
        endTime as string
      );
    } else {
      // Use hours-based query
      metrics = historicalDb.getMetricsHistory(
        databaseType as string,
        databaseName as string,
        parseInt(hours as string)
      );
    }

    res.json(metrics);
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to retrieve metrics history',
      message: error.message
    });
  }
});

// Get events
router.get('/events', (req: Request, res: Response) => {
  try {
    const dbMonitor = DatabaseMonitor.getInstance();
    const historicalDb = dbMonitor.getHistoricalDb();
    
    const { limit = '100', eventType, severity, startTime, endTime } = req.query;

    let events;
    if (startTime && endTime) {
      // Use time range if provided
      events = historicalDb.getEventsByTimeRange(
        startTime as string,
        endTime as string,
        eventType as string,
        severity as string
      );
    } else {
      // Use limit-based query
      events = historicalDb.getEvents(
        parseInt(limit as string),
        eventType as string,
        severity as string
      );
    }

    res.json(events);
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to retrieve events',
      message: error.message
    });
  }
});

// Get historical database statistics
router.get('/stats', (req: Request, res: Response) => {
  try {
    const dbMonitor = DatabaseMonitor.getInstance();
    const historicalDb = dbMonitor.getHistoricalDb();
    
    const stats = historicalDb.getDatabaseStats();
    res.json(stats || {});
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to retrieve database stats',
      message: error.message
    });
  }
});

// Trigger manual cleanup
router.post('/cleanup', (req: Request, res: Response) => {
  try {
    const dbMonitor = DatabaseMonitor.getInstance();
    const historicalDb = dbMonitor.getHistoricalDb();
    
    historicalDb.cleanupOldData();
    res.json({ success: true, message: 'Cleanup initiated' });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to cleanup',
      message: error.message
    });
  }
});

export default router;
