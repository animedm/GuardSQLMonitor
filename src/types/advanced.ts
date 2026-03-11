export interface ReplicationStatus {
  id: string;
  databaseType: 'postgres' | 'mysql' | 'mssql';
  databaseName: string;
  timestamp: Date;
  
  // Replication info
  isReplica: boolean;
  isPrimary: boolean;
  replicationState: 'streaming' | 'catchup' | 'stopped' | 'error' | 'none';
  replicationLag: number; // seconds
  replicationSlotName?: string;
  
  // Primary server info (if replica)
  primaryServer?: {
    host: string;
    port: number;
    connected: boolean;
  };
  
  // Replicas info (if primary)
  replicas?: Array<{
    name: string;
    state: string;
    lag: number;
    lastContact: Date;
  }>;
}

export interface BackupStatus {
  id: string;
  databaseType: 'postgres' | 'mysql' | 'mssql';
  databaseName: string;
  timestamp: Date;
  
  // Last backup info
  lastBackupTime?: Date;
  lastBackupSize?: number; // bytes
  lastBackupType?: 'full' | 'incremental' | 'differential';
  lastBackupStatus?: 'success' | 'failed' | 'in_progress';
  lastBackupDuration?: number; // seconds
  lastBackupLocation?: string;
  
  // Backup schedule
  backupSchedule?: string; // cron expression
  nextScheduledBackup?: Date;
  
  // Retention
  retentionDays?: number;
  totalBackups?: number;
  oldestBackup?: Date;
  
  // Status
  backupHealth: 'healthy' | 'warning' | 'critical' | 'unknown';
  daysSinceLastBackup?: number;
  warnings: string[];
}

export interface DashboardWidget {
  id: string;
  type: 'metric' | 'chart' | 'alert' | 'table' | 'gauge' | 'status';
  title: string;
  position: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  config: {
    databaseType?: string;
    databaseName?: string;
    metric?: string;
    chartType?: 'line' | 'bar' | 'area' | 'pie';
    timeRange?: number; // minutes
    refreshInterval?: number; // seconds
    thresholds?: {
      warning: number;
      critical: number;
    };
    filters?: Record<string, any>;
  };
}

export interface CustomDashboard {
  id: string;
  name: string;
  description?: string;
  owner: string;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
  widgets: DashboardWidget[];
  layout: 'grid' | 'flex';
  theme?: 'dark' | 'light' | 'auto';
  refreshInterval: number; // seconds
  tags: string[];
}
