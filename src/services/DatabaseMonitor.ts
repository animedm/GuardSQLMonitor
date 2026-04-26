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
import {
  AlertThresholds,
  GlobalAlertSettings,
  ManagedConnection,
  loadManagedConfiguration,
  applyPrimaryConnectionsToRuntimeConfig
} from '../config/connections';

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
      const managedConnections = loadManagedConfiguration().connections;
      applyPrimaryConnectionsToRuntimeConfig(managedConnections);

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
    const managedConfig = loadManagedConfiguration();
    const connections = managedConfig.connections.filter((conn) => conn.enabled);

    try {
      for (const conn of connections) {
        try {
          let dbMetrics: DatabaseMetrics;

          if (conn.type === 'postgres') {
            dbMetrics = await this.pgConnector.getMetricsForConnection(conn);
          } else if (conn.type === 'mysql') {
            dbMetrics = await this.mysqlConnector.getMetricsForConnection(conn);
          } else {
            dbMetrics = await this.mssqlConnector.getMetricsForConnection(conn);
          }

          metrics.push(dbMetrics);
          this.metricsCollector.recordMetrics(dbMetrics);
          this.checkThresholds(conn, dbMetrics, managedConfig.alerts);

          this.saveMetricsToHistory(dbMetrics);
          await this.saveSlowQueriesToHistory(conn, dbMetrics.databaseName);
        } catch (error) {
          logger.error(`Error collecting ${conn.type} metrics for ${conn.name}:`, error);
        }
      }

      logger.debug(`Collected metrics for ${metrics.length} database(s)`);
    } catch (error) {
      logger.error('Error in metrics collection:', error);
    }
  }

  private getEffectiveThresholds(connection: ManagedConnection, globalAlerts: GlobalAlertSettings): AlertThresholds {
    const overrides = connection.alertSettings?.thresholds || {};
    return {
      cpu: overrides.cpu ?? globalAlerts.thresholds.cpu,
      memory: overrides.memory ?? globalAlerts.thresholds.memory,
      connections: overrides.connections ?? globalAlerts.thresholds.connections,
      slowQueryCount: overrides.slowQueryCount ?? globalAlerts.thresholds.slowQueryCount
    };
  }

  private isConnectionAlertSnoozed(connection: ManagedConnection): boolean {
    const snoozedUntil = connection.alertSettings?.snoozedUntil;
    if (!snoozedUntil) {
      return false;
    }

    const snoozeTime = Date.parse(snoozedUntil);
    if (Number.isNaN(snoozeTime)) {
      return false;
    }

    return Date.now() < snoozeTime;
  }

  private isHourInRange(currentHour: number, startHour: number, endHour: number): boolean {
    if (startHour === endHour) {
      return true;
    }
    if (startHour < endHour) {
      return currentHour >= startHour && currentHour < endHour;
    }
    return currentHour >= startHour || currentHour < endHour;
  }

  private isMetricMutedInMaintenance(
    connection: ManagedConnection,
    metric: 'cpu' | 'memory' | 'connections' | 'slowQueryCount'
  ): boolean {
    const mutedMetrics = connection.alertSettings?.maintenanceWindow?.mutedMetrics;
    if (!mutedMetrics) {
      return true;
    }
    return mutedMetrics[metric] !== false;
  }

  private isConnectionInMaintenanceWindow(connection: ManagedConnection): boolean {
    const windowConfig = connection.alertSettings?.maintenanceWindow;
    if (!windowConfig || !windowConfig.enabled) {
      return false;
    }

    const now = new Date();
    const day = now.getDay();
    const allowedDays = windowConfig.daysOfWeek || [];
    if (allowedDays.length > 0 && !allowedDays.includes(day)) {
      return false;
    }

    const hour = now.getHours();
    return this.isHourInRange(hour, windowConfig.startHour, windowConfig.endHour);
  }

  private checkThresholds(connection: ManagedConnection, metrics: DatabaseMetrics, globalAlerts: GlobalAlertSettings): void {
    if (!globalAlerts.enabled) {
      return;
    }

    if (connection.alertSettings && !connection.alertSettings.enabled) {
      return;
    }

    if (this.isConnectionAlertSnoozed(connection)) {
      return;
    }

    const inMaintenance = this.isConnectionInMaintenanceWindow(connection);

    const thresholds = this.getEffectiveThresholds(connection, globalAlerts);
    const cooldownMs = globalAlerts.cooldownMinutes * 60 * 1000;
    const notifyEmail = {
      enabled: globalAlerts.email.enabled,
      to: globalAlerts.email.to
    };
    const notifyWebhook = {
      enabled: globalAlerts.webhook.enabled,
      url: globalAlerts.webhook.url
    };

    // Check connection pool usage
    const connectionUsagePercent = (metrics.connections.total / metrics.connections.max) * 100;
    if (connectionUsagePercent >= thresholds.connections && !(inMaintenance && this.isMetricMutedInMaintenance(connection, 'connections'))) {
      this.alertSystem.createAlert({
        severity: connectionUsagePercent >= 95 ? 'critical' : 'warning',
        database: metrics.databaseName,
        type: 'high_connection_usage',
        message: `Connection pool usage is at ${connectionUsagePercent.toFixed(1)}%`,
        metric: 'connection_usage',
        value: connectionUsagePercent,
        threshold: thresholds.connections,
        cooldownMs,
        notifyEmail,
        notifyWebhook
      });
    }

    // Check slow queries
    if (metrics.performance.slowQueries >= thresholds.slowQueryCount && !(inMaintenance && this.isMetricMutedInMaintenance(connection, 'slowQueryCount'))) {
      this.alertSystem.createAlert({
        severity: 'warning',
        database: metrics.databaseName,
        type: 'slow_queries',
        message: `${metrics.performance.slowQueries} slow queries detected`,
        metric: 'slow_queries',
        value: metrics.performance.slowQueries,
        threshold: thresholds.slowQueryCount,
        cooldownMs,
        notifyEmail,
        notifyWebhook
      });
    }

    // Check CPU usage
    if (
      metrics.resources.cpuUsage &&
      metrics.resources.cpuUsage >= thresholds.cpu &&
      !(inMaintenance && this.isMetricMutedInMaintenance(connection, 'cpu'))
    ) {
      this.alertSystem.createAlert({
        severity: metrics.resources.cpuUsage >= 90 ? 'critical' : 'warning',
        database: metrics.databaseName,
        type: 'high_cpu_usage',
        message: `CPU usage is at ${metrics.resources.cpuUsage.toFixed(1)}%`,
        metric: 'cpu_usage',
        value: metrics.resources.cpuUsage,
        threshold: thresholds.cpu,
        cooldownMs,
        notifyEmail,
        notifyWebhook
      });
    }

    // Check memory usage
    if (
      metrics.resources.memoryUsage &&
      metrics.resources.memoryUsage >= thresholds.memory &&
      !(inMaintenance && this.isMetricMutedInMaintenance(connection, 'memory'))
    ) {
      this.alertSystem.createAlert({
        severity: metrics.resources.memoryUsage >= 95 ? 'critical' : 'warning',
        database: metrics.databaseName,
        type: 'high_memory_usage',
        message: `Memory usage is at ${metrics.resources.memoryUsage.toFixed(1)}%`,
        metric: 'memory_usage',
        value: metrics.resources.memoryUsage,
        threshold: thresholds.memory,
        cooldownMs,
        notifyEmail,
        notifyWebhook
      });
    }
  }

  public async getHealthStatus() {
    const databases: any = {};

    const connections = loadManagedConfiguration().connections.filter((conn) => conn.enabled);

    for (const conn of connections) {
      const key = `${conn.type}:${conn.name}`;
      if (conn.type === 'postgres') {
        databases[key] = await this.pgConnector.healthCheckForConnection(conn);
      } else if (conn.type === 'mysql') {
        databases[key] = await this.mysqlConnector.healthCheckForConnection(conn);
      } else {
        databases[key] = await this.mssqlConnector.healthCheckForConnection(conn);
      }
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

  private async saveSlowQueriesToHistory(conn: ManagedConnection, dbName: string): Promise<void> {
    try {
      let slowQueries: any[] = [];

      if (conn.type === 'postgres') {
        slowQueries = await this.pgConnector.getSlowQueriesForConnection(conn);
      } else if (conn.type === 'mysql') {
        slowQueries = await this.mysqlConnector.getSlowQueriesForConnection(conn);
      } else if (conn.type === 'mssql') {
        slowQueries = await this.mssqlConnector.getSlowQueriesForConnection(conn);
      }

      for (const query of slowQueries) {
        this.historicalDb.saveSlowQuery({
          timestamp: new Date().toISOString(),
          databaseType: conn.type,
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
            databaseType: conn.type,
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
