import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

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
  type: string;
  name: string;
  host: string;
  port: number;
}

export const api = {
  // Metrics endpoints
  async getLatestMetrics(): Promise<DatabaseMetrics[]> {
    const response = await axios.get(`${API_BASE_URL}/metrics/latest`);
    return response.data;
  },

  async getMetricsHistory(type: string, name: string, limit?: number): Promise<DatabaseMetrics[]> {
    const url = `${API_BASE_URL}/metrics/history/${type}/${name}`;
    const response = await axios.get(url, { params: { limit } });
    return response.data;
  },

  async getAggregatedMetrics(type: string, name: string, minutes: number = 5) {
    const url = `${API_BASE_URL}/metrics/aggregate/${type}/${name}`;
    const response = await axios.get(url, { params: { minutes } });
    return response.data;
  },

  // Database endpoints
  async getDatabases(): Promise<Database[]> {
    const response = await axios.get(`${API_BASE_URL}/database/list`);
    return response.data;
  },

  async getSlowQueries(type: string, limit: number = 10) {
    const response = await axios.get(`${API_BASE_URL}/database/${type}/slow-queries`, {
      params: { limit }
    });
    return response.data;
  },

  async getAlerts(activeOnly: boolean = false, limit?: number): Promise<Alert[]> {
    const response = await axios.get(`${API_BASE_URL}/database/alerts`, {
      params: { active: activeOnly, limit }
    });
    return response.data;
  },

  async getAlertStats() {
    const response = await axios.get(`${API_BASE_URL}/database/alerts/stats`);
    return response.data;
  },

  async resolveAlert(id: string) {
    const response = await axios.patch(`${API_BASE_URL}/database/alerts/${id}/resolve`);
    return response.data;
  },

  async clearResolvedAlerts() {
    const response = await axios.delete(`${API_BASE_URL}/database/alerts/resolved`);
    return response.data;
  },

  // Health endpoints
  async getHealth() {
    const response = await axios.get(`${API_BASE_URL}/health`);
    return response.data;
  }
};
