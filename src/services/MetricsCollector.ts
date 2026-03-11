import { Gauge, Counter, Histogram, register } from 'prom-client';
import { DatabaseMetrics } from '../types';
import { logger } from '../utils/logger';

export class MetricsCollector {
  private static instance: MetricsCollector;
  
  // Prometheus metrics
  private connectionGauge: Gauge;
  private responseTimeHistogram: Histogram;
  private queryCounter: Counter;
  private slowQueryGauge: Gauge;
  private databaseSizeGauge: Gauge;
  private cacheHitRatioGauge: Gauge;
  private uptimeGauge: Gauge;

  // In-memory metrics storage
  private metricsHistory: Map<string, DatabaseMetrics[]> = new Map();
  private readonly maxHistorySize = 1000; // Keep last 1000 metrics per database

  private constructor() {
    // Initialize Prometheus metrics
    this.connectionGauge = new Gauge({
      name: 'db_connections_total',
      help: 'Current number of database connections',
      labelNames: ['database', 'type', 'state']
    });

    this.responseTimeHistogram = new Histogram({
      name: 'db_response_time_ms',
      help: 'Database response time in milliseconds',
      labelNames: ['database', 'type'],
      buckets: [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000]
    });

    this.queryCounter = new Counter({
      name: 'db_queries_total',
      help: 'Total number of database queries',
      labelNames: ['database', 'type']
    });

    this.slowQueryGauge = new Gauge({
      name: 'db_slow_queries',
      help: 'Number of slow queries',
      labelNames: ['database', 'type']
    });

    this.databaseSizeGauge = new Gauge({
      name: 'db_size_mb',
      help: 'Database size in megabytes',
      labelNames: ['database', 'type', 'size_type']
    });

    this.cacheHitRatioGauge = new Gauge({
      name: 'db_cache_hit_ratio',
      help: 'Database cache hit ratio percentage',
      labelNames: ['database', 'type']
    });

    this.uptimeGauge = new Gauge({
      name: 'db_uptime_seconds',
      help: 'Database uptime in seconds',
      labelNames: ['database', 'type']
    });

    logger.info('Metrics collector initialized');
  }

  public static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  public recordMetrics(metrics: DatabaseMetrics): void {
    const dbKey = `${metrics.databaseType}:${metrics.databaseName}`;

    // Store in history
    if (!this.metricsHistory.has(dbKey)) {
      this.metricsHistory.set(dbKey, []);
    }
    const history = this.metricsHistory.get(dbKey)!;
    history.push(metrics);
    
    // Keep only last N metrics
    if (history.length > this.maxHistorySize) {
      history.shift();
    }

    // Update Prometheus metrics
    const labels = { database: metrics.databaseName, type: metrics.databaseType };

    // Connection metrics
    this.connectionGauge.set({ ...labels, state: 'active' }, metrics.connections.active);
    this.connectionGauge.set({ ...labels, state: 'idle' }, metrics.connections.idle);
    this.connectionGauge.set({ ...labels, state: 'total' }, metrics.connections.total);
    this.connectionGauge.set({ ...labels, state: 'max' }, metrics.connections.max);

    // Response time
    this.responseTimeHistogram.observe(labels, metrics.responseTime);

    // Slow queries
    this.slowQueryGauge.set(labels, metrics.performance.slowQueries);

    // Database size
    this.databaseSizeGauge.set({ ...labels, size_type: 'total' }, metrics.size.totalSizeMB);
    this.databaseSizeGauge.set({ ...labels, size_type: 'data' }, metrics.size.dataSize);
    this.databaseSizeGauge.set({ ...labels, size_type: 'index' }, metrics.size.indexSize);

    // Cache hit ratio
    if (metrics.resources.cacheHitRatio !== undefined) {
      this.cacheHitRatioGauge.set(labels, metrics.resources.cacheHitRatio);
    }

    // Uptime
    if (metrics.uptime !== undefined) {
      this.uptimeGauge.set(labels, metrics.uptime);
    }

    logger.debug(`Recorded metrics for ${dbKey}`);
  }

  public getMetricsHistory(databaseType: string, databaseName: string, limit?: number): DatabaseMetrics[] {
    const dbKey = `${databaseType}:${databaseName}`;
    const history = this.metricsHistory.get(dbKey) || [];
    
    if (limit) {
      return history.slice(-limit);
    }
    return history;
  }

  public getLatestMetrics(databaseType: string, databaseName: string): DatabaseMetrics | null {
    const dbKey = `${databaseType}:${databaseName}`;
    const history = this.metricsHistory.get(dbKey);
    
    if (!history || history.length === 0) {
      return null;
    }
    
    return history[history.length - 1];
  }

  public getAllLatestMetrics(): DatabaseMetrics[] {
    const latest: DatabaseMetrics[] = [];
    
    for (const history of this.metricsHistory.values()) {
      if (history.length > 0) {
        latest.push(history[history.length - 1]);
      }
    }
    
    return latest;
  }

  public getAggregatedMetrics(databaseType: string, databaseName: string, minutes: number = 5) {
    const history = this.getMetricsHistory(databaseType, databaseName);
    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);
    const recent = history.filter(m => m.timestamp >= cutoffTime);

    if (recent.length === 0) {
      return null;
    }

    const sum = recent.reduce((acc, m) => ({
      responseTime: acc.responseTime + m.responseTime,
      activeConnections: acc.activeConnections + m.connections.active,
      slowQueries: acc.slowQueries + m.performance.slowQueries
    }), { responseTime: 0, activeConnections: 0, slowQueries: 0 });

    return {
      avgResponseTime: sum.responseTime / recent.length,
      avgActiveConnections: sum.activeConnections / recent.length,
      totalSlowQueries: sum.slowQueries,
      dataPoints: recent.length,
      timeRange: minutes
    };
  }

  public clearHistory(databaseType?: string, databaseName?: string): void {
    if (databaseType && databaseName) {
      const dbKey = `${databaseType}:${databaseName}`;
      this.metricsHistory.delete(dbKey);
      logger.info(`Cleared metrics history for ${dbKey}`);
    } else {
      this.metricsHistory.clear();
      logger.info('Cleared all metrics history');
    }
  }
}
