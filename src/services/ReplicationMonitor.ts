import { Pool } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';
import { ReplicationStatus, BackupStatus } from '../types/advanced';
import { PostgresConnector } from '../connectors/PostgresConnector';
import { MySQLConnector } from '../connectors/MySQLConnector';
import { MSSQLConnector } from '../connectors/MSSQLConnector';

export class ReplicationMonitor {
  private static instance: ReplicationMonitor;
  private pgConnector: PostgresConnector;
  private mysqlConnector: MySQLConnector;
  private mssqlConnector: MSSQLConnector;
  
  private replicationCache: Map<string, ReplicationStatus> = new Map();
  private backupCache: Map<string, BackupStatus> = new Map();

  private constructor() {
    this.pgConnector = PostgresConnector.getInstance();
    this.mysqlConnector = MySQLConnector.getInstance();
    this.mssqlConnector = MSSQLConnector.getInstance();
  }

  public static getInstance(): ReplicationMonitor {
    if (!ReplicationMonitor.instance) {
      ReplicationMonitor.instance = new ReplicationMonitor();
    }
    return ReplicationMonitor.instance;
  }

  // PostgreSQL Replication
  public async getPostgresReplicationStatus(): Promise<ReplicationStatus> {
    const dbKey = `postgres:${config.databases.postgres.database}`;
    
    try {
      const pool = (this.pgConnector as any).pool as Pool;
      if (!pool) {
        throw new Error('PostgreSQL pool not initialized');
      }

      const client = await pool.connect();
      
      try {
        // Check if this is a replica
        const recoveryCheck = await client.query(`
          SELECT pg_is_in_recovery() as is_replica
        `);
        const isReplica = recoveryCheck.rows[0].is_replica;

        let status: ReplicationStatus = {
          id: dbKey,
          databaseType: 'postgres',
          databaseName: config.databases.postgres.database,
          timestamp: new Date(),
          isReplica,
          isPrimary: !isReplica,
          replicationState: 'none',
          replicationLag: 0
        };

        if (isReplica) {
          // Get replication status for replica
          const replicaStatus = await client.query(`
            SELECT 
              status,
              sender_host,
              sender_port,
              EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp()))::int as lag_seconds
            FROM pg_stat_wal_receiver
          `);

          if (replicaStatus.rows.length > 0) {
            const row = replicaStatus.rows[0];
            status.replicationState = row.status === 'streaming' ? 'streaming' : 'error';
            status.replicationLag = row.lag_seconds || 0;
            status.primaryServer = {
              host: row.sender_host,
              port: row.sender_port,
              connected: row.status === 'streaming'
            };
          }
        } else {
          // Get replication status for primary
          const replicationSlots = await client.query(`
            SELECT 
              slot_name,
              slot_type,
              active,
              pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) as lag
            FROM pg_replication_slots
            WHERE slot_type = 'physical'
          `);

          status.replicas = replicationSlots.rows.map((row: any) => ({
            name: row.slot_name,
            state: row.active ? 'active' : 'inactive',
            lag: 0, // Would need more complex query
            lastContact: new Date()
          }));

          if (status.replicas && status.replicas.length > 0) {
            status.replicationState = 'streaming';
          }
        }

        this.replicationCache.set(dbKey, status);
        return status;
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Error getting PostgreSQL replication status:', error);
      return {
        id: dbKey,
        databaseType: 'postgres',
        databaseName: config.databases.postgres.database,
        timestamp: new Date(),
        isReplica: false,
        isPrimary: false,
        replicationState: 'error',
        replicationLag: 0
      };
    }
  }

  // PostgreSQL Backup Status
  public async getPostgresBackupStatus(): Promise<BackupStatus> {
    const dbKey = `postgres:${config.databases.postgres.database}`;
    
    try {
      const pool = (this.pgConnector as any).pool as Pool;
      if (!pool) {
        throw new Error('PostgreSQL pool not initialized');
      }

      const client = await pool.connect();
      
      try {
        // Check for pg_basebackup activity or custom backup tables
        // This is a simplified version - would need custom backup logging table
        const backupInfo = await client.query(`
          SELECT 
            name,
            setting
          FROM pg_settings
          WHERE name IN ('archive_mode', 'archive_command', 'wal_level')
        `);

        const settings = Object.fromEntries(
          backupInfo.rows.map((row: any) => [row.name, row.setting])
        );

        const archiveEnabled = settings.archive_mode === 'on';
        const walLevel = settings.wal_level;

        // Try to get last backup from a custom table (if exists)
        let lastBackupTime: Date | undefined;
        let lastBackupStatus: 'success' | 'failed' | 'in_progress' | undefined;
        
        try {
          const backupLog = await client.query(`
            SELECT 
              backup_time,
              backup_type,
              backup_size,
              status,
              duration_seconds
            FROM backup_log
            ORDER BY backup_time DESC
            LIMIT 1
          `);
          
          if (backupLog.rows.length > 0) {
            const row = backupLog.rows[0];
            lastBackupTime = row.backup_time;
            lastBackupStatus = row.status;
          }
        } catch {
          // Table doesn't exist - that's ok
        }

        const daysSinceLastBackup = lastBackupTime 
          ? Math.floor((Date.now() - lastBackupTime.getTime()) / (1000 * 60 * 60 * 24))
          : undefined;

        const warnings: string[] = [];
        let backupHealth: 'healthy' | 'warning' | 'critical' | 'unknown' = 'unknown';

        if (!archiveEnabled) {
          warnings.push('Archive mode is not enabled');
          backupHealth = 'warning';
        }

        if (daysSinceLastBackup !== undefined) {
          if (daysSinceLastBackup > 7) {
            warnings.push(`Last backup was ${daysSinceLastBackup} days ago`);
            backupHealth = 'critical';
          } else if (daysSinceLastBackup > 1) {
            warnings.push(`Last backup was ${daysSinceLastBackup} days ago`);
            backupHealth = 'warning';
          } else {
            backupHealth = 'healthy';
          }
        }

        const status: BackupStatus = {
          id: dbKey,
          databaseType: 'postgres',
          databaseName: config.databases.postgres.database,
          timestamp: new Date(),
          lastBackupTime,
          lastBackupStatus,
          backupHealth,
          daysSinceLastBackup,
          warnings
        };

        this.backupCache.set(dbKey, status);
        return status;
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Error getting PostgreSQL backup status:', error);
      return {
        id: dbKey,
        databaseType: 'postgres',
        databaseName: config.databases.postgres.database,
        timestamp: new Date(),
        backupHealth: 'unknown',
        warnings: ['Unable to check backup status']
      };
    }
  }

  // Get all replication statuses
  public async getAllReplicationStatuses(): Promise<ReplicationStatus[]> {
    const statuses: ReplicationStatus[] = [];

    if (config.databases.postgres.enabled) {
      try {
        const pgStatus = await this.getPostgresReplicationStatus();
        statuses.push(pgStatus);
      } catch (error) {
        logger.error('Failed to get PostgreSQL replication status:', error);
      }
    }

    // MySQL and MSSQL can be added similarly
    return statuses;
  }

  // Get all backup statuses
  public async getAllBackupStatuses(): Promise<BackupStatus[]> {
    const statuses: BackupStatus[] = [];

    if (config.databases.postgres.enabled) {
      try {
        const pgStatus = await this.getPostgresBackupStatus();
        statuses.push(pgStatus);
      } catch (error) {
        logger.error('Failed to get PostgreSQL backup status:', error);
      }
    }

    return statuses;
  }

  // Get cached status
  public getCachedReplicationStatus(dbKey: string): ReplicationStatus | undefined {
    return this.replicationCache.get(dbKey);
  }

  public getCachedBackupStatus(dbKey: string): BackupStatus | undefined {
    return this.backupCache.get(dbKey);
  }

  // Clear cache
  public clearCache(): void {
    this.replicationCache.clear();
    this.backupCache.clear();
  }
}
