export interface DatabaseMetrics {
  timestamp: Date;
  databaseType: 'postgres' | 'mysql' | 'mssql';
  databaseName: string;
  status: 'healthy' | 'degraded' | 'down';
  responseTime: number;
  
  // Connection metrics
  connections: {
    active: number;
    idle: number;
    total: number;
    max: number;
    waiting: number;
  };
  
  // Performance metrics
  performance: {
    queriesPerSecond: number;
    slowQueries: number;
    avgQueryTime: number;
    transactionsPerSecond: number;
  };
  
  // Resource metrics
  resources: {
    cpuUsage?: number;
    memoryUsage?: number;
    diskUsage?: number;
    cacheHitRatio?: number;
  };
  
  // Database size
  size: {
    totalSizeMB: number;
    dataSize: number;
    indexSize: number;
  };
  
  // Additional info
  uptime?: number;
  version?: string;
  replicationLag?: number;
}

export interface SlowQuery {
  timestamp: Date;
  database: string;
  query: string;
  executionTime: number;
  user?: string;
  rows?: number;
}

export interface Alert {
  id: string;
  timestamp: Date;
  severity: 'critical' | 'warning' | 'info';
  database: string;
  type: string;
  message: string;
  metric?: string;
  value?: number;
  threshold?: number;
  resolved: boolean;
}

export interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  databases: {
    [key: string]: {
      status: 'up' | 'down';
      responseTime: number;
      error?: string;
    };
  };
  uptime: number;
}
