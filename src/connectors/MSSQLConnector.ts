import sql, { ConnectionPool } from 'mssql';
import { config } from '../config';
import { logger } from '../utils/logger';
import { DatabaseMetrics } from '../types';

export class MSSQLConnector {
  private pool: ConnectionPool | null = null;
  private static instance: MSSQLConnector;

  private constructor() {}

  public static getInstance(): MSSQLConnector {
    if (!MSSQLConnector.instance) {
      MSSQLConnector.instance = new MSSQLConnector();
    }
    return MSSQLConnector.instance;
  }

  public async connect(): Promise<void> {
    if (!config.databases.mssql.enabled) {
      logger.info('SQL Server monitoring is disabled');
      return;
    }

    try {
      this.pool = new sql.ConnectionPool({
        server: config.databases.mssql.server,
        port: config.databases.mssql.port,
        database: config.databases.mssql.database,
        user: config.databases.mssql.user,
        password: config.databases.mssql.password,
        options: config.databases.mssql.options,
        pool: config.databases.mssql.pool
      });

      await this.pool.connect();
      await this.pool.request().query('SELECT 1');
      
      logger.info('✅ SQL Server connection established');
    } catch (error) {
      logger.error('Failed to connect to SQL Server:', error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.close();
      logger.info('SQL Server disconnected');
    }
  }

  public async getMetrics(): Promise<DatabaseMetrics> {
    if (!this.pool) {
      throw new Error('SQL Server pool not initialized');
    }

    const startTime = Date.now();

    try {
      // Connection statistics
      const connResult = await this.pool.request().query(`
        SELECT 
          COUNT(*) as total_connections,
          SUM(CASE WHEN status = 'sleeping' THEN 1 ELSE 0 END) as idle_connections,
          SUM(CASE WHEN status != 'sleeping' THEN 1 ELSE 0 END) as active_connections
        FROM sys.dm_exec_sessions
        WHERE database_id = DB_ID()
      `);

      // Performance statistics
      const perfStats = await this.pool.request().query(`
        SELECT 
          cntr_value as batch_requests
        FROM sys.dm_os_performance_counters
        WHERE counter_name = 'Batch Requests/sec'
      `);

      // Database size
      const sizeResult = await this.pool.request().query(`
        SELECT 
          SUM(size * 8.0 / 1024) as total_size_mb,
          SUM(CASE WHEN type = 0 THEN size * 8.0 / 1024 ELSE 0 END) as data_size_mb,
          SUM(CASE WHEN type = 1 THEN size * 8.0 / 1024 ELSE 0 END) as log_size_mb
        FROM sys.master_files
        WHERE database_id = DB_ID()
      `);

      // SQL Server version and uptime
      const versionResult = await this.pool.request().query('SELECT @@VERSION as version');
      const uptimeResult = await this.pool.request().query(`
        SELECT DATEDIFF(SECOND, sqlserver_start_time, GETDATE()) as uptime
        FROM sys.dm_os_sys_info
      `);

      // Buffer cache hit ratio
      const cacheResult = await this.pool.request().query(`
        SELECT 
          (a.cntr_value * 1.0 / b.cntr_value) * 100.0 as buffer_cache_hit_ratio
        FROM sys.dm_os_performance_counters a
        JOIN (
          SELECT cntr_value 
          FROM sys.dm_os_performance_counters 
          WHERE counter_name = 'Buffer cache hit ratio base'
        ) b ON 1=1
        WHERE a.counter_name = 'Buffer cache hit ratio'
      `);

      // CPU and memory usage
      const resourceResult = await this.pool.request().query(`
        SELECT 
          cpu_count,
          physical_memory_kb / 1024 as total_memory_mb,
          available_physical_memory_kb / 1024 as available_memory_mb
        FROM sys.dm_os_sys_info
      `);

      const responseTime = Date.now() - startTime;
      const conn = connResult.recordset[0];
      const size = sizeResult.recordset[0];
      const cache = cacheResult.recordset[0];
      const resource = resourceResult.recordset[0];

      return {
        timestamp: new Date(),
        databaseType: 'mssql',
        databaseName: config.databases.mssql.database,
        status: 'healthy',
        responseTime,
        connections: {
          active: conn.active_connections,
          idle: conn.idle_connections,
          total: conn.total_connections,
          max: config.databases.mssql.pool?.max || 20,
          waiting: 0
        },
        performance: {
          queriesPerSecond: 0,
          slowQueries: 0,
          avgQueryTime: 0,
          transactionsPerSecond: 0
        },
        resources: {
          cacheHitRatio: cache.buffer_cache_hit_ratio,
          memoryUsage: ((resource.total_memory_mb - resource.available_memory_mb) / resource.total_memory_mb) * 100
        },
        size: {
          totalSizeMB: size.total_size_mb,
          dataSize: size.data_size_mb,
          indexSize: 0
        },
        uptime: uptimeResult.recordset[0]?.uptime,
        version: versionResult.recordset[0]?.version
      };
    } catch (error) {
      logger.error('Error getting SQL Server metrics:', error);
      throw error;
    }
  }

  public async getSlowQueries(limit: number = 10): Promise<any[]> {
    if (!this.pool) return [];

    try {
      const result = await this.pool.request().query(`
        SELECT TOP ${limit}
          qs.sql_handle,
          qs.execution_count,
          qs.total_elapsed_time / 1000 as total_elapsed_time_ms,
          qs.total_elapsed_time / qs.execution_count / 1000 as avg_elapsed_time_ms,
          SUBSTRING(qt.text, (qs.statement_start_offset/2)+1,
            ((CASE qs.statement_end_offset
              WHEN -1 THEN DATALENGTH(qt.text)
              ELSE qs.statement_end_offset
            END - qs.statement_start_offset)/2) + 1) AS query_text
        FROM sys.dm_exec_query_stats qs
        CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) qt
        WHERE qs.total_elapsed_time / qs.execution_count > ${config.monitoring.slowQueryThreshold * 1000}
        ORDER BY avg_elapsed_time_ms DESC
      `);
      
      return result.recordset;
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
      
      await this.pool!.request().query('SELECT 1');
      
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
}
