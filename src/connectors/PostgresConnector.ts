import { Pool, PoolClient, QueryResult } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';
import { DatabaseMetrics } from '../types';

export class PostgresConnector {
  private pool: Pool | null = null;
  private static instance: PostgresConnector;

  private constructor() {}

  public static getInstance(): PostgresConnector {
    if (!PostgresConnector.instance) {
      PostgresConnector.instance = new PostgresConnector();
    }
    return PostgresConnector.instance;
  }

  public async connect(): Promise<void> {
    if (!config.databases.postgres.enabled) {
      logger.info('PostgreSQL monitoring is disabled');
      return;
    }

    try {
      this.pool = new Pool({
        host: config.databases.postgres.host,
        port: config.databases.postgres.port,
        database: config.databases.postgres.database,
        user: config.databases.postgres.user,
        password: config.databases.postgres.password,
        max: config.databases.postgres.max,
        idleTimeoutMillis: config.databases.postgres.idleTimeoutMillis,
        connectionTimeoutMillis: config.databases.postgres.connectionTimeoutMillis,
        ssl: {
          rejectUnauthorized: false
        }
      });

      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      
      logger.info('✅ PostgreSQL connection established');
    } catch (error) {
      logger.error('Failed to connect to PostgreSQL:', error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      logger.info('PostgreSQL disconnected');
    }
  }

  public async getMetrics(): Promise<DatabaseMetrics> {
    if (!this.pool) {
      throw new Error('PostgreSQL pool not initialized');
    }

    const startTime = Date.now();
    const client = await this.pool.connect();

    try {
      // Connection statistics
      const connectionStats = await client.query(`
        SELECT 
          count(*) FILTER (WHERE state = 'active') as active,
          count(*) FILTER (WHERE state = 'idle') as idle,
          count(*) as total,
          (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_conn,
          count(*) FILTER (WHERE wait_event_type IS NOT NULL) as waiting
        FROM pg_stat_activity
        WHERE datname = current_database()
      `);

      // Performance statistics
      const perfStats = await client.query(`
        SELECT 
          xact_commit + xact_rollback as total_transactions,
          tup_returned + tup_fetched as total_queries,
          blk_read_time + blk_write_time as total_io_time,
          conflicts,
          temp_bytes
        FROM pg_stat_database
        WHERE datname = current_database()
      `);

      // Slow queries (from pg_stat_statements if available)
      let slowQueryCount = 0;
      try {
        const slowQueries = await client.query(`
          SELECT count(*) as count
          FROM pg_stat_statements
          WHERE mean_exec_time > $1
        `, [config.monitoring.slowQueryThreshold]);
        slowQueryCount = parseInt(slowQueries.rows[0]?.count || '0');
      } catch {
        // pg_stat_statements extension not available
      }

      // Database size
      const sizeStats = await client.query(`
        SELECT 
          pg_database_size(current_database()) as total_size,
          pg_database_size(current_database()) as data_size
      `);

      // Cache hit ratio
      const cacheStats = await client.query(`
        SELECT 
          sum(blks_hit) * 100.0 / nullif(sum(blks_hit + blks_read), 0) as cache_hit_ratio
        FROM pg_stat_database
        WHERE datname = current_database()
      `);

      // Database version and uptime
      const versionResult = await client.query('SELECT version()');
      const uptimeResult = await client.query(`
        SELECT extract(epoch from (now() - pg_postmaster_start_time())) as uptime
      `);

      const responseTime = Date.now() - startTime;
      const connStats = connectionStats.rows[0];
      const perf = perfStats.rows[0];
      const size = sizeStats.rows[0];

      return {
        timestamp: new Date(),
        databaseType: 'postgres',
        databaseName: config.databases.postgres.database,
        status: 'healthy',
        responseTime,
        connections: {
          active: parseInt(connStats.active),
          idle: parseInt(connStats.idle),
          total: parseInt(connStats.total),
          max: parseInt(connStats.max_conn),
          waiting: parseInt(connStats.waiting)
        },
        performance: {
          queriesPerSecond: 0, // Calculated over time
          slowQueries: slowQueryCount,
          avgQueryTime: 0,
          transactionsPerSecond: 0
        },
        resources: {
          cacheHitRatio: parseFloat(cacheStats.rows[0]?.cache_hit_ratio || '0')
        },
        size: {
          totalSizeMB: parseInt(size.total_size) / (1024 * 1024),
          dataSize: parseInt(size.data_size) / (1024 * 1024),
          indexSize: 0
        },
        uptime: parseFloat(uptimeResult.rows[0]?.uptime || '0'),
        version: versionResult.rows[0]?.version
      };
    } finally {
      client.release();
    }
  }

  public async getSlowQueries(limit: number = 10): Promise<any[]> {
    if (!this.pool) return [];

    try {
      const result = await this.pool.query(`
        SELECT 
          query,
          mean_exec_time as avg_time,
          calls,
          total_exec_time,
          rows
        FROM pg_stat_statements
        WHERE mean_exec_time > $1
        ORDER BY mean_exec_time DESC
        LIMIT $2
      `, [config.monitoring.slowQueryThreshold, limit]);

      return result.rows;
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
      
      const client = await this.pool!.connect();
      await client.query('SELECT 1');
      client.release();
      
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

  public getPool(): Pool | null {
    return this.pool;
  }
}
