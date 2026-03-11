import Database from 'better-sqlite3';
import { logger } from '../utils/logger';
import path from 'path';
import fs from 'fs';

export interface SlowQueryRecord {
  id?: number;
  timestamp: string;
  databaseType: string;
  databaseName: string;
  query: string;
  executionTime: number;
  user?: string;
  client?: string;
  rows?: number;
}

export interface MetricsRecord {
  id?: number;
  timestamp: string;
  databaseType: string;
  databaseName: string;
  connectionsTotal: number;
  connectionsActive: number;
  connectionsIdle: number;
  responseTime: number;
  qps?: number;
  cacheHitRatio?: number;
  databaseSize: number;
  slowQueries: number;
}

export interface EventRecord {
  id?: number;
  timestamp: string;
  eventType: 'alert' | 'error' | 'warning' | 'info';
  severity: 'critical' | 'warning' | 'info';
  databaseType?: string;
  databaseName?: string;
  message: string;
  details?: string;
}

export class HistoricalDatabase {
  private static instance: HistoricalDatabase;
  private db: Database.Database;
  private readonly dataDir = path.join(process.cwd(), 'data');
  private readonly dbPath = path.join(this.dataDir, 'historical.db');
  private readonly retentionDays = 30;

  private constructor() {
    // Ensure data directory exists
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    // Initialize database
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initializeTables();
    this.startCleanupSchedule();
    logger.info(`📊 Historical database initialized at ${this.dbPath}`);
  }

  public static getInstance(): HistoricalDatabase {
    if (!HistoricalDatabase.instance) {
      HistoricalDatabase.instance = new HistoricalDatabase();
    }
    return HistoricalDatabase.instance;
  }

  private initializeTables(): void {
    // Slow queries table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS slow_queries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        database_type TEXT NOT NULL,
        database_name TEXT NOT NULL,
        query TEXT NOT NULL,
        execution_time REAL NOT NULL,
        user TEXT,
        client TEXT,
        rows INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_slow_queries_timestamp ON slow_queries(timestamp);
      CREATE INDEX IF NOT EXISTS idx_slow_queries_db ON slow_queries(database_type, database_name);
      CREATE INDEX IF NOT EXISTS idx_slow_queries_exec_time ON slow_queries(execution_time);
    `);

    // Metrics table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS metrics_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        database_type TEXT NOT NULL,
        database_name TEXT NOT NULL,
        connections_total INTEGER NOT NULL,
        connections_active INTEGER NOT NULL,
        connections_idle INTEGER NOT NULL,
        response_time REAL NOT NULL,
        qps REAL,
        cache_hit_ratio REAL,
        database_size INTEGER NOT NULL,
        slow_queries INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics_history(timestamp);
      CREATE INDEX IF NOT EXISTS idx_metrics_db ON metrics_history(database_type, database_name);
    `);

    // Events table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        event_type TEXT NOT NULL,
        severity TEXT NOT NULL,
        database_type TEXT,
        database_name TEXT,
        message TEXT NOT NULL,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
      CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
      CREATE INDEX IF NOT EXISTS idx_events_severity ON events(severity);
    `);

    logger.info('✅ Historical database tables initialized');
  }

  // ==================== SLOW QUERIES ====================
  
  public saveSlowQuery(record: SlowQueryRecord): void {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO slow_queries (
          timestamp, database_type, database_name, query, 
          execution_time, user, client, rows
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        record.timestamp,
        record.databaseType,
        record.databaseName,
        record.query,
        record.executionTime,
        record.user || null,
        record.client || null,
        record.rows || null
      );
    } catch (error: any) {
      logger.error('Error saving slow query:', error);
    }
  }

  public getSlowQueries(
    databaseType?: string,
    databaseName?: string,
    limit: number = 100,
    minExecutionTime?: number
  ): SlowQueryRecord[] {
    try {
      let query = 'SELECT * FROM slow_queries WHERE 1=1';
      const params: any[] = [];

      if (databaseType) {
        query += ' AND database_type = ?';
        params.push(databaseType);
      }

      if (databaseName) {
        query += ' AND database_name = ?';
        params.push(databaseName);
      }

      if (minExecutionTime) {
        query += ' AND execution_time >= ?';
        params.push(minExecutionTime);
      }

      query += ' ORDER BY timestamp DESC LIMIT ?';
      params.push(limit);

      const stmt = this.db.prepare(query);
      return stmt.all(...params) as SlowQueryRecord[];
    } catch (error: any) {
      logger.error('Error getting slow queries:', error);
      return [];
    }
  }

  public getSlowQueriesByTimeRange(
    startTime: string,
    endTime: string,
    databaseType?: string,
    databaseName?: string
  ): SlowQueryRecord[] {
    try {
      let query = `
        SELECT * FROM slow_queries 
        WHERE timestamp >= ? AND timestamp <= ?
      `;
      const params: any[] = [startTime, endTime];

      if (databaseType) {
        query += ' AND database_type = ?';
        params.push(databaseType);
      }

      if (databaseName) {
        query += ' AND database_name = ?';
        params.push(databaseName);
      }

      query += ' ORDER BY execution_time DESC';

      const stmt = this.db.prepare(query);
      return stmt.all(...params) as SlowQueryRecord[];
    } catch (error: any) {
      logger.error('Error getting slow queries by time range:', error);
      return [];
    }
  }

  public getSlowQueryStats(databaseType?: string, databaseName?: string): any {
    try {
      let query = `
        SELECT 
          COUNT(*) as total_queries,
          AVG(execution_time) as avg_execution_time,
          MAX(execution_time) as max_execution_time,
          MIN(execution_time) as min_execution_time
        FROM slow_queries
        WHERE 1=1
      `;
      const params: any[] = [];

      if (databaseType) {
        query += ' AND database_type = ?';
        params.push(databaseType);
      }

      if (databaseName) {
        query += ' AND database_name = ?';
        params.push(databaseName);
      }

      const stmt = this.db.prepare(query);
      return stmt.get(...params);
    } catch (error: any) {
      logger.error('Error getting slow query stats:', error);
      return null;
    }
  }

  // ==================== METRICS ====================
  
  public saveMetrics(record: MetricsRecord): void {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO metrics_history (
          timestamp, database_type, database_name, connections_total,
          connections_active, connections_idle, response_time, qps,
          cache_hit_ratio, database_size, slow_queries
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        record.timestamp,
        record.databaseType,
        record.databaseName,
        record.connectionsTotal,
        record.connectionsActive,
        record.connectionsIdle,
        record.responseTime,
        record.qps || null,
        record.cacheHitRatio || null,
        record.databaseSize,
        record.slowQueries
      );
    } catch (error: any) {
      logger.error('Error saving metrics:', error);
    }
  }

  public getMetricsHistory(
    databaseType: string,
    databaseName: string,
    hours: number = 24
  ): MetricsRecord[] {
    try {
      const startTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
      
      const stmt = this.db.prepare(`
        SELECT * FROM metrics_history
        WHERE database_type = ? 
          AND database_name = ?
          AND timestamp >= ?
        ORDER BY timestamp DESC
      `);

      return stmt.all(databaseType, databaseName, startTime) as MetricsRecord[];
    } catch (error: any) {
      logger.error('Error getting metrics history:', error);
      return [];
    }
  }

  public getMetricsByTimeRange(
    databaseType: string,
    databaseName: string,
    startTime: string,
    endTime: string
  ): MetricsRecord[] {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM metrics_history
        WHERE database_type = ? 
          AND database_name = ?
          AND timestamp >= ?
          AND timestamp <= ?
        ORDER BY timestamp DESC
      `);

      return stmt.all(databaseType, databaseName, startTime, endTime) as MetricsRecord[];
    } catch (error: any) {
      logger.error('Error getting metrics by time range:', error);
      return [];
    }
  }

  // ==================== EVENTS ====================
  
  public saveEvent(record: EventRecord): void {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO events (
          timestamp, event_type, severity, database_type,
          database_name, message, details
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        record.timestamp,
        record.eventType,
        record.severity,
        record.databaseType || null,
        record.databaseName || null,
        record.message,
        record.details || null
      );
    } catch (error: any) {
      logger.error('Error saving event:', error);
    }
  }

  public getEvents(
    limit: number = 100,
    eventType?: string,
    severity?: string
  ): EventRecord[] {
    try {
      let query = 'SELECT * FROM events WHERE 1=1';
      const params: any[] = [];

      if (eventType) {
        query += ' AND event_type = ?';
        params.push(eventType);
      }

      if (severity) {
        query += ' AND severity = ?';
        params.push(severity);
      }

      query += ' ORDER BY timestamp DESC LIMIT ?';
      params.push(limit);

      const stmt = this.db.prepare(query);
      return stmt.all(...params) as EventRecord[];
    } catch (error: any) {
      logger.error('Error getting events:', error);
      return [];
    }
  }

  public getEventsByTimeRange(
    startTime: string,
    endTime: string,
    eventType?: string,
    severity?: string
  ): EventRecord[] {
    try {
      let query = 'SELECT * FROM events WHERE timestamp >= ? AND timestamp <= ?';
      const params: any[] = [startTime, endTime];

      if (eventType) {
        query += ' AND event_type = ?';
        params.push(eventType);
      }

      if (severity) {
        query += ' AND severity = ?';
        params.push(severity);
      }

      query += ' ORDER BY timestamp DESC';

      const stmt = this.db.prepare(query);
      return stmt.all(...params) as EventRecord[];
    } catch (error: any) {
      logger.error('Error getting events by time range:', error);
      return [];
    }
  }

  // ==================== CLEANUP ====================
  
  private startCleanupSchedule(): void {
    // Run cleanup every 6 hours
    setInterval(() => {
      this.cleanupOldData();
    }, 6 * 60 * 60 * 1000);

    // Run immediately on startup
    setTimeout(() => this.cleanupOldData(), 5000);
  }

  public cleanupOldData(): void {
    try {
      const cutoffDate = new Date(Date.now() - this.retentionDays * 24 * 60 * 60 * 1000).toISOString();
      
      const slowQueriesDeleted = this.db.prepare('DELETE FROM slow_queries WHERE timestamp < ?').run(cutoffDate);
      const metricsDeleted = this.db.prepare('DELETE FROM metrics_history WHERE timestamp < ?').run(cutoffDate);
      const eventsDeleted = this.db.prepare('DELETE FROM events WHERE timestamp < ?').run(cutoffDate);

      logger.info(`🧹 Cleanup completed: Deleted ${slowQueriesDeleted.changes} slow queries, ${metricsDeleted.changes} metrics, ${eventsDeleted.changes} events older than ${this.retentionDays} days`);
      
      // Optimize database
      this.db.exec('VACUUM');
    } catch (error: any) {
      logger.error('Error during cleanup:', error);
    }
  }

  // ==================== STATS ====================
  
  public getDatabaseStats(): any {
    try {
      const slowQueriesCount = this.db.prepare('SELECT COUNT(*) as count FROM slow_queries').get() as any;
      const metricsCount = this.db.prepare('SELECT COUNT(*) as count FROM metrics_history').get() as any;
      const eventsCount = this.db.prepare('SELECT COUNT(*) as count FROM events').get() as any;
      
      const dbSize = fs.statSync(this.dbPath).size;

      return {
        slowQueries: slowQueriesCount.count,
        metrics: metricsCount.count,
        events: eventsCount.count,
        databaseSize: dbSize,
        databasePath: this.dbPath,
        retentionDays: this.retentionDays
      };
    } catch (error: any) {
      logger.error('Error getting database stats:', error);
      return null;
    }
  }

  public close(): void {
    this.db.close();
    logger.info('Historical database closed');
  }
}
