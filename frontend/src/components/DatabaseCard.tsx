import { DatabaseMetrics } from '../api';
import { Activity, HardDrive, Zap, Database as DBIcon } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface DatabaseCardProps {
  metrics: DatabaseMetrics;
}

export default function DatabaseCard({ metrics }: DatabaseCardProps) {
  const connectionUsage = (metrics.connections.total / metrics.connections.max) * 100;
  const statusColor = metrics.status === 'healthy' ? 'green' : metrics.status === 'degraded' ? 'yellow' : 'red';
  
  const dbIcon = {
    postgres: '🐘',
    mysql: '🐬',
    mssql: '🗄️'
  }[metrics.databaseType] || '💾';

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="bg-slate-750 px-6 py-4 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-3xl">{dbIcon}</span>
            <div>
              <h3 className="text-lg font-semibold text-white capitalize">
                {metrics.databaseType}
              </h3>
              <p className="text-sm text-slate-400">{metrics.databaseName}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full bg-${statusColor}-500 animate-pulse`}></div>
            <span className={`text-sm font-medium text-${statusColor}-500 capitalize`}>
              {metrics.status}
            </span>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="p-6 space-y-6">
        {/* Connections */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium text-slate-300">Connections</span>
            </div>
            <span className="text-sm text-slate-400">
              {metrics.connections.total} / {metrics.connections.max}
            </span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${
                connectionUsage > 90 ? 'bg-red-500' : connectionUsage > 70 ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${connectionUsage}%` }}
            ></div>
          </div>
          <div className="flex justify-between mt-2 text-xs text-slate-400">
            <span>Active: {metrics.connections.active}</span>
            <span>Idle: {metrics.connections.idle}</span>
            <span>Waiting: {metrics.connections.waiting}</span>
          </div>
        </div>

        {/* Performance Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-700/50 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Zap className="w-4 h-4 text-yellow-500" />
              <span className="text-xs text-slate-400">Response Time</span>
            </div>
            <p className="text-2xl font-bold text-white">{metrics.responseTime}ms</p>
          </div>

          <div className="bg-slate-700/50 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Activity className="w-4 h-4 text-orange-500" />
              <span className="text-xs text-slate-400">Slow Queries</span>
            </div>
            <p className="text-2xl font-bold text-white">{metrics.performance.slowQueries}</p>
          </div>
        </div>

        {/* Database Size */}
        <div>
          <div className="flex items-center space-x-2 mb-2">
            <HardDrive className="w-4 h-4 text-purple-500" />
            <span className="text-sm font-medium text-slate-300">Database Size</span>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-white">
              {metrics.size.totalSizeMB.toFixed(2)}
            </span>
            <span className="text-sm text-slate-400">MB</span>
          </div>
          <div className="mt-2 text-xs text-slate-400 space-y-1">
            <div className="flex justify-between">
              <span>Data:</span>
              <span>{metrics.size.dataSize.toFixed(2)} MB</span>
            </div>
            {metrics.size.indexSize > 0 && (
              <div className="flex justify-between">
                <span>Indexes:</span>
                <span>{metrics.size.indexSize.toFixed(2)} MB</span>
              </div>
            )}
          </div>
        </div>

        {/* Additional Info */}
        <div className="pt-4 border-t border-slate-700 space-y-2 text-xs">
          {metrics.resources.cacheHitRatio !== undefined && (
            <div className="flex justify-between">
              <span className="text-slate-400">Cache Hit Ratio:</span>
              <span className="text-slate-300 font-medium">
                {metrics.resources.cacheHitRatio.toFixed(1)}%
              </span>
            </div>
          )}
          {metrics.uptime !== undefined && (
            <div className="flex justify-between">
              <span className="text-slate-400">Uptime:</span>
              <span className="text-slate-300 font-medium">
                {formatDistanceToNow(new Date(Date.now() - metrics.uptime * 1000))}
              </span>
            </div>
          )}
          {metrics.version && (
            <div className="flex justify-between">
              <span className="text-slate-400">Version:</span>
              <span className="text-slate-300 font-medium text-right text-xs">
                {metrics.version.split(' ')[0]}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-slate-400">Last Updated:</span>
            <span className="text-slate-300 font-medium">
              {formatDistanceToNow(new Date(metrics.timestamp), { addSuffix: true })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
