import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, GitBranch, Database, RefreshCw, History, XCircle } from 'lucide-react';
import ConnectionDetailModal from '../components/ConnectionDetailModal';

interface DeadlockQuery {
  pid: number;
  query: string;
  user: string;
  application: string;
  waitingFor?: string;
  startTime: string;
}

interface DeadlockInfo {
  id: string;
  timestamp: string;
  databaseType: string;
  databaseName: string;
  queries: DeadlockQuery[];
  victims: string[];
  resolution: string;
  suggestion?: string;
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
}

const DeadlockAnalyzerPage: React.FC = () => {
  const navigate = useNavigate();
  const [databaseType, setDatabaseType] = useState('postgres');
  const [databaseName, setDatabaseName] = useState('neondb');
  const [scanning, setScanning] = useState(false);
  const [currentDeadlock, setCurrentDeadlock] = useState<DeadlockInfo | null>(null);
  const [history, setHistory] = useState<DeadlockInfo[]>([]);
  const [connections, setConnections] = useState<ConnectionInfo[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [autoScan, setAutoScan] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<ConnectionInfo | null>(null);
  const [showConnectionModal, setShowConnectionModal] = useState(false);

  useEffect(() => {
    loadHistory();
    loadConnections();

    if (autoScan) {
      const interval = setInterval(() => {
        scanForDeadlocks();
      }, 30000); // Every 30 seconds

      return () => clearInterval(interval);
    }
  }, [autoScan, databaseType, databaseName]);

  const scanForDeadlocks = async () => {
    setScanning(true);
    try {
      const response = await fetch('http://localhost:3001/api/monitoring/deadlocks/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ databaseType, databaseName })
      });

      if (!response.ok) throw new Error('Failed to scan for deadlocks');

      const data = await response.json();
      if (data.deadlockDetected) {
        setCurrentDeadlock(data.deadlock);
        loadHistory(); // Refresh history
      } else {
        setCurrentDeadlock(null);
      }
    } catch (error) {
      console.error('Error scanning for deadlocks:', error);
    } finally {
      setScanning(false);
    }
  };

  const loadHistory = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/monitoring/deadlocks/history?limit=20');
      if (!response.ok) throw new Error('Failed to load history');

      const data = await response.json();
      setHistory(data.deadlocks || []);
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };

  const loadConnections = async () => {
    try {
      const response = await fetch(
        `http://localhost:3001/api/monitoring/connections?databaseType=${databaseType}&databaseName=${databaseName}`
      );
      if (!response.ok) throw new Error('Failed to load connections');

      const data = await response.json();
      setConnections(data.connections || []);
    } catch (error) {
      console.error('Error loading connections:', error);
    }
  };

  const clearHistory = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/monitoring/deadlocks/history', {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to clear history');
      setHistory([]);
    } catch (error) {
      console.error('Error clearing history:', error);
    }
  };

  const blockedConnections = connections.filter(c => c.blocked);
  const blockingConnections = connections.filter(c => c.blocking && c.blocking.length > 0);

  const openConnectionDetails = (conn: ConnectionInfo) => {
    setSelectedConnection(conn);
    setShowConnectionModal(true);
  };

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
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
            <AlertTriangle className="text-red-500" size={36} />
            Deadlock Analyzer
          </h1>
          <p className="text-gray-400">
            Detect and analyze database deadlocks in real-time
          </p>
        </div>

        {/* Controls */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-2xl p-6 border border-gray-700/50 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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
                  checked={autoScan}
                  onChange={(e) => setAutoScan(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-900 border-gray-600 rounded focus:ring-blue-500"
                />
                Auto-scan (30s)
              </label>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={scanForDeadlocks}
              disabled={scanning}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {scanning ? (
                <>
                  <RefreshCw className="animate-spin" size={20} />
                  Scanning...
                </>
              ) : (
                <>
                  <AlertTriangle size={20} />
                  Scan for Deadlocks
                </>
              )}
            </button>
            <button
              onClick={loadConnections}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center gap-2"
            >
              <RefreshCw size={20} />
              Refresh Connections
            </button>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center gap-2"
            >
              <History size={20} />
              {showHistory ? 'Hide' : 'Show'} History
            </button>
          </div>
        </div>

        {/* Current Deadlock Alert */}
        {currentDeadlock && (
          <div className="bg-red-500/20 border-2 border-red-500/50 rounded-xl p-6 mb-6 animate-pulse">
            <div className="flex items-center gap-3 mb-4">
              <XCircle className="text-red-400" size={32} />
              <div>
                <h2 className="text-2xl font-bold text-red-300">Deadlock Detected!</h2>
                <p className="text-red-400">
                  {new Date(currentDeadlock.timestamp).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="bg-gray-900/50 rounded-lg p-4">
              <p className="text-gray-300 mb-2">
                <strong>Resolution:</strong> {currentDeadlock.resolution}
              </p>
              {currentDeadlock.suggestion && (
                <p className="text-yellow-300">
                  <strong>💡 Suggestion:</strong> {currentDeadlock.suggestion}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Connection Status Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-2xl p-6 border border-gray-700/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Connections</p>
                <p className="text-3xl font-bold text-white">{connections.length}</p>
              </div>
              <Database className="text-blue-400" size={40} />
            </div>
          </div>
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-2xl p-6 border border-gray-700/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Blocked Connections</p>
                <p className="text-3xl font-bold text-red-400">{blockedConnections.length}</p>
              </div>
              <XCircle className="text-red-400" size={40} />
            </div>
          </div>
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-2xl p-6 border border-gray-700/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Blocking Connections</p>
                <p className="text-3xl font-bold text-yellow-400">{blockingConnections.length}</p>
              </div>
              <AlertTriangle className="text-yellow-400" size={40} />
            </div>
          </div>
        </div>

        {/* Blocking Chains */}
        {blockingConnections.length > 0 && (
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-2xl p-6 border border-gray-700/50 mb-6">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <GitBranch className="text-yellow-400" size={24} />
              Blocking Chains
            </h2>
            <div className="space-y-3">
              {blockingConnections.map((conn) => (
                <div key={conn.pid} className="bg-gray-900/50 rounded-lg p-4 border border-yellow-500/30">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-yellow-400 font-bold text-lg">PID {conn.pid}</span>
                        <span className="px-2 py-1 bg-yellow-500/20 text-yellow-300 text-xs rounded">
                          Blocking {conn.blocking?.length} connection(s)
                        </span>
                        <span className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded">
                          {conn.state}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
                        <div>
                          <span className="text-gray-500">Usuario:</span>
                          <span className="text-white ml-2 font-medium">{conn.user}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Database:</span>
                          <span className="text-white ml-2 font-medium">{conn.database}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Aplicación:</span>
                          <span className="text-blue-300 ml-2 font-medium">{conn.application}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Duración:</span>
                          <span className="text-orange-300 ml-2 font-medium">{formatDuration(conn.duration)}</span>
                        </div>
                      </div>
                      {conn.waitEvent && (
                        <div className="mb-2 text-xs text-purple-300">
                          <span className="text-gray-500">Wait Event:</span> {conn.waitEvent}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => openConnectionDetails(conn)}
                      className="ml-4 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
                    >
                      Ver Detalles
                    </button>
                  </div>
                  <div className="mb-2">
                    <div className="text-gray-400 text-xs mb-1">Query:</div>
                    <pre className="text-xs text-gray-300 bg-black/30 p-2 rounded overflow-x-auto max-h-20">
                      {conn.query.substring(0, 250)}{conn.query.length > 250 ? '...' : ''}
                    </pre>
                  </div>
                  <div className="flex items-center gap-2 text-red-400 text-sm">
                    <XCircle size={16} />
                    <span>Blocking PIDs: {conn.blocking?.join(', ')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active Connections Table */}
        {connections.length > 0 && (
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
                      <td className="px-4 py-3 max-w-xs">
                        <div className="truncate text-gray-400 text-xs">
                          {conn.query.substring(0, 80)}...
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => openConnectionDetails(conn)}
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

        {/* History */}
        {showHistory && history.length > 0 && (
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-2xl p-6 border border-gray-700/50">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <History className="text-purple-400" size={24} />
                Deadlock History ({history.length})
              </h2>
              <button
                onClick={clearHistory}
                className="text-red-400 hover:text-red-300 text-sm"
              >
                Clear History
              </button>
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {history.map((deadlock) => (
                <div key={deadlock.id} className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-300 font-semibold">
                      {new Date(deadlock.timestamp).toLocaleString()}
                    </span>
                    <span className="text-xs text-gray-500">
                      {deadlock.databaseType.toUpperCase()} • {deadlock.databaseName}
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm mb-2">{deadlock.resolution}</p>
                  {deadlock.suggestion && (
                    <p className="text-yellow-400 text-sm">💡 {deadlock.suggestion}</p>
                  )}
                  <p className="text-gray-500 text-xs mt-2">
                    {deadlock.queries.length} queries involved
                  </p>
                </div>
              ))}
            </div>
          </div>
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

export default DeadlockAnalyzerPage;
