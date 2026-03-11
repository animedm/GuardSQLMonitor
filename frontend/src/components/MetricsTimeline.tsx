import React, { useState, useEffect } from 'react';
import { TrendingUp, Activity, Database, AlertTriangle } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

interface MetricsRecord {
  id: number;
  timestamp: string;
  database_type: string;
  database_name: string;
  connections: number;
  active_connections: number;
  response_time?: number;
  queries_per_second?: number;
  cache_hit_ratio?: number;
  database_size?: number;
  cpu_usage?: number;
  memory_usage?: number;
  disk_usage?: number;
  lock_waits?: number;
}

interface MetricsTimelineProps {
  databaseType: string;
  databaseName: string;
  hours?: number;
  autoRefresh?: boolean;
  startDate?: string;
  endDate?: string;
}

export const MetricsTimeline: React.FC<MetricsTimelineProps> = ({
  databaseType,
  databaseName,
  hours = 24,
  autoRefresh = true,
  startDate,
  endDate
}) => {
  const [metrics, setMetrics] = useState<MetricsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<'connections' | 'response_time' | 'qps' | 'cache_hit_ratio'>('response_time');

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams();
      params.append('databaseType', databaseType);
      params.append('databaseName', databaseName);
      
      if (startDate && endDate) {
        params.append('startTime', new Date(startDate).toISOString());
        params.append('endTime', new Date(endDate).toISOString());
      } else {
        params.append('hours', hours.toString());
      }
      
      const response = await fetch(`http://localhost:3001/api/history/metrics?${params}`);
      if (!response.ok) throw new Error('Failed to fetch metrics');
      
      const data = await response.json();
      setMetrics(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    
    if (autoRefresh) {
      const interval = setInterval(fetchMetrics, 30000);
      return () => clearInterval(interval);
    }
  }, [databaseType, databaseName, hours, autoRefresh, startDate, endDate]);

  const getMetricValue = (record: MetricsRecord): number => {
    switch (selectedMetric) {
      case 'connections':
        return record.active_connections;
      case 'response_time':
        return record.response_time || 0;
      case 'qps':
        return record.queries_per_second || 0;
      case 'cache_hit_ratio':
        return record.cache_hit_ratio || 0;
      default:
        return 0;
    }
  };

  const getMetricLabel = (): string => {
    switch (selectedMetric) {
      case 'connections':
        return 'Active Connections';
      case 'response_time':
        return 'Response Time (ms)';
      case 'qps':
        return 'Queries/Second';
      case 'cache_hit_ratio':
        return 'Cache Hit Ratio (%)';
      default:
        return '';
    }
  };

  const calculateStats = () => {
    if (metrics.length === 0) return { avg: 0, min: 0, max: 0, current: 0 };
    
    const values = metrics.map(getMetricValue).filter(v => v !== null && v !== undefined && !isNaN(v));
    if (values.length === 0) return { avg: 0, min: 0, max: 0, current: 0 };
    
    const current = values[values.length - 1] || 0;
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    return { 
      avg: isNaN(avg) ? 0 : avg, 
      min: isNaN(min) ? 0 : min, 
      max: isNaN(max) ? 0 : max, 
      current: isNaN(current) ? 0 : current 
    };
  };

  const stats = calculateStats();

  // Prepare data for Recharts
  const prepareChartData = () => {
    return metrics.map((record) => ({
      time: new Date(record.timestamp).toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
      fullTime: new Date(record.timestamp).toLocaleString(),
      connections: record.active_connections,
      responseTime: record.response_time || 0,
      qps: record.queries_per_second || 0,
      cacheHit: record.cache_hit_ratio || 0
    }));
  };

  const chartData = prepareChartData();

  // Custom tooltip for Recharts
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-800 border border-slate-600 p-3 rounded-lg shadow-xl">
          <p className="text-slate-300 text-xs mb-2">{payload[0].payload.fullTime}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-white text-sm">
              <span style={{ color: entry.color }}>{entry.name}: </span>
              <span className="font-bold">
                {selectedMetric === 'cache_hit_ratio' 
                  ? `${entry.value.toFixed(1)}%`
                  : entry.value.toFixed(2)}
              </span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const getChartConfig = () => {
    switch (selectedMetric) {
      case 'connections':
        return { dataKey: 'connections', color: '#3b82f6', name: 'Active Connections' };
      case 'response_time':
        return { dataKey: 'responseTime', color: '#10b981', name: 'Response Time (ms)' };
      case 'qps':
        return { dataKey: 'qps', color: '#f59e0b', name: 'Queries/Second' };
      case 'cache_hit_ratio':
        return { dataKey: 'cacheHit', color: '#8b5cf6', name: 'Cache Hit %' };
      default:
        return { dataKey: 'responseTime', color: '#3b82f6', name: 'Response Time (ms)' };
    }
  };

  const renderChart = () => {
    if (chartData.length === 0) return null;
    
    const config = getChartConfig();
    
    return (
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`color${selectedMetric}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={config.color} stopOpacity={0.8}/>
              <stop offset="95%" stopColor={config.color} stopOpacity={0.1}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis 
            dataKey="time" 
            stroke="#9ca3af" 
            style={{ fontSize: '12px' }}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey={config.dataKey}
            stroke={config.color}
            strokeWidth={2}
            fillOpacity={1}
            fill={`url(#color${selectedMetric})`}
            name={config.name}
          />
        </AreaChart>
      </ResponsiveContainer>
    );
  };

  if (loading) {
    return (
      <div className="bg-slate-800 rounded-lg p-6 animate-pulse">
        <div className="h-8 bg-slate-700 rounded w-1/3 mb-4"></div>
        <div className="h-48 bg-slate-700 rounded"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-800 rounded-lg p-6">
        <div className="flex items-center gap-2 text-red-400">
          <AlertTriangle size={20} />
          <span>Error: {error}</span>
        </div>
        <button
          onClick={fetchMetrics}
          className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <TrendingUp size={24} />
          Metrics Timeline
        </h2>
        <div className="flex items-center gap-2">
          <Database size={16} className="text-blue-400" />
          <span className="text-white font-medium">
            {databaseType.toUpperCase()} - {databaseName}
          </span>
        </div>
      </div>

      {/* Metric selector */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {(['response_time', 'connections', 'qps', 'cache_hit_ratio'] as const).map((metric) => (
          <button
            key={metric}
            onClick={() => setSelectedMetric(metric)}
            className={`px-4 py-2 rounded-lg transition-colors ${
              selectedMetric === metric
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {metric === 'response_time' && 'Response Time'}
            {metric === 'connections' && 'Connections'}
            {metric === 'qps' && 'Queries/Sec'}
            {metric === 'cache_hit_ratio' && 'Cache Hit %'}
          </button>
        ))}
      </div>

      {metrics.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Activity size={48} className="mx-auto mb-4 opacity-50" />
          <p>No metrics data available</p>
          <p className="text-sm mt-2">Metrics will appear here as they are collected</p>
        </div>
      ) : (
        <>
          {/* Stats cards */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-slate-700 rounded-lg p-4">
              <div className="text-slate-400 text-sm mb-1">Current</div>
              <div className="text-2xl font-bold text-white">
                {selectedMetric === 'cache_hit_ratio'
                  ? `${(stats.current || 0).toFixed(1)}%`
                  : (stats.current || 0).toFixed(2)}
              </div>
            </div>
            <div className="bg-slate-700 rounded-lg p-4">
              <div className="text-slate-400 text-sm mb-1">Average</div>
              <div className="text-2xl font-bold text-blue-400">
                {selectedMetric === 'cache_hit_ratio'
                  ? `${(stats.avg || 0).toFixed(1)}%`
                  : (stats.avg || 0).toFixed(2)}
              </div>
            </div>
            <div className="bg-slate-700 rounded-lg p-4">
              <div className="text-slate-400 text-sm mb-1">Minimum</div>
              <div className="text-2xl font-bold text-green-400">
                {selectedMetric === 'cache_hit_ratio'
                  ? `${(stats.min || 0).toFixed(1)}%`
                  : (stats.min || 0).toFixed(2)}
              </div>
            </div>
            <div className="bg-slate-700 rounded-lg p-4">
              <div className="text-slate-400 text-sm mb-1">Maximum</div>
              <div className="text-2xl font-bold text-red-400">
                {selectedMetric === 'cache_hit_ratio'
                  ? `${(stats.max || 0).toFixed(1)}%`
                  : (stats.max || 0).toFixed(2)}
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-slate-700 rounded-lg p-4">
            <div className="text-slate-300 font-medium mb-2">{getMetricLabel()}</div>
            {renderChart()}
            <div className="flex justify-between text-xs text-slate-400 mt-2">
              <span>
                {metrics.length > 0 &&
                  new Date(metrics[0].timestamp).toLocaleTimeString()}
              </span>
              <span>{metrics.length} data points</span>
              <span>
                {metrics.length > 0 &&
                  new Date(metrics[metrics.length - 1].timestamp).toLocaleTimeString()}
              </span>
            </div>
          </div>

          {/* Recent data table */}
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-white mb-3">Recent Metrics</h3>
            <div className="bg-slate-700 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-600">
                  <tr>
                    <th className="px-4 py-2 text-left text-slate-300">Time</th>
                    <th className="px-4 py-2 text-right text-slate-300">Connections</th>
                    <th className="px-4 py-2 text-right text-slate-300">Response (ms)</th>
                    <th className="px-4 py-2 text-right text-slate-300">QPS</th>
                    <th className="px-4 py-2 text-right text-slate-300">Cache Hit %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-600">
                  {metrics.slice(-10).reverse().map((record) => (
                    <tr key={record.id} className="hover:bg-slate-650">
                      <td className="px-4 py-2 text-slate-300">
                        {new Date(record.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="px-4 py-2 text-right text-white">
                        {record.active_connections}
                      </td>
                      <td className="px-4 py-2 text-right text-white">
                        {record.response_time?.toFixed(2) || 'N/A'}
                      </td>
                      <td className="px-4 py-2 text-right text-white">
                        {record.queries_per_second?.toFixed(2) || 'N/A'}
                      </td>
                      <td className="px-4 py-2 text-right text-white">
                        {record.cache_hit_ratio?.toFixed(1) || 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
