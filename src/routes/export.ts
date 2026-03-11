import { Router, Request, Response } from 'express';
import { DatabaseMonitor } from '../services/DatabaseMonitor';
import ExportService from '../services/ExportService';
import { logger } from '../utils/logger';

const router = Router();

// Export metrics to Excel
router.get('/excel', async (req: Request, res: Response) => {
  try {
    const dbMonitor = DatabaseMonitor.getInstance();
    const historicalDb = dbMonitor.getHistoricalDb();
    const exportService = new ExportService(historicalDb);

    const { startDate, endDate, databaseType, databaseName } = req.query;

    const buffer = await exportService.exportMetricsToExcel({
      startDate: startDate as string,
      endDate: endDate as string,
      databaseType: databaseType as string,
      databaseName: databaseName as string
    });

    const filename = `guardsql-report-${new Date().toISOString().split('T')[0]}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error: any) {
    logger.error('Error exporting to Excel:', error);
    res.status(500).json({
      error: 'Failed to export to Excel',
      message: error.message
    });
  }
});

// Export slow queries to CSV
router.get('/slow-queries/csv', async (req: Request, res: Response) => {
  try {
    const dbMonitor = DatabaseMonitor.getInstance();
    const historicalDb = dbMonitor.getHistoricalDb();
    const exportService = new ExportService(historicalDb);

    const { startDate, endDate, databaseType, databaseName } = req.query;

    const csv = await exportService.exportSlowQueriesToCSV({
      startDate: startDate as string,
      endDate: endDate as string,
      databaseType: databaseType as string,
      databaseName: databaseName as string
    });

    const filename = `slow-queries-${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error: any) {
    logger.error('Error exporting slow queries to CSV:', error);
    res.status(500).json({
      error: 'Failed to export to CSV',
      message: error.message
    });
  }
});

// Export metrics to CSV
router.get('/metrics/csv', async (req: Request, res: Response) => {
  try {
    const dbMonitor = DatabaseMonitor.getInstance();
    const historicalDb = dbMonitor.getHistoricalDb();
    const exportService = new ExportService(historicalDb);

    const { startDate, endDate, databaseType, databaseName } = req.query;

    const csv = await exportService.exportMetricsToCSV({
      startDate: startDate as string,
      endDate: endDate as string,
      databaseType: databaseType as string,
      databaseName: databaseName as string
    });

    const filename = `metrics-${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error: any) {
    logger.error('Error exporting metrics to CSV:', error);
    res.status(500).json({
      error: 'Failed to export to CSV',
      message: error.message
    });
  }
});

export default router;
