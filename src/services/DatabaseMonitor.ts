import cron from 'node-cron';
import { config } from '../config';
import { logger } from '../utils/logger';
import { PostgresConnector } from '../connectors/PostgresConnector';
import { MySQLConnector } from '../connectors/MySQLConnector';
import { MSSQLConnector } from '../connectors/MSSQLConnector';
import { MetricsCollector } from './MetricsCollector';
import { AlertSystem } from './AlertSystem';
import { HistoricalDatabase } from './HistoricalDatabase';
import { DatabaseMetrics } from '../types';

export class DatabaseMonitor {
  private static instance: DatabaseMonitor;
  private metricsCollector: MetricsCollector;
  private alertSystem: AlertSystem;
  private historicalDb: HistoricalDatabase;
  private pgConnector: PostgresConnector;
  private mysqlConnector: MySQLConnector;
  private mssqlConnector: MSSQLConnector;
  private monitoringTask: cron.ScheduledTask | null = null;
  private isRunning: boolean = false;

  private constructor() {
    this.metricsCollector = MetricsCollector.getInstance();
    this.alertSystem = AlertSystem.getInstance();
    this.historicalDb = HistoricalDatabase.getInstance();
    this.pgConnector = PostgresConnector.getInstance();
    this.mysqlConnector = MySQLConnector.getInstance();
    this.mssqlConnector = MSSQLConnector.getInstance();
  }

  public static getInstance(): DatabaseMonitor {
    if (!DatabaseMonitor.instance) {
      DatabaseMonitor.instance = new DatabaseMonitor();
    }
    return DatabaseMonitor.instance;
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Database monitor is already running');
      return;
    }

    try {
      // Initialize database connections
      if (config.databases.postgres.enabled) {
        await this.pgConnector.connect();
      }
      if (config.databases.mysql.enabled) {
        await this.mysqlConnector.connect();
      }
      if (config.databases.mssql.enabled) {
        await this.mssqlConnector.connect();
      }

      // Start periodic monitoring
      const intervalSeconds = Math.floor(config.monitoring.metricsInterval / 1000);
      this.monitoringTask = cron.schedule(`*/${intervalSeconds} * * * * *`, async () => {
        await this.collectMetrics();
      });

      this.isRunning = true;
      logger.info('🔍 Database monitoring service started');

      // Collect initial metrics
      await this.collectMetrics();
    } catch (error) {
      logger.error('Failed to start database monitor:', error);
      throw error;
    }
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    if (this.monitoringTask) {
      this.monitoringTask.stop();
      this.monitoringTask = null;
    }

    // Disconnect from databases
    await this.pgConnector.disconnect();
    await this.mysqlConnector.disconnect();
    await this.mssqlConnector.disconnect();

    this.isRunning = false;
    logger.info('Database monitoring service stopped');
  }

  private async collectMetrics(): Promise<void> {
    const metrics: DatabaseMetrics[] = [];

    try {
      // Collect PostgreSQL metrics
      if (config.databases.postgres.enabled) {
        try {
          const pgMetrics = await this.pgConnector.getMetrics();
          metrics.push(pgMetrics);
          this.metricsCollector.recordMetrics(pgMetrics);
          this.checkThresholds(pgMetrics);
          
          // Save to historical database
          this.saveMetricsToHistory(pgMetrics);
          await this.saveSlowQueriesToHistory('postgres', pgMetrics.databaseName);
        } catch (error) {
          logger.error('Error collecting PostgreSQL metrics:', error);
        }
      }

      // Collect MySQL metrics
      if (config.databases.mysql.enabled) {
        try {
          const mysqlMetrics = await this.mysqlConnector.getMetrics();
          metrics.push(mysqlMetrics);
          this.metricsCollector.recordMetrics(mysqlMetrics);
          this.checkThresholds(mysqlMetrics);
          
          // Save to historical database
          this.saveMetricsToHistory(mysqlMetrics);
          await this.saveSlowQueriesToHistory('mysql', mysqlMetrics.databaseName);
        } catch (error) {
          logger.error('Error collecting MySQL metrics:', error);
        }
      }

      // Collect SQL Server metrics
      if (config.databases.mssql.enabled) {
        try {
          const mssqlMetrics = await this.mssqlConnector.getMetrics();
          metrics.push(mssqlMetrics);
          this.metricsCollector.recordMetrics(mssqlMetrics);
          this.checkThresholds(mssqlMetrics);
          
          // Save to historical database
          this.saveMetricsToHistory(mssqlMetrics);
          await this.saveSlowQueriesToHistory('mssql', mssqlMetrics.databaseName);
        } catch (error) {
          logger.error('Error collecting SQL Server metrics:', error);
        }
      }

      logger.debug(`Collected metrics for ${metrics.length} database(s)`);
    } catch (error) {
      logger.error('Error in metrics collection:', error);
    }
  }

  private checkThresholds(metrics: DatabaseMetrics): void {
    const thresholds = config.alerts.thresholds;

    // Check connection pool usage
    const connectionUsagePercent = (metrics.connections.total / metrics.connections.max) * 100;
    if (connectionUsagePercent >= thresholds.connections) {
      this.alertSystem.createAlert({
        severity: connectionUsagePercent >= 95 ? 'critical' : 'warning',
        database: metrics.databaseName,
        type: 'high_connection_usage',
        message: `Connection pool usage is at ${connectionUsagePercent.toFixed(1)}%`,
        metric: 'connection_usage',
        value: connectionUsagePercent,
        threshold: thresholds.connections
      });
    }

    // Check slow queries
    if (metrics.performance.slowQueries >= thresholds.slowQueryCount) {
      this.alertSystem.createAlert({
        severity: 'warning',
        database: metrics.databaseName,
        type: 'slow_queries',
        message: `${metrics.performance.slowQueries} slow queries detected`,
        metric: 'slow_queries',
        value: metrics.performance.slowQueries,
        threshold: thresholds.slowQueryCount
      });
    }

    // Check CPU usage
    if (metrics.resources.cpuUsage && metrics.resources.cpuUsage >= thresholds.cpu) {
      this.alertSystem.createAlert({
        severity: metrics.resources.cpuUsage >= 90 ? 'critical' : 'warning',
        database: metrics.databaseName,
        type: 'high_cpu_usage',
        message: `CPU usage is at ${metrics.resources.cpuUsage.toFixed(1)}%`,
        metric: 'cpu_usage',
        value: metrics.resources.cpuUsage,
        threshold: thresholds.cpu
      });
    }

    // Check memory usage
    if (metrics.resources.memoryUsage && metrics.resources.memoryUsage >= thresholds.memory) {
      this.alertSystem.createAlert({
        severity: metrics.resources.memoryUsage >= 95 ? 'critical' : 'warning',
        database: metrics.databaseName,
        type: 'high_memory_usage',
        message: `Memory usage is at ${metrics.resources.memoryUsage.toFixed(1)}%`,
        metric: 'memory_usage',
        value: metrics.resources.memoryUsage,
        threshold: thresholds.memory
      });
    }
  }

  public async getHealthStatus() {
    const databases: any = {};

    if (config.databases.postgres.enabled) {
      databases.postgres = await this.pgConnector.healthCheck();
    }
    if (config.databases.mysql.enabled) {
      databases.mysql = await this.mysqlConnector.healthCheck();
    }
    if (config.databases.mssql.enabled) {
      databases.mssql = await this.mssqlConnector.healthCheck();
    }

    const allHealthy = Object.values(databases).every((db: any) => db.status === 'up');
    const someHealthy = Object.values(databases).some((db: any) => db.status === 'up');

    return {
      status: allHealthy ? 'healthy' : someHealthy ? 'degraded' : 'unhealthy',
      timestamp: new Date(),
      databases,
      uptime: process.uptime()
    };
  }

  private saveMetricsToHistory(metrics: DatabaseMetrics): void {
    try {
      this.historicalDb.saveMetrics({
        timestamp: metrics.timestamp.toISOString(),
        databaseType: metrics.databaseType,
        databaseName: metrics.databaseName,
        connectionsTotal: metrics.connections.total,
        connectionsActive: metrics.connections.active,
        connectionsIdle: metrics.connections.idle,
        responseTime: metrics.responseTime,
        qps: metrics.performance.queriesPerSecond,
        cacheHitRatio: metrics.resources.cacheHitRatio,
        databaseSize: metrics.size.totalSizeMB,
        slowQueries: metrics.performance.slowQueries
      });
    } catch (error) {
      logger.error('Error saving metrics to history:', error);
    }
  }

  private async saveSlowQueriesToHistory(dbType: string, dbName: string): Promise<void> {
    try {
      let slowQueries: any[] = [];

      if (dbType === 'postgres') {
        slowQueries = await this.pgConnector.getSlowQueries();
      } else if (dbType === 'mysql') {
        slowQueries = await this.mysqlConnector.getSlowQueries();
      } else if (dbType === 'mssql') {
        slowQueries = await this.mssqlConnector.getSlowQueries();
      }

      for (const query of slowQueries) {
        this.historicalDb.saveSlowQuery({
          timestamp: new Date().toISOString(),
          databaseType: dbType,
          databaseName: dbName,
          query: query.query || query.sql || '',
          executionTime: query.totalTime || query.executionTime || query.duration || 0,
          user: query.user || query.username,
          client: query.client || query.host,
          rows: query.rows
        });

        // Save as event if execution time is very high
        if ((query.totalTime || query.executionTime || query.duration || 0) > 10000) {
          this.historicalDb.saveEvent({
            timestamp: new Date().toISOString(),
            eventType: 'alert',
            severity: 'warning',
            databaseType: dbType,
            databaseName: dbName,
            message: `Very slow query detected (${(query.totalTime || query.executionTime).toFixed(0)}ms)`,
            details: query.query || query.sql || ''
          });
        }
      }
    } catch (error) {
      logger.error('Error saving slow queries to history:', error);
    }
  }

  public getHistoricalDb(): HistoricalDatabase {
    return this.historicalDb;
  }

  public getPostgresPool() {
    return this.pgConnector.getPool();
  }

  public getMySQLPool() {
    return this.mysqlConnector.getPool();
  }
}
