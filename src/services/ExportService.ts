import ExcelJS from 'exceljs';
import { logger } from '../utils/logger';
import { HistoricalDatabase } from './HistoricalDatabase';

export interface ExportOptions {
  startDate?: string;
  endDate?: string;
  databaseType?: string;
  databaseName?: string;
}

export class ExportService {
  private historicalDb: HistoricalDatabase;

  constructor(historicalDb: HistoricalDatabase) {
    this.historicalDb = historicalDb;
  }

  async exportMetricsToExcel(options: ExportOptions): Promise<Buffer> {
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'GuardSQL Monitor';
      workbook.created = new Date();

      // Metrics Sheet
      const metricsSheet = workbook.addWorksheet('Metrics History', {
        properties: { tabColor: { argb: 'FF00FF00' } }
      });

      // Define columns
      metricsSheet.columns = [
        { header: 'Timestamp', key: 'timestamp', width: 20 },
        { header: 'Database', key: 'database', width: 20 },
        { header: 'Connections (Total)', key: 'connections_total', width: 18 },
        { header: 'Connections (Active)', key: 'connections_active', width: 20 },
        { header: 'Response Time (ms)', key: 'response_time', width: 18 },
        { header: 'QPS', key: 'qps', width: 12 },
        { header: 'Cache Hit %', key: 'cache_hit_ratio', width: 15 },
        { header: 'DB Size (MB)', key: 'database_size', width: 15 },
        { header: 'Slow Queries', key: 'slow_queries', width: 15 }
      ];

      // Style header row
      metricsSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      metricsSheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' }
      };

      // Get metrics data
      let metrics;
      if (options.startDate && options.endDate && options.databaseType && options.databaseName) {
        metrics = this.historicalDb.getMetricsByTimeRange(
          options.databaseType,
          options.databaseName,
          options.startDate,
          options.endDate
        );
      } else if (options.databaseType && options.databaseName) {
        metrics = this.historicalDb.getMetricsHistory(
          options.databaseType,
          options.databaseName,
          24 * 30 // Last 30 days
        );
      } else {
        metrics = [];
      }

      // Add data rows
      metrics.forEach((record: any) => {
        metricsSheet.addRow({
          timestamp: new Date(record.timestamp).toLocaleString(),
          database: `${record.database_type}/${record.database_name}`,
          connections_total: record.connections_total,
          connections_active: record.connections_active,
          response_time: record.response_time?.toFixed(2) || 'N/A',
          qps: record.qps?.toFixed(2) || 'N/A',
          cache_hit_ratio: record.cache_hit_ratio ? `${record.cache_hit_ratio.toFixed(2)}%` : 'N/A',
          database_size: record.database_size?.toFixed(2) || 'N/A',
          slow_queries: record.slow_queries || 0
        });
      });

      // Slow Queries Sheet
      const slowQueriesSheet = workbook.addWorksheet('Slow Queries', {
        properties: { tabColor: { argb: 'FFFF0000' } }
      });

      slowQueriesSheet.columns = [
        { header: 'Timestamp', key: 'timestamp', width: 20 },
        { header: 'Database', key: 'database', width: 20 },
        { header: 'Execution Time (ms)', key: 'execution_time', width: 20 },
        { header: 'User', key: 'username', width: 15 },
        { header: 'Client', key: 'client_address', width: 20 },
        { header: 'Rows', key: 'rows_affected', width: 12 },
        { header: 'Query', key: 'query', width: 60 }
      ];

      slowQueriesSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      slowQueriesSheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFF0000' }
      };

      // Get slow queries data
      let slowQueries;
      if (options.startDate && options.endDate && options.databaseType && options.databaseName) {
        slowQueries = this.historicalDb.getSlowQueriesByTimeRange(
          options.startDate,
          options.endDate,
          options.databaseType,
          options.databaseName
        );
      } else if (options.databaseType && options.databaseName) {
        slowQueries = this.historicalDb.getSlowQueries(
          options.databaseType,
          options.databaseName,
          100
        );
      } else {
        slowQueries = [];
      }

      slowQueries.forEach((record: any) => {
        slowQueriesSheet.addRow({
          timestamp: new Date(record.timestamp).toLocaleString(),
          database: `${record.database_type}/${record.database_name}`,
          execution_time: record.execution_time.toFixed(2),
          username: record.username || 'N/A',
          client_address: record.client_address || 'N/A',
          rows_affected: record.rows_affected || 0,
          query: record.query
        });
      });

      // Events Sheet
      const eventsSheet = workbook.addWorksheet('Events', {
        properties: { tabColor: { argb: 'FFFFA500' } }
      });

      eventsSheet.columns = [
        { header: 'Timestamp', key: 'timestamp', width: 20 },
        { header: 'Type', key: 'event_type', width: 20 },
        { header: 'Severity', key: 'severity', width: 12 },
        { header: 'Database', key: 'database', width: 20 },
        { header: 'Message', key: 'message', width: 50 },
        { header: 'Details', key: 'details', width: 60 }
      ];

      eventsSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      eventsSheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFA500' }
      };

      // Get events data
      let events;
      if (options.startDate && options.endDate) {
        events = this.historicalDb.getEventsByTimeRange(
          options.startDate,
          options.endDate
        );
      } else {
        events = this.historicalDb.getEvents(1000);
      }

      events.forEach((record: any) => {
        eventsSheet.addRow({
          timestamp: new Date(record.timestamp).toLocaleString(),
          event_type: record.event_type,
          severity: record.severity.toUpperCase(),
          database: record.database_type && record.database_name 
            ? `${record.database_type}/${record.database_name}` 
            : 'N/A',
          message: record.message,
          details: record.details || ''
        });
      });

      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer();
      return buffer as Buffer;
    } catch (error: any) {
      logger.error('Error exporting to Excel:', error);
      throw new Error(`Failed to export to Excel: ${error.message}`);
    }
  }

  async exportSlowQueriesToCSV(options: ExportOptions): Promise<string> {
    try {
      let slowQueries;
      if (options.startDate && options.endDate && options.databaseType && options.databaseName) {
        slowQueries = this.historicalDb.getSlowQueriesByTimeRange(
          options.startDate,
          options.endDate,
          options.databaseType,
          options.databaseName
        );
      } else if (options.databaseType && options.databaseName) {
        slowQueries = this.historicalDb.getSlowQueries(
          options.databaseType,
          options.databaseName,
          1000
        );
      } else {
        slowQueries = [];
      }

      // CSV header
      let csv = 'Timestamp,Database Type,Database Name,Execution Time (ms),Username,Client,Rows,Query\n';

      // CSV rows
      slowQueries.forEach((record: any) => {
        const query = record.query.replace(/"/g, '""'); // Escape quotes
        csv += `"${new Date(record.timestamp).toISOString()}",`;
        csv += `"${record.database_type}",`;
        csv += `"${record.database_name}",`;
        csv += `${record.execution_time},`;
        csv += `"${record.username || 'N/A'}",`;
        csv += `"${record.client_address || 'N/A'}",`;
        csv += `${record.rows_affected || 0},`;
        csv += `"${query}"\n`;
      });

      return csv;
    } catch (error: any) {
      logger.error('Error exporting to CSV:', error);
      throw new Error(`Failed to export to CSV: ${error.message}`);
    }
  }

  async exportMetricsToCSV(options: ExportOptions): Promise<string> {
    try {
      let metrics;
      if (options.startDate && options.endDate && options.databaseType && options.databaseName) {
        metrics = this.historicalDb.getMetricsByTimeRange(
          options.databaseType,
          options.databaseName,
          options.startDate,
          options.endDate
        );
      } else if (options.databaseType && options.databaseName) {
        metrics = this.historicalDb.getMetricsHistory(
          options.databaseType,
          options.databaseName,
          24 * 30
        );
      } else {
        metrics = [];
      }

      // CSV header
      let csv = 'Timestamp,Database Type,Database Name,Connections Total,Connections Active,Response Time (ms),QPS,Cache Hit Ratio (%),DB Size (MB),Slow Queries\n';

      // CSV rows
      metrics.forEach((record: any) => {
        csv += `"${new Date(record.timestamp).toISOString()}",`;
        csv += `"${record.database_type}",`;
        csv += `"${record.database_name}",`;
        csv += `${record.connections_total},`;
        csv += `${record.connections_active},`;
        csv += `${record.response_time || 0},`;
        csv += `${record.qps || 0},`;
        csv += `${record.cache_hit_ratio || 0},`;
        csv += `${record.database_size || 0},`;
        csv += `${record.slow_queries || 0}\n`;
      });

      return csv;
    } catch (error: any) {
      logger.error('Error exporting metrics to CSV:', error);
      throw new Error(`Failed to export metrics to CSV: ${error.message}`);
    }
  }
}

export default ExportService;
