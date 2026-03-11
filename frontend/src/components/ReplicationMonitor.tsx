import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface ReplicationStatus {
  isReplica: boolean;
  isPrimary: boolean;
  replicationLag: number | null;
  primaryServer?: string;
  replicas: Array<{
    name: string;
    state: string;
    lag: number;
  }>;
  lastChecked: Date;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const ReplicationMonitor: React.FC = () => {
  const [statuses, setStatuses] = useState<Record<string, ReplicationStatus>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchReplicationStatuses();
    const interval = setInterval(fetchReplicationStatuses, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchReplicationStatuses = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/database/replication`);
      setStatuses(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch replication statuses');
      console.error('Replication fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatLag = (lag: number | null): string => {
    if (lag === null) return 'N/A';
    if (lag === 0) return '0 bytes';
    if (lag < 1024) return `${lag} bytes`;
    if (lag < 1024 * 1024) return `${(lag / 1024).toFixed(2)} KB`;
    if (lag < 1024 * 1024 * 1024) return `${(lag / (1024 * 1024)).toFixed(2)} MB`;
    return `${(lag / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const getLagColor = (lag: number | null): string => {
    if (lag === null) return 'text-gray-500';
    if (lag === 0) return 'text-green-600';
    if (lag < 1024 * 1024) return 'text-yellow-600'; // < 1MB
    return 'text-red-600'; // >= 1MB
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900 bg-opacity-20 border border-red-700 rounded-lg p-4">
        <div className="flex items-center">
          <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <span className="text-red-300">{error}</span>
        </div>
      </div>
    );
  }

  const databases = Object.entries(statuses);

  if (databases.length === 0) {
    return (
      <div className="bg-yellow-900 bg-opacity-20 border border-yellow-700 rounded-lg p-4">
        <p className="text-yellow-300">No replication data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-white">Replication Status</h2>
        <button
          onClick={fetchReplicationStatuses}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Refresh
        </button>
      </div>

      {databases.map(([dbKey, status]) => (
        <div key={dbKey} className="bg-slate-800 rounded-lg shadow-md p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-white">{dbKey}</h3>
            <div className="flex space-x-2">
              {status?.isReplica && (
                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                  Replica
                </span>
              )}
              {status?.isPrimary && (
                <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
                  Primary
                </span>
              )}
            </div>
          </div>

          {status?.isReplica && (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-slate-700 rounded-lg">
                <span className="text-slate-300">Primary Server:</span>
                <span className="font-medium text-white">{status.primaryServer || 'Unknown'}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-700 rounded-lg">
                <span className="text-slate-300">Replication Lag:</span>
                <span className={`font-medium ${getLagColor(status.replicationLag)}`}>
                  {formatLag(status.replicationLag)}
                </span>
              </div>
            </div>
          )}

          {status?.isPrimary && status?.replicas && status.replicas.length > 0 && (
            <div className="mt-4">
              <h4 className="text-lg font-medium text-white mb-3">Connected Replicas</h4>
              <div className="space-y-2">
                {status.replicas.map((replica, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-700 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${
                        replica.state === 'streaming' ? 'bg-green-500' : 'bg-yellow-500'
                      }`}></div>
                      <span className="font-medium text-white">{replica.name}</span>
                      <span className="text-sm text-slate-400">({replica.state})</span>
                    </div>
                    <span className={`text-sm ${getLagColor(replica.lag)}`}>
                      {formatLag(replica.lag)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!status?.isReplica && !status?.isPrimary && (
            <p className="text-slate-400 italic">Standalone database (no replication configured)</p>
          )}

          <div className="mt-4 text-xs text-slate-500">
            Last checked: {status?.lastChecked ? new Date(status.lastChecked).toLocaleString() : 'N/A'}
          </div>
        </div>
      ))}
    </div>
  );
};
