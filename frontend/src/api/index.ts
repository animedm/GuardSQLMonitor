import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000
});

export interface DatabaseMetrics {
  timestamp: string;
  databaseType: 'postgres' | 'mysql' | 'mssql';
  databaseName: string;
  status: 'healthy' | 'degraded' | 'down';
  responseTime: number;
  connections: {
    active: number;
    idle: number;
    total: number;
    max: number;
    waiting: number;
  };
  performance: {
    queriesPerSecond: number;
    slowQueries: number;
    avgQueryTime: number;
    transactionsPerSecond: number;
  };
  resources: {
    cpuUsage?: number;
    memoryUsage?: number;
    diskUsage?: number;
    cacheHitRatio?: number;
  };
  size: {
    totalSizeMB: number;
    dataSize: number;
    indexSize: number;
  };
  uptime?: number;
  version?: string;
}

export interface Alert {
  id: string;
  timestamp: string;
  severity: 'critical' | 'warning' | 'info';
  database: string;
  type: string;
  message: string;
  metric?: string;
  value?: number;
  threshold?: number;
  resolved: boolean;
}

export interface Database {
  id?: string;
  type: string;
  name: string;
  host: string;
  port: number;
  database?: string;
}

export interface ConnectionEntry {
  id: string;
  name: string;
  type: 'postgres' | 'mysql' | 'mssql';
  enabled: boolean;
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  alertSettings?: {
    enabled: boolean;
    snoozedUntil?: string;
    thresholds?: Partial<AlertThresholds>;
    maintenanceWindow?: {
      enabled: boolean;
      startHour: number;
      endHour: number;
      daysOfWeek?: number[];
      mutedMetrics?: {
        cpu: boolean;
        memory: boolean;
        connections: boolean;
        slowQueryCount: boolean;
      };
    };
  };
}

export interface HistoricalMetricRow {
  timestamp: string;
  database_type: 'postgres' | 'mysql' | 'mssql';
  database_name: string;
  connections_total: number;
  connections_active: number;
  connections_idle: number;
  response_time: number;
  slow_queries: number;
}

export interface AlertThresholds {
  cpu: number;
  memory: number;
  connections: number;
  slowQueryCount: number;
}

export interface GlobalAlertSettings {
  enabled: boolean;
  cooldownMinutes: number;
  email: {
    enabled: boolean;
    to: string;
  };
  webhook: {
    enabled: boolean;
    url: string;
  };
  thresholds: AlertThresholds;
}

export interface ConnectionsConfig {
  connections: ConnectionEntry[];
  alerts?: GlobalAlertSettings;
}

export const api = {
  // Metrics endpoints
  async getLatestMetrics(): Promise<DatabaseMetrics[]> {
    const response = await apiClient.get('/metrics/latest');
    return response.data;
  },

  async getMetricsHistory(type: string, name: string, limit?: number): Promise<DatabaseMetrics[]> {
    const response = await apiClient.get(`/metrics/history/${type}/${name}`, { params: { limit } });
    return response.data;
  },

  async getHistoricalMetrics(type: string, name: string, hours: number = 24): Promise<HistoricalMetricRow[]> {
    const response = await apiClient.get('/history/metrics', {
      params: {
        databaseType: type,
        databaseName: name,
        hours
      }
    });
    return response.data;
  },

  async getAggregatedMetrics(type: string, name: string, minutes: number = 5) {
    const response = await apiClient.get(`/metrics/aggregate/${type}/${name}`, { params: { minutes } });
    return response.data;
  },

  // Database endpoints
  async getDatabases(): Promise<Database[]> {
    const response = await apiClient.get('/database/list');
    return response.data;
  },

  async getSlowQueries(type: string, limit: number = 10) {
    const response = await apiClient.get(`/database/${type}/slow-queries`, {
      params: { limit }
    });
    return response.data;
  },

  async getAlerts(activeOnly: boolean = false, limit?: number): Promise<Alert[]> {
    const response = await apiClient.get('/database/alerts', {
      params: { active: activeOnly, limit }
    });
    return response.data;
  },

  async getAlertStats() {
    const response = await apiClient.get('/database/alerts/stats');
    return response.data;
  },

  async resolveAlert(id: string) {
    const response = await apiClient.patch(`/database/alerts/${id}/resolve`);
    return response.data;
  },

  async clearResolvedAlerts() {
    const response = await apiClient.delete('/database/alerts/resolved');
    return response.data;
  },

  // Health endpoints
  async getHealth() {
    const response = await apiClient.get('/health');
    return response.data;
  },

  // Connections config endpoints
  async getConnections(): Promise<ConnectionsConfig> {
    const response = await apiClient.get('/connections');
    return response.data;
  },

  async saveConnections(data: ConnectionsConfig) {
    const response = await apiClient.put('/connections', data);
    return response.data;
  },

  async testConnection(params: { type: string; host: string; port: number; database: string; user: string; password: string }): Promise<{ success: boolean; responseTime?: number; error?: string }> {
    const response = await apiClient.post('/connections/test', params);
    return response.data;
  },
};
