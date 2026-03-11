import { Pool } from 'pg';
import { Connection } from 'mysql2/promise';
import { logger } from '../utils/logger';

export interface DeadlockInfo {
  id: string;
  timestamp: Date;
  databaseType: string;
  databaseName: string;
  queries: DeadlockQuery[];
  victims: string[];
  resolution: string;
  duration?: number;
  suggestion?: string;
}

export interface DeadlockQuery {
  pid: number;
  query: string;
  user: string;
  application: string;
  waitingFor?: string;
  locksHeld?: string[];
  startTime: Date;
}

export interface ConnectionInfo {
  pid: number;
  user: string;
  database: string;
  application: string;
  state: string;
  query: string;
  duration: number;
  waitEvent?: string;
  blocked?: boolean;
  blocking?: number[];  clientAddr?: string;
  clientHost?: string;
  clientPort?: number;
  backendStart?: Date;
  transactionStart?: Date;
  queryStart?: Date;
  stateChange?: Date;}

export class DeadlockMonitor {
  private deadlockHistory: DeadlockInfo[] = [];
  private readonly MAX_HISTORY = 100;

  /**
   * Detect deadlocks in PostgreSQL
   */
  async detectPostgresDeadlocks(pool: Pool, dbName: string): Promise<DeadlockInfo | null> {
    try {
      // Query para detectar deadlocks activos
      const result = await pool.query(`
        SELECT 
          blocked_locks.pid AS blocked_pid,
          blocked_activity.usename AS blocked_user,
          blocked_activity.application_name AS blocked_app,
          blocked_activity.query AS blocked_query,
          blocked_activity.query_start AS blocked_start,
          blocking_locks.pid AS blocking_pid,
          blocking_activity.usename AS blocking_user,
          blocking_activity.application_name AS blocking_app,
          blocking_activity.query AS blocking_query,
          blocking_activity.query_start AS blocking_start,
          blocked_locks.locktype AS lock_type,
          blocked_locks.relation::regclass AS relation
        FROM pg_catalog.pg_locks blocked_locks
        JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
        JOIN pg_catalog.pg_locks blocking_locks 
          ON blocking_locks.locktype = blocked_locks.locktype
          AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
          AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
          AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
          AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
          AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
          AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
          AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
          AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
          AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
          AND blocking_locks.pid != blocked_locks.pid
        JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
        WHERE NOT blocked_locks.granted
          AND blocked_activity.state != 'idle'
          AND blocking_activity.state != 'idle'
        ORDER BY blocked_activity.query_start;
      `);

      if (result.rows.length === 0) {
        return null;
      }

      // Agrupar por ciclo de deadlock
      const queries: DeadlockQuery[] = [];
      const victims: string[] = [];
      const seenPids = new Set<number>();

      for (const row of result.rows) {
        if (!seenPids.has(row.blocked_pid)) {
          queries.push({
            pid: row.blocked_pid,
            query: row.blocked_query || 'N/A',
            user: row.blocked_user || 'unknown',
            application: row.blocked_app || 'unknown',
            waitingFor: `PID ${row.blocking_pid}`,
            startTime: row.blocked_start
          });
          seenPids.add(row.blocked_pid);
        }

        if (!seenPids.has(row.blocking_pid)) {
          queries.push({
            pid: row.blocking_pid,
            query: row.blocking_query || 'N/A',
            user: row.blocking_user || 'unknown',
            application: row.blocking_app || 'unknown',
            startTime: row.blocking_start
          });
          seenPids.add(row.blocking_pid);
        }
      }

      const deadlock: DeadlockInfo = {
        id: `dl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        databaseType: 'postgres',
        databaseName: dbName,
        queries,
        victims: victims,
        resolution: 'Automatic rollback of blocking transaction',
        suggestion: this.generateSuggestion(queries)
      };

      this.addToHistory(deadlock);
      return deadlock;
    } catch (error: any) {
      logger.error('Error detecting PostgreSQL deadlocks:', error);
      return null;
    }
  }

  /**
   * Detect deadlocks in MySQL
   */
  async detectMySQLDeadlocks(connection: Connection, dbName: string): Promise<DeadlockInfo | null> {
    try {
      // Get latest deadlock from SHOW ENGINE INNODB STATUS
      const [rows]: any = await connection.query('SHOW ENGINE INNODB STATUS');
      const status = rows[0].Status;

      // Parse deadlock section
      const deadlockMatch = status.match(/LATEST DETECTED DEADLOCK\s+-+\s+([\s\S]*?)(?=-{5,}|$)/);
      if (!deadlockMatch) {
        return null;
      }

      const deadlockText = deadlockMatch[1];
      const timestampMatch = deadlockText.match(/(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/);
      const timestamp = timestampMatch ? new Date(timestampMatch[1]) : new Date();

      // Extract transaction info
      const transactionRegex = /\*\*\* \((\d+)\) (TRANSACTION|WAITING FOR|HOLDS THE LOCK)/g;
      const queries: DeadlockQuery[] = [];
      const victims: string[] = [];

      let match;
      while ((match = transactionRegex.exec(deadlockText)) !== null) {
        const txId = match[1];
        queries.push({
          pid: parseInt(txId),
          query: 'Check MySQL logs for query details',
          user: 'mysql_user',
          application: 'mysql',
          startTime: timestamp
        });
      }

      // Check if there was a victim
      if (deadlockText.includes('WE ROLL BACK TRANSACTION')) {
        const rollbackMatch = deadlockText.match(/WE ROLL BACK TRANSACTION \((\d+)\)/);
        if (rollbackMatch) {
          victims.push(`Transaction ${rollbackMatch[1]}`);
        }
      }

      const deadlock: DeadlockInfo = {
        id: `dl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp,
        databaseType: 'mysql',
        databaseName: dbName,
        queries,
        victims,
        resolution: victims.length > 0 ? `Rolled back: ${victims.join(', ')}` : 'Automatic resolution',
        suggestion: 'Consider adding indexes, reordering transactions, or using SELECT FOR UPDATE'
      };

      this.addToHistory(deadlock);
      return deadlock;
    } catch (error: any) {
      logger.error('Error detecting MySQL deadlocks:', error);
      return null;
    }
  }

  /**
   * Get active connections and blocking chains in PostgreSQL
   */
  async getPostgresConnections(pool: Pool): Promise<ConnectionInfo[]> {
    try {
      const result = await pool.query(`
        SELECT 
          pid,
          usename as user,
          datname as database,
          application_name as application,
          state,
          COALESCE(query, '<idle>') as query,
          EXTRACT(EPOCH FROM (NOW() - query_start))::int as duration,
          wait_event_type || ':' || wait_event as wait_event,
          (SELECT COUNT(*) FROM pg_locks WHERE NOT granted AND pg_locks.pid = activity.pid) > 0 as blocked,
          client_addr::text as client_addr,
          client_hostname as client_host,
          client_port,
          backend_start,
          xact_start as transaction_start,
          query_start,
          state_change
        FROM pg_stat_activity activity
        WHERE state != 'idle' OR state IS NULL
        ORDER BY query_start;
      `);

      const connections: ConnectionInfo[] = result.rows.map((row: any) => ({
        pid: row.pid,
        user: row.user || 'unknown',
        database: row.database || 'unknown',
        application: row.application || 'unknown',
        state: row.state || 'unknown',
        query: row.query || '<idle>',
        duration: row.duration || 0,
        waitEvent: row.wait_event,
        blocked: row.blocked || false,
        blocking: [],
        clientAddr: row.client_addr,
        clientHost: row.client_host,
        clientPort: row.client_port,
        backendStart: row.backend_start ? new Date(row.backend_start) : undefined,
        transactionStart: row.transaction_start ? new Date(row.transaction_start) : undefined,
        queryStart: row.query_start ? new Date(row.query_start) : undefined,
        stateChange: row.state_change ? new Date(row.state_change) : undefined,
      }));

      // Find blocking relationships
      const blockingResult = await pool.query(`
        SELECT 
          blocked_locks.pid AS blocked_pid,
          blocking_locks.pid AS blocking_pid
        FROM pg_catalog.pg_locks blocked_locks
        JOIN pg_catalog.pg_locks blocking_locks 
          ON blocking_locks.locktype = blocked_locks.locktype
          AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
          AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
          AND blocking_locks.pid != blocked_locks.pid
        WHERE NOT blocked_locks.granted
          AND blocking_locks.granted;
      `);

      const blockingMap = new Map<number, number[]>();
      for (const row of blockingResult.rows) {
        if (!blockingMap.has(row.blocking_pid)) {
          blockingMap.set(row.blocking_pid, []);
        }
        blockingMap.get(row.blocking_pid)!.push(row.blocked_pid);
      }

      // Add blocking info to connections
      connections.forEach(conn => {
        conn.blocking = blockingMap.get(conn.pid) || [];
      });

      return connections;
    } catch (error: any) {
      logger.error('Error getting PostgreSQL connections:', error);
      return [];
    }
  }

  /**
   * Get active connections in MySQL
   */
  async getMySQLConnections(connection: Connection): Promise<ConnectionInfo[]> {
    try {
      const [rows]: any = await connection.query('SHOW FULL PROCESSLIST');

      return rows.map((row: any) => {
        // Parse Host field which is in format "IP:port" or "hostname:port"
        let clientAddr: string | undefined;
        let clientPort: number | undefined;
        
        if (row.Host) {
          const hostParts = row.Host.split(':');
          if (hostParts.length === 2) {
            clientAddr = hostParts[0];
            clientPort = parseInt(hostParts[1], 10);
          } else {
            clientAddr = row.Host;
          }
        }
        
        return {
          pid: row.Id,
          user: row.User || 'unknown',
          database: row.db || 'none',
          application: row.Host || 'unknown',
          state: row.State || 'unknown',
          query: row.Info || '<idle>',
          duration: row.Time || 0,
          blocked: false,
          blocking: [],
          clientAddr,
          clientPort,
          // MySQL doesn't provide these directly in PROCESSLIST
          clientHost: undefined,
          backendStart: undefined,
          transactionStart: undefined,
          queryStart: undefined,
          stateChange: undefined,
        };
      });
    } catch (error: any) {
      logger.error('Error getting MySQL connections:', error);
      return [];
    }
  }

  /**
   * Get deadlock history
   */
  getHistory(limit: number = 50): DeadlockInfo[] {
    return this.deadlockHistory.slice(-limit).reverse();
  }

  /**
   * Add deadlock to history
   */
  private addToHistory(deadlock: DeadlockInfo): void {
    this.deadlockHistory.push(deadlock);
    if (this.deadlockHistory.length > this.MAX_HISTORY) {
      this.deadlockHistory.shift();
    }
  }

  /**
   * Generate suggestion based on deadlock pattern
   */
  private generateSuggestion(queries: DeadlockQuery[]): string {
    const suggestions = [
      'Always access tables in the same order across transactions',
      'Keep transactions short and minimize the time locks are held',
      'Use SELECT FOR UPDATE/SHARE to explicitly lock rows',
      'Consider using application-level locking for complex operations',
      'Add appropriate indexes to reduce lock contention',
      'Use lower isolation levels if SERIALIZABLE is not required',
      'Batch operations to reduce the number of transactions'
    ];

    // Return random suggestion (could be made smarter based on query analysis)
    return suggestions[Math.floor(Math.random() * suggestions.length)];
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.deadlockHistory = [];
  }
}

export default DeadlockMonitor;
