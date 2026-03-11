import mysql, { Pool, PoolConnection } from 'mysql2/promise';
import { config } from '../config';
import { logger } from '../utils/logger';
import { DatabaseMetrics } from '../types';

export class MySQLConnector {
  private pool: Pool | null = null;
  private static instance: MySQLConnector;

  private constructor() {}

  public static getInstance(): MySQLConnector {
    if (!MySQLConnector.instance) {
      MySQLConnector.instance = new MySQLConnector();
    }
    return MySQLConnector.instance;
  }

  public async connect(): Promise<void> {
    if (!config.databases.mysql.enabled) {
      logger.info('MySQL monitoring is disabled');
      return;
    }

    try {
      this.pool = mysql.createPool({
        host: config.databases.mysql.host,
        port: config.databases.mysql.port,
        database: config.databases.mysql.database,
        user: config.databases.mysql.user,
        password: config.databases.mysql.password,
        waitForConnections: config.databases.mysql.waitForConnections,
        connectionLimit: config.databases.mysql.connectionLimit,
        queueLimit: config.databases.mysql.queueLimit
      });

      // Test connection
      const connection = await this.pool.getConnection();
      await connection.query('SELECT 1');
      connection.release();
      
      logger.info('✅ MySQL connection established');
    } catch (error) {
      logger.error('Failed to connect to MySQL:', error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      logger.info('MySQL disconnected');
    }
  }

  public async getMetrics(): Promise<DatabaseMetrics> {
    if (!this.pool) {
      throw new Error('MySQL pool not initialized');
    }

    const startTime = Date.now();
    const connection = await this.pool.getConnection();

    try {
      // Connection statistics
      const [processlist]: any = await connection.query('SHOW PROCESSLIST');
      const [variables]: any = await connection.query("SHOW VARIABLES LIKE 'max_connections'");
      const maxConnections = parseInt(variables[0]?.Value || '151');

      const activeConnections = processlist.filter((p: any) => p.Command !== 'Sleep').length;
      const idleConnections = processlist.filter((p: any) => p.Command === 'Sleep').length;

      // Performance statistics
      const [status]: any = await connection.query('SHOW GLOBAL STATUS');
      const statusMap = new Map(status.map((s: any) => [s.Variable_name, s.Value]));

      // Slow queries
      const slowQueries = parseInt(String(statusMap.get('Slow_queries') || '0'));

      // Database size
      const [sizeResult]: any = await connection.query(`
        SELECT 
          SUM(data_length + index_length) as total_size,
          SUM(data_length) as data_size,
          SUM(index_length) as index_size
        FROM information_schema.TABLES
        WHERE table_schema = ?
      `, [config.databases.mysql.database]);

      // Version and uptime
      const [versionResult]: any = await connection.query('SELECT VERSION() as version');
      const uptime = parseInt(String(statusMap.get('Uptime') || '0'));

      // Cache hit ratio (query cache)
      const qcacheHits = parseInt(String(statusMap.get('Qcache_hits') || '0'));
      const comSelect = parseInt(String(statusMap.get('Com_select') || '0'));
      const cacheHitRatio = comSelect > 0 ? (qcacheHits * 100) / (qcacheHits + comSelect) : 0;

      const responseTime = Date.now() - startTime;
      const size = sizeResult[0];

      return {
        timestamp: new Date(),
        databaseType: 'mysql',
        databaseName: config.databases.mysql.database,
        status: 'healthy',
        responseTime,
        connections: {
          active: activeConnections,
          idle: idleConnections,
          total: processlist.length,
          max: maxConnections,
          waiting: 0
        },
        performance: {
          queriesPerSecond: 0,
          slowQueries,
          avgQueryTime: 0,
          transactionsPerSecond: 0
        },
        resources: {
          cacheHitRatio
        },
        size: {
          totalSizeMB: parseInt(size?.total_size || '0') / (1024 * 1024),
          dataSize: parseInt(size?.data_size || '0') / (1024 * 1024),
          indexSize: parseInt(size?.index_size || '0') / (1024 * 1024)
        },
        uptime,
        version: versionResult[0]?.version
      };
    } finally {
      connection.release();
    }
  }

  public async getSlowQueries(limit: number = 10): Promise<any[]> {
    if (!this.pool) return [];

    try {
      const connection = await this.pool.getConnection();
      const [slowLog]: any = await connection.query(`
        SELECT 
          sql_text as query,
          query_time as avg_time,
          lock_time,
          rows_sent,
          rows_examined
        FROM mysql.slow_log
        ORDER BY query_time DESC
        LIMIT ?
      `, [limit]);
      connection.release();
      
      return slowLog;
    } catch {
      return [];
    }
  }

  public async healthCheck(): Promise<{ status: 'up' | 'down'; responseTime: number; error?: string }> {
    const startTime = Date.now();
    
    try {
      if (!this.pool) {
        await this.connect();
      }
      
      const connection = await this.pool!.getConnection();
      await connection.query('SELECT 1');
      connection.release();
      
      return {
        status: 'up',
        responseTime: Date.now() - startTime
      };
    } catch (error: any) {
      return {
        status: 'down',
        responseTime: Date.now() - startTime,
        error: error.message
      };
    }
  }

  public async getConnection() {
    if (!this.pool) {
      throw new Error('MySQL pool not initialized');
    }
    return this.pool.getConnection();
  }

  public getPool(): Pool | null {
    return this.pool;
  }
}
