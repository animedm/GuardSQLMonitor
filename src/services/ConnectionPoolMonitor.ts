import { Pool } from 'pg';
import { Connection } from 'mysql2/promise';
import { logger } from '../utils/logger';

export interface PoolStats {
  databaseType: string;
  databaseName: string;
  timestamp: Date;
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingClients: number;
  maxConnections: number;
  utilizationPercent: number;
  poolExhausted: boolean;
  avgWaitTime?: number;
  connectionLeaks?: ConnectionLeak[];
  warnings: string[];
  recommendations: string[];
}

export interface ConnectionLeak {
  pid: number;
  user: string;
  application: string;
  query: string;
  idleTime: number;
  state: string;
}

export interface PoolMetrics {
  timestamp: Date;
  active: number;
  idle: number;
  total: number;
  waiting: number;
  utilization: number;
}

export class ConnectionPoolMonitor {
  private metricsHistory: Map<string, PoolMetrics[]> = new Map();
  private readonly MAX_HISTORY = 100;
  private readonly LEAK_THRESHOLD_SECONDS = 300; // 5 minutes
  private readonly HIGH_UTILIZATION_THRESHOLD = 80; // 80%

  /**
   * Monitor PostgreSQL connection pool
   */
  async monitorPostgresPool(pool: Pool, dbName: string, maxConnections: number): Promise<PoolStats> {
    try {
      // Get connection statistics
      const statsResult = await pool.query(`
        SELECT 
          COUNT(*) as total_connections,
          COUNT(*) FILTER (WHERE state = 'active') as active_connections,
          COUNT(*) FILTER (WHERE state = 'idle') as idle_connections,
          COUNT(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction,
          COUNT(*) FILTER (WHERE wait_event IS NOT NULL) as waiting_connections
        FROM pg_stat_activity
        WHERE datname = $1;
      `, [dbName]);

      const stats = statsResult.rows[0];
      const totalConnections = parseInt(stats.total_connections);
      const activeConnections = parseInt(stats.active_connections);
      const idleConnections = parseInt(stats.idle_connections);
      const waitingConnections = parseInt(stats.waiting_connections);

      // Get max connections from PostgreSQL config
      const maxConnResult = await pool.query('SHOW max_connections;');
      const dbMaxConnections = parseInt(maxConnResult.rows[0].max_connections);
      const effectiveMax = maxConnections || dbMaxConnections;

      const utilizationPercent = (totalConnections / effectiveMax) * 100;
      const poolExhausted = utilizationPercent >= 95;

      // Detect connection leaks (idle transactions)
      const leaksResult = await pool.query(`
        SELECT 
          pid,
          usename as user,
          application_name as application,
          state,
          query,
          EXTRACT(EPOCH FROM (NOW() - state_change))::int as idle_seconds
        FROM pg_stat_activity
        WHERE datname = $1
          AND state = 'idle in transaction'
          AND EXTRACT(EPOCH FROM (NOW() - state_change)) > $2
        ORDER BY idle_seconds DESC;
      `, [dbName, this.LEAK_THRESHOLD_SECONDS]);

      const connectionLeaks: ConnectionLeak[] = leaksResult.rows.map((row: any) => ({
        pid: row.pid,
        user: row.user,
        application: row.application || 'unknown',
        query: row.query || 'N/A',
        idleTime: row.idle_seconds,
        state: row.state
      }));

      // Generate warnings
      const warnings: string[] = [];
      if (poolExhausted) {
        warnings.push('🚨 Connection pool exhausted! Near maximum capacity.');
      }
      if (utilizationPercent >= this.HIGH_UTILIZATION_THRESHOLD) {
        warnings.push(`⚠️ High pool utilization: ${utilizationPercent.toFixed(1)}%`);
      }
      if (connectionLeaks.length > 0) {
        warnings.push(`🔴 ${connectionLeaks.length} potential connection leak(s) detected`);
      }
      if (parseInt(stats.idle_in_transaction) > 5) {
        warnings.push(`⏸️ ${stats.idle_in_transaction} connections idle in transaction`);
      }

      // Generate recommendations
      const recommendations: string[] = [];
      if (poolExhausted) {
        recommendations.push('Increase max_connections in PostgreSQL config or connection pool size');
        recommendations.push('Review and optimize long-running queries');
      }
      if (connectionLeaks.length > 0) {
        recommendations.push('Enable connection timeout in your application');
        recommendations.push('Use connection pooling libraries with automatic release');
        recommendations.push('Review transaction management in the application');
      }
      if (utilizationPercent >= this.HIGH_UTILIZATION_THRESHOLD) {
        recommendations.push('Consider implementing connection pooling if not already in use');
        recommendations.push('Use read replicas to distribute load');
      }

      const poolStats: PoolStats = {
        databaseType: 'postgres',
        databaseName: dbName,
        timestamp: new Date(),
        totalConnections,
        activeConnections,
        idleConnections,
        waitingClients: waitingConnections,
        maxConnections: effectiveMax,
        utilizationPercent,
        poolExhausted,
        connectionLeaks,
        warnings,
        recommendations
      };

      // Update metrics history
      this.updateMetricsHistory(dbName, {
        timestamp: new Date(),
        active: activeConnections,
        idle: idleConnections,
        total: totalConnections,
        waiting: waitingConnections,
        utilization: utilizationPercent
      });

      return poolStats;
    } catch (error: any) {
      logger.error('Error monitoring PostgreSQL pool:', error);
      throw error;
    }
  }

  /**
   * Monitor MySQL connection pool
   */
  async monitorMySQLPool(connection: Connection, dbName: string, maxConnections: number): Promise<PoolStats> {
    try {
      // Get process list
      const [processes]: any = await connection.query('SHOW FULL PROCESSLIST');
      
      const totalConnections = processes.length;
      const activeConnections = processes.filter((p: any) => 
        p.Command !== 'Sleep' && p.State !== null
      ).length;
      const idleConnections = processes.filter((p: any) => 
        p.Command === 'Sleep'
      ).length;

      // Get max connections
      const [maxConnRows]: any = await connection.query('SHOW VARIABLES LIKE "max_connections"');
      const dbMaxConnections = parseInt(maxConnRows[0].Value);
      const effectiveMax = maxConnections || dbMaxConnections;

      const utilizationPercent = (totalConnections / effectiveMax) * 100;
      const poolExhausted = utilizationPercent >= 95;

      // Detect connection leaks (sleeping for too long)
      const connectionLeaks: ConnectionLeak[] = processes
        .filter((p: any) => p.Command === 'Sleep' && p.Time > this.LEAK_THRESHOLD_SECONDS)
        .map((p: any) => ({
          pid: p.Id,
          user: p.User,
          application: p.Host || 'unknown',
          query: p.Info || 'N/A',
          idleTime: p.Time,
          state: 'Sleep'
        }));

      // Get threads connected
      const [statusRows]: any = await connection.query("SHOW STATUS LIKE 'Threads_connected'");
      const threadsConnected = parseInt(statusRows[0].Value);

      // Generate warnings
      const warnings: string[] = [];
      if (poolExhausted) {
        warnings.push('🚨 Connection pool exhausted! Near maximum capacity.');
      }
      if (utilizationPercent >= this.HIGH_UTILIZATION_THRESHOLD) {
        warnings.push(`⚠️ High pool utilization: ${utilizationPercent.toFixed(1)}%`);
      }
      if (connectionLeaks.length > 0) {
        warnings.push(`🔴 ${connectionLeaks.length} potential connection leak(s) detected`);
      }

      // Generate recommendations
      const recommendations: string[] = [];
      if (poolExhausted) {
        recommendations.push('Increase max_connections in MySQL config');
        recommendations.push('Optimize queries to reduce connection hold time');
      }
      if (connectionLeaks.length > 0) {
        recommendations.push('Set wait_timeout and interactive_timeout in MySQL');
        recommendations.push('Ensure application properly closes connections');
      }
      if (utilizationPercent >= this.HIGH_UTILIZATION_THRESHOLD) {
        recommendations.push('Implement connection pooling (e.g., ProxySQL, MaxScale)');
        recommendations.push('Consider MySQL read replicas for read-heavy workloads');
      }

      const poolStats: PoolStats = {
        databaseType: 'mysql',
        databaseName: dbName,
        timestamp: new Date(),
        totalConnections: threadsConnected,
        activeConnections,
        idleConnections,
        waitingClients: 0,
        maxConnections: effectiveMax,
        utilizationPercent,
        poolExhausted,
        connectionLeaks,
        warnings,
        recommendations
      };

      // Update metrics history
      this.updateMetricsHistory(dbName, {
        timestamp: new Date(),
        active: activeConnections,
        idle: idleConnections,
        total: threadsConnected,
        waiting: 0,
        utilization: utilizationPercent
      });

      return poolStats;
    } catch (error: any) {
      logger.error('Error monitoring MySQL pool:', error);
      throw error;
    }
  }

  /**
   * Get pool metrics history
   */
  getMetricsHistory(dbName: string, limit: number = 50): PoolMetrics[] {
    const history = this.metricsHistory.get(dbName) || [];
    return history.slice(-limit);
  }

  /**
   * Update metrics history
   */
  private updateMetricsHistory(dbName: string, metrics: PoolMetrics): void {
    let history = this.metricsHistory.get(dbName) || [];
    history.push(metrics);
    
    if (history.length > this.MAX_HISTORY) {
      history = history.slice(-this.MAX_HISTORY);
    }
    
    this.metricsHistory.set(dbName, history);
  }

  /**
   * Get all database pools status
   */
  getAllPoolsStatus(): Map<string, PoolMetrics[]> {
    return this.metricsHistory;
  }

  /**
   * Clear metrics history
   */
  clearHistory(dbName?: string): void {
    if (dbName) {
      this.metricsHistory.delete(dbName);
    } else {
      this.metricsHistory.clear();
    }
  }

  /**
   * Analyze pool trends
   */
  analyzePoolTrends(dbName: string): {
    averageUtilization: number;
    peakUtilization: number;
    averageActive: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  } {
    const history = this.metricsHistory.get(dbName) || [];
    
    if (history.length < 2) {
      return {
        averageUtilization: 0,
        peakUtilization: 0,
        averageActive: 0,
        trend: 'stable'
      };
    }

    const utilizations = history.map(m => m.utilization);
    const activeConnections = history.map(m => m.active);

    const averageUtilization = utilizations.reduce((a, b) => a + b, 0) / utilizations.length;
    const peakUtilization = Math.max(...utilizations);
    const averageActive = activeConnections.reduce((a, b) => a + b, 0) / activeConnections.length;

    // Calculate trend (last 10 vs previous 10)
    const recentAvg = utilizations.slice(-10).reduce((a, b) => a + b, 0) / Math.min(10, utilizations.length);
    const previousAvg = utilizations.slice(-20, -10).reduce((a, b) => a + b, 0) / Math.min(10, utilizations.length - 10);
    
    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (recentAvg > previousAvg * 1.1) {
      trend = 'increasing';
    } else if (recentAvg < previousAvg * 0.9) {
      trend = 'decreasing';
    }

    return {
      averageUtilization,
      peakUtilization,
      averageActive,
      trend
    };
  }
}

export default ConnectionPoolMonitor;
