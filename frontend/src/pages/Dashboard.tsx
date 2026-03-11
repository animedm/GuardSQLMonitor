import { useEffect, useState } from 'react';
import { api, DatabaseMetrics, Alert } from '../api';
import DatabaseCard from '../components/DatabaseCard';
import AlertPanel from '../components/AlertPanel';
import MetricsChart from '../components/MetricsChart';
import { Activity, AlertTriangle, Clock, Database as DBIcon } from 'lucide-react';
import { Layout } from '../components/Layout';

export function Dashboard() {
  const [metrics, setMetrics] = useState<DatabaseMetrics[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertStats, setAlertStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [metricsData, alertsData, statsData] = await Promise.all([
        api.getLatestMetrics(),
        api.getAlerts(true),
        api.getAlertStats()
      ]);
      
      setMetrics(metricsData);
      setAlerts(alertsData);
      setAlertStats(statsData);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Activity className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-400 mb-2">Error loading dashboard</p>
          <p className="text-slate-400 text-sm">{error}</p>
          <button
            onClick={fetchData}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const totalConnections = metrics.reduce((sum, m) => sum + m.connections.total, 0);
  const avgResponseTime = metrics.length > 0
    ? metrics.reduce((sum, m) => sum + m.responseTime, 0) / metrics.length
    : 0;
  const totalSlowQueries = metrics.reduce((sum, m) => sum + m.performance.slowQueries, 0);

  return (
    <Layout>
      <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-400">Databases</h3>
            <DBIcon className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-3xl font-bold text-white">{metrics.length}</p>
          <p className="text-xs text-green-500 mt-1">All operational</p>
        </div>

        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-400">Active Connections</h3>
            <Activity className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-3xl font-bold text-white">{totalConnections}</p>
          <p className="text-xs text-slate-400 mt-1">Across all databases</p>
        </div>

        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-400">Avg Response Time</h3>
            <Clock className="w-5 h-5 text-yellow-500" />
          </div>
          <p className="text-3xl font-bold text-white">{avgResponseTime.toFixed(0)}ms</p>
          <p className="text-xs text-slate-400 mt-1">Last measurement</p>
        </div>

        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-400">Active Alerts</h3>
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <p className="text-3xl font-bold text-white">{alertStats?.active || 0}</p>
          <p className="text-xs text-slate-400 mt-1">
            {alertStats?.critical || 0} critical, {alertStats?.warning || 0} warnings
          </p>
        </div>
      </div>

      {/* Alerts Panel */}
      {alerts.length > 0 && (
        <AlertPanel alerts={alerts} onResolve={fetchData} />
      )}

      {/* Database Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {metrics.map((metric) => (
          <DatabaseCard key={`${metric.databaseType}-${metric.databaseName}`} metrics={metric} />
        ))}
      </div>

      {/* Charts */}
      {metrics.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {metrics.map((metric) => (
            <MetricsChart
              key={`chart-${metric.databaseType}-${metric.databaseName}`}
              databaseType={metric.databaseType}
              databaseName={metric.databaseName}
            />
          ))}
        </div>
      )}

      {metrics.length === 0 && (
        <div className="bg-slate-800 rounded-lg p-12 border border-slate-700 text-center">
          <DBIcon className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No Databases Configured</h3>
          <p className="text-slate-400 mb-4">
            Configure your database connections in the .env file to start monitoring.
          </p>
        </div>
      )}
    </div>
    </Layout>
  );
}

export default Dashboard;
