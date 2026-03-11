import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Database, AlertTriangle, TrendingUp, TrendingDown, Minus, Users, XCircle } from 'lucide-react';
import ConnectionDetailModal from '../components/ConnectionDetailModal';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

interface ConnectionLeak {
  pid: number;
  user: string;
  application: string;
  query: string;
  idleTime: number;
  state: string;
}

interface ConnectionInfo {
  pid: number;
  user: string;
  database: string;
  application: string;
  state: string;
  query: string;
  duration: number;
  waitEvent?: string;
  blocked?: boolean;
  blocking?: number[];
  clientAddr?: string;
  clientHost?: string;
  clientPort?: number;
  backendStart?: string;
  transactionStart?: string;
  queryStart?: string;
  stateChange?: string;
}

interface PoolStats {
  databaseType: string;
  databaseName: string;
  timestamp: string;
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingClients: number;
  maxConnections: number;
  utilizationPercent: number;
  poolExhausted: boolean;
  connectionLeaks?: ConnectionLeak[];
  warnings: string[];
  recommendations: string[];
}

interface PoolMetrics {
  timestamp: string;
  active: number;
  idle: number;
  total: number;
  waiting: number;
  utilization: number;
}

interface PoolTrends {
  averageUtilization: number;
  peakUtilization: number;
  averageActive: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

const ConnectionPoolPage: React.FC = () => {
  const navigate = useNavigate();
  const [databaseType, setDatabaseType] = useState('postgres');
  const [databaseName, setDatabaseName] = useState('neondb');
  const [loading, setLoading] = useState(false);
  const [poolStats, setPoolStats] = useState<PoolStats | null>(null);
  const [history, setHistory] = useState<PoolMetrics[]>([]);
  const [trends, setTrends] = useState<PoolTrends | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [connections, setConnections] = useState<ConnectionInfo[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<any>(null);
  const [showConnectionModal, setShowConnectionModal] = useState(false);

  const openConnectionDetails = (leak: ConnectionLeak) => {
    // Convert ConnectionLeak to ConnectionInfo format for modal
    const connectionInfo = {
      ...leak,
      database: databaseName,
      duration: leak.idleTime,
      waitEvent: undefined,
      blocked: false,
      blocking: [],
    };
    setSelectedConnection(connectionInfo);
    setShowConnectionModal(true);
  };

  const openConnectionDetailsFromActive = (conn: ConnectionInfo) => {
    setSelectedConnection(conn);
    setShowConnectionModal(true);
  };

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  };

  const loadConnections = async () => {
    try {
      const response = await fetch(
        `http://localhost:3001/api/monitoring/connections?databaseType=${databaseType}&databaseName=${databaseName}`
      );
      if (!response.ok) throw new Error('Failed to load connections');

      const data = await response.json();
      // Ensure data is an array
      setConnections(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading connections:', error);
      setConnections([]);
    }
  };

  useEffect(() => {
    loadPoolStats();
    loadHistory();
    loadTrends();
    loadConnections();

    if (autoRefresh) {
      const interval = setInterval(() => {
        loadPoolStats();
        loadHistory();
        loadTrends();
        loadConnections();
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [autoRefresh, databaseType, databaseName]);

  const loadPoolStats = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `http://localhost:3001/api/monitoring/pool/stats?databaseType=${databaseType}&databaseName=${databaseName}`
      );
      if (!response.ok) throw new Error('Failed to load pool stats');

      const data = await response.json();
      setPoolStats(data);
    } catch (error) {
      console.error('Error loading pool stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      const response = await fetch(
        `http://localhost:3001/api/monitoring/pool/history?databaseName=${databaseName}&limit=50`
      );
      if (!response.ok) throw new Error('Failed to load history');

      const data = await response.json();
      setHistory(data.metrics || []);
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };

  const loadTrends = async () => {
    try {
      const response = await fetch(
        `http://localhost:3001/api/monitoring/pool/trends?databaseName=${databaseName}`
      );
      if (!response.ok) throw new Error('Failed to load trends');

      const data = await response.json();
      setTrends(data);
    } catch (error) {
      console.error('Error loading trends:', error);
    }
  };

  const getTrendIcon = () => {
    if (!trends) return <Minus className="text-gray-400" size={20} />;
    switch (trends.trend) {
      case 'increasing':
        return <TrendingUp className="text-red-400" size={20} />;
      case 'decreasing':
        return <TrendingDown className="text-green-400" size={20} />;
      default:
        return <Minus className="text-blue-400" size={20} />;
    }
  };

  const formatChartData = () => {
    return history.map((m) => ({
      time: new Date(m.timestamp).toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
      active: m.active,
      idle: m.idle,
      total: m.total,
      utilization: m.utilization
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/')}
            className="mb-4 text-blue-400 hover:text-blue-300 flex items-center gap-2 transition-colors"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
            <Activity className="text-blue-500" size={36} />
            Connection Pool Monitor
          </h1>
          <p className="text-gray-400">
            Real-time monitoring of database connection pools
          </p>
        </div>

        {/* Controls */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-2xl p-6 border border-gray-700/50 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Database Type</label>
              <select
                value={databaseType}
                onChange={(e) => setDatabaseType(e.target.value)}
                className="w-full bg-gray-900/50 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="postgres">PostgreSQL</option>
                <option value="mysql">MySQL</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Database Name</label>
              <input
                type="text"
                value={databaseName}
                onChange={(e) => setDatabaseName(e.target.value)}
                className="w-full bg-gray-900/50 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-end gap-2">
              <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-900 border-gray-600 rounded focus:ring-blue-500"
                />
                Auto-refresh (30s)
              </label>
              <button
                onClick={() => {
                  loadPoolStats();
                  loadHistory();
                  loadTrends();
                }}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>

        {poolStats && (
          <>
            {/* Status Alert */}
            {poolStats.poolExhausted && (
              <div className="bg-red-500/20 border-2 border-red-500/50 rounded-xl p-4 mb-6">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="text-red-400" size={24} />
                  <div>
                    <h3 className="text-red-300 font-bold text-lg">Pool Exhausted!</h3>
                    <p className="text-red-400">Connection pool is at maximum capacity</p>
                  </div>
                </div>
              </div>
            )}

            {/* Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-2xl p-6 border border-gray-700/50">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-gray-400 text-sm">Total Connections</p>
                  <Database className="text-blue-400" size={24} />
                </div>
                <p className="text-3xl font-bold text-white">{poolStats.totalConnections}</p>
                <p className="text-xs text-gray-500 mt-1">
                  of {poolStats.maxConnections} max
                </p>
              </div>

              <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-2xl p-6 border border-gray-700/50">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-gray-400 text-sm">Active</p>
                  <Activity className="text-green-400" size={24} />
                </div>
                <p className="text-3xl font-bold text-green-400">{poolStats.activeConnections}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {((poolStats.activeConnections / poolStats.totalConnections) * 100).toFixed(1)}% of total
                </p>
              </div>

              <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-2xl p-6 border border-gray-700/50">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-gray-400 text-sm">Idle</p>
                  <Users className="text-yellow-400" size={24} />
                </div>
                <p className="text-3xl font-bold text-yellow-400">{poolStats.idleConnections}</p>
                <p className="text-xs text-gray-500 mt-1">Available for use</p>
              </div>

              <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-2xl p-6 border border-gray-700/50">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-gray-400 text-sm">Utilization</p>
                  {getTrendIcon()}
                </div>
                <p className={`text-3xl font-bold ${
                  poolStats.utilizationPercent >= 80 ? 'text-red-400' :
                  poolStats.utilizationPercent >= 60 ? 'text-yellow-400' :
                  'text-green-400'
                }`}>
                  {poolStats.utilizationPercent.toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {trends?.trend || 'stable'}
                </p>
              </div>
            </div>

            {/* Additional Metrics - Second Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-2xl p-6 border border-gray-700/50">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-gray-400 text-sm">Blocked Connections</p>
                  <XCircle className="text-red-400" size={24} />
                </div>
                <p className="text-3xl font-bold text-red-400">
                  {Array.isArray(connections) ? connections.filter(c => c.blocked).length : 0}
                </p>
                <p className="text-xs text-gray-500 mt-1">Waiting for locks</p>
              </div>

              <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-2xl p-6 border border-gray-700/50">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-gray-400 text-sm">Blocking Connections</p>
                  <AlertTriangle className="text-yellow-400" size={24} />
                </div>
                <p className="text-3xl font-bold text-yellow-400">
                  {Array.isArray(connections) ? connections.filter(c => c.blocking && c.blocking.length > 0).length : 0}
                </p>
                <p className="text-xs text-gray-500 mt-1">Holding locks</p>
              </div>

              <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-2xl p-6 border border-gray-700/50">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-gray-400 text-sm">Long Running</p>
                  <Activity className="text-orange-400" size={24} />
                </div>
                <p className="text-3xl font-bold text-orange-400">
                  {Array.isArray(connections) ? connections.filter(c => c.duration > 300).length : 0}
                </p>
                <p className="text-xs text-gray-500 mt-1">&gt; 5 minutes</p>
              </div>

              <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-2xl p-6 border border-gray-700/50">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-gray-400 text-sm">With Wait Events</p>
                  <Database className="text-purple-400" size={24} />
                </div>
                <p className="text-3xl font-bold text-purple-400">
                  {Array.isArray(connections) ? connections.filter(c => c.waitEvent && c.waitEvent !== ':').length : 0}
                </p>
                <p className="text-xs text-gray-500 mt-1">Currently waiting</p>
              </div>
            </div>

            {/* All Active Connections */}
            {Array.isArray(connections) && connections.length > 0 && (
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-2xl p-6 border border-gray-700/50 mb-6">
                <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                  <Database className="text-blue-400" size={24} />
                  All Active Connections ({connections.length})
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-900/50 border-b border-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-gray-300">PID</th>
                        <th className="px-4 py-3 text-left text-gray-300">Usuario</th>
                        <th className="px-4 py-3 text-left text-gray-300">Database</th>
                        <th className="px-4 py-3 text-left text-gray-300">Aplicación</th>
                        <th className="px-4 py-3 text-left text-gray-300">Estado</th>
                        <th className="px-4 py-3 text-left text-gray-300">Duración</th>
                        <th className="px-4 py-3 text-left text-gray-300">IP Cliente</th>
                        <th className="px-4 py-3 text-left text-gray-300">Query</th>
                        <th className="px-4 py-3 text-center text-gray-300">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700/50">
                      {connections.map((conn) => (
                        <tr 
                          key={conn.pid} 
                          className={`hover:bg-gray-700/30 transition-colors ${
                            conn.blocked ? 'bg-red-500/10' : 
                            conn.blocking && conn.blocking.length > 0 ? 'bg-yellow-500/10' : ''
                          }`}
                        >
                          <td className="px-4 py-3">
                            <span className="font-mono text-blue-300">{conn.pid}</span>
                            {conn.blocked && (
                              <span className="ml-2 px-1.5 py-0.5 bg-red-500/30 text-red-300 text-xs rounded">
                                BLOCKED
                              </span>
                            )}
                            {conn.blocking && conn.blocking.length > 0 && (
                              <span className="ml-2 px-1.5 py-0.5 bg-yellow-500/30 text-yellow-300 text-xs rounded">
                                BLOCKING
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-300">{conn.user}</td>
                          <td className="px-4 py-3 text-gray-300">{conn.database}</td>
                          <td className="px-4 py-3 text-blue-300 font-medium">{conn.application}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-xs ${
                              conn.state === 'active' ? 'bg-green-500/20 text-green-300' :
                              conn.state === 'idle' ? 'bg-gray-500/20 text-gray-400' :
                              'bg-yellow-500/20 text-yellow-300'
                            }`}>
                              {conn.state}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-orange-300">{formatDuration(conn.duration)}</td>
                          <td className="px-4 py-3">
                            {conn.clientAddr ? (
                              <span className="text-green-300 font-mono text-xs">{conn.clientAddr}</span>
                            ) : (
                              <span className="text-gray-500 text-xs">N/A</span>
                            )}
                          </td>
                          <td className="px-4 py-3 max-w-xs">
                            <div className="truncate text-gray-400 text-xs">
                              {conn.query.substring(0, 80)}...
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => openConnectionDetailsFromActive(conn)}
                              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
                            >
                              Detalles
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Warnings */}
            {poolStats.warnings.length > 0 && (
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-2xl p-6 border border-gray-700/50 mb-6">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <AlertTriangle className="text-yellow-400" size={24} />
                  Warnings
                </h2>
                <div className="space-y-2">
                  {poolStats.warnings.map((warning, idx) => (
                    <div key={idx} className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-3 text-yellow-300">
                      {warning}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Connection Leaks */}
            {poolStats.connectionLeaks && poolStats.connectionLeaks.length > 0 && (
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-2xl p-6 border border-gray-700/50 mb-6">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <XCircle className="text-red-400" size={24} />
                  Connection Leaks Detected ({poolStats.connectionLeaks.length})
                </h2>
                <div className="space-y-3">
                  {poolStats.connectionLeaks.map((leak) => (
                    <div key={leak.pid} className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-red-400 font-bold text-lg">PID {leak.pid}</span>
                            <span className="px-2 py-1 bg-red-500/20 text-red-300 text-xs rounded">
                              {leak.state}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
                            <div>
                              <span className="text-gray-500">Usuario:</span>
                              <span className="text-white ml-2 font-medium">{leak.user}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Aplicación:</span>
                              <span className="text-blue-300 ml-2 font-medium">{leak.application}</span>
                            </div>
                            <div className="col-span-2">
                              <span className="text-gray-500">Tiempo Idle:</span>
                              <span className="text-orange-300 ml-2 font-bold">{formatDuration(leak.idleTime)}</span>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => openConnectionDetails(leak)}
                          className="ml-4 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
                        >
                          Ver Detalles
                        </button>
                      </div>
                      <div>
                        <div className="text-gray-400 text-xs mb-1">Query:</div>
                        <pre className="text-xs text-gray-300 bg-black/30 p-2 rounded overflow-x-auto max-h-20">
                          {leak.query.substring(0, 200)}{leak.query.length > 200 ? '...' : ''}
                        </pre>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {poolStats.recommendations.length > 0 && (
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-2xl p-6 border border-gray-700/50 mb-6">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  💡 Recommendations
                </h2>
                <div className="space-y-2">
                  {poolStats.recommendations.map((rec, idx) => (
                    <div key={idx} className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-3 text-blue-300">
                      {rec}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Charts */}
            {history.length > 0 && (
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-2xl p-6 border border-gray-700/50">
                <h2 className="text-xl font-bold text-white mb-4">Connection History</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={formatChartData()}>
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
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1f2937',
                        border: '1px solid #374151',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="active" 
                      stroke="#10b981" 
                      strokeWidth={2}
                      name="Active"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="idle" 
                      stroke="#f59e0b" 
                      strokeWidth={2}
                      name="Idle"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="total" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      name="Total"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </div>

      {/* Connection Detail Modal */}
      <ConnectionDetailModal 
        show={showConnectionModal}
        connection={selectedConnection}
        onClose={() => setShowConnectionModal(false)}
      />
    </div>
  );
};

export default ConnectionPoolPage;
