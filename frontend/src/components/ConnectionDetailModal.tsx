import React from 'react';
import { X, Database, User, Clock, Server, Activity, AlertCircle, GitBranch } from 'lucide-react';

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

interface ConnectionDetailModalProps {
  show: boolean;
  connection: ConnectionInfo | null;
  onClose: () => void;
}

const ConnectionDetailModal: React.FC<ConnectionDetailModalProps> = ({ show, connection, onClose }) => {
  if (!show || !connection) return null;

  const formatTime = (isoString?: string) => {
    if (!isoString) return 'N/A';
    try {
      const date = new Date(isoString);
      return date.toLocaleString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return 'N/A';
    }
  };

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  };

  const getStateColor = (state: string) => {
    switch (state.toLowerCase()) {
      case 'active':
        return 'text-green-400 bg-green-500/20';
      case 'idle':
        return 'text-gray-400 bg-gray-500/20';
      case 'idle in transaction':
        return 'text-yellow-400 bg-yellow-500/20';
      default:
        return 'text-blue-400 bg-blue-500/20';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-gray-900 rounded-2xl shadow-2xl border border-gray-700 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-900/90 to-purple-900/90 backdrop-blur-sm p-6 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Database className="text-blue-400" size={28} />
            <div>
              <h2 className="text-2xl font-bold text-white">Detalles de Conexión</h2>
              <p className="text-gray-300 text-sm mt-1">PID: {connection.pid}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Connection Info Section */}
          <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700/50">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Server className="text-blue-400" size={20} />
              Información de Conexión
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-gray-500 text-sm mb-1">Usuario</p>
                <p className="text-white font-medium flex items-center gap-2">
                  <User size={16} className="text-blue-400" />
                  {connection.user}
                </p>
              </div>
              <div>
                <p className="text-gray-500 text-sm mb-1">Base de Datos</p>
                <p className="text-white font-medium flex items-center gap-2">
                  <Database size={16} className="text-purple-400" />
                  {connection.database}
                </p>
              </div>
              <div>
                <p className="text-gray-500 text-sm mb-1">Aplicación</p>
                <p className="text-blue-300 font-medium">{connection.application}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm mb-1">Estado</p>
                <span className={`px-3 py-1 rounded-full text-sm font-medium inline-flex items-center gap-2 ${getStateColor(connection.state)}`}>
                  <Activity size={14} />
                  {connection.state}
                </span>
              </div>
              {connection.clientAddr && (
                <div>
                  <p className="text-gray-500 text-sm mb-1">IP Cliente</p>
                  <p className="text-green-300 font-mono">{connection.clientAddr}</p>
                </div>
              )}
              {connection.clientHost && (
                <div>
                  <p className="text-gray-500 text-sm mb-1">Hostname Cliente</p>
                  <p className="text-green-300 font-medium">{connection.clientHost}</p>
                </div>
              )}
              {connection.clientPort && (
                <div>
                  <p className="text-gray-500 text-sm mb-1">Puerto Cliente</p>
                  <p className="text-cyan-300 font-mono">{connection.clientPort}</p>
                </div>
              )}
            </div>
          </div>

          {/* Timing Section */}
          <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700/50">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Clock className="text-orange-400" size={20} />
              Timing y Duración
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-gray-500 text-sm mb-1">Duración Actual</p>
                <p className="text-orange-300 font-bold text-lg">{formatDuration(connection.duration)}</p>
              </div>
              {connection.backendStart && (
                <div>
                  <p className="text-gray-500 text-sm mb-1">Backend Inicio</p>
                  <p className="text-gray-300 text-sm font-mono">{formatTime(connection.backendStart)}</p>
                </div>
              )}
              {connection.transactionStart && (
                <div>
                  <p className="text-gray-500 text-sm mb-1">Transacción Inicio</p>
                  <p className="text-gray-300 text-sm font-mono">{formatTime(connection.transactionStart)}</p>
                </div>
              )}
              {connection.queryStart && (
                <div>
                  <p className="text-gray-500 text-sm mb-1">Query Inicio</p>
                  <p className="text-gray-300 text-sm font-mono">{formatTime(connection.queryStart)}</p>
                </div>
              )}
              {connection.stateChange && (
                <div>
                  <p className="text-gray-500 text-sm mb-1">Último Cambio de Estado</p>
                  <p className="text-gray-300 text-sm font-mono">{formatTime(connection.stateChange)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Blocking Info Section */}
          {(connection.blocked || (connection.blocking && connection.blocking.length > 0)) && (
            <div className="bg-gray-800/50 rounded-xl p-5 border border-red-700/50">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <AlertCircle className="text-red-400" size={20} />
                Estado de Bloqueo
              </h3>
              <div className="space-y-3">
                {connection.blocked && (
                  <div className="flex items-center gap-2 text-red-400">
                    <AlertCircle size={16} />
                    <span className="font-medium">Esta conexión está BLOQUEADA</span>
                  </div>
                )}
                {connection.blocking && connection.blocking.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 text-yellow-400 mb-2">
                      <GitBranch size={16} />
                      <span className="font-medium">Bloqueando {connection.blocking.length} conexión(es)</span>
                    </div>
                    <div className="pl-6 space-y-1">
                      {connection.blocking.map((pid) => (
                        <div key={pid} className="text-gray-300 text-sm font-mono">
                          → PID: {pid}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Wait Event Section */}
          {connection.waitEvent && connection.waitEvent !== ':' && (
            <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700/50">
              <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                <Activity className="text-purple-400" size={20} />
                Wait Event
              </h3>
              <p className="text-purple-300 font-mono text-sm bg-purple-900/20 p-3 rounded">
                {connection.waitEvent}
              </p>
            </div>
          )}

          {/* Query Section */}
          <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700/50">
            <h3 className="text-lg font-bold text-white mb-3">Query Completo</h3>
            <div className="bg-black/50 rounded-lg p-4 max-h-96 overflow-y-auto">
              <pre className="text-sm text-gray-300 font-mono whitespace-pre-wrap break-words">
                {connection.query}
              </pre>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-800/90 backdrop-blur-sm p-4 border-t border-gray-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors font-medium"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConnectionDetailModal;
