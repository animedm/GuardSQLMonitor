import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface BackupStatus {
  lastBackupTime: Date | null;
  backupType: 'full' | 'incremental' | 'differential' | 'unknown';
  backupSize: number | null;
  backupStatus: 'healthy' | 'warning' | 'critical' | 'unknown';
  daysSinceLastBackup: number | null;
  warnings: string[];
  lastChecked: Date;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const BackupMonitor: React.FC = () => {
  const [statuses, setStatuses] = useState<Record<string, BackupStatus>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBackupStatuses();
    const interval = setInterval(fetchBackupStatuses, 60000); // Refresh every 60s
    return () => clearInterval(interval);
  }, []);

  const fetchBackupStatuses = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/database/backup`);
      setStatuses(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch backup statuses');
      console.error('Backup fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatSize = (bytes: number | null): string => {
    if (bytes === null) return 'N/A';
    if (bytes === 0) return '0 bytes';
    if (bytes < 1024) return `${bytes} bytes`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'healthy': return 'text-green-400';
      case 'warning': return 'text-yellow-400';
      case 'critical': return 'text-red-400';
      default: return 'text-slate-400';
    }
  };

  const getStatusIcon = (status: string): JSX.Element => {
    switch (status) {
      case 'healthy':
        return (
          <svg className="w-6 h-6 text-green-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="w-6 h-6 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      case 'critical':
        return (
          <svg className="w-6 h-6 text-red-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg className="w-6 h-6 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        );
    }
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
        <p className="text-yellow-300">No backup data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-white">Backup Status</h2>
        <button
          onClick={fetchBackupStatuses}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Refresh
        </button>
      </div>

      {databases.map(([dbKey, status]) => (
        <div key={dbKey} className="bg-slate-800 rounded-lg shadow-md p-6 border-2 border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              {getStatusIcon(status?.backupStatus || 'unknown')}
              <h3 className="text-xl font-semibold text-white">{dbKey}</h3>
            </div>
            <span className={`px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(status?.backupStatus || 'unknown')}`}>
              {(status?.backupStatus || 'UNKNOWN').toUpperCase()}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="p-3 bg-slate-700 rounded-lg">
              <span className="text-sm text-slate-400 block mb-1">Last Backup</span>
              <span className="font-medium text-white">
                {status.lastBackupTime 
                  ? new Date(status.lastBackupTime).toLocaleString()
                  : 'Never'}
              </span>
            </div>

            <div className="p-3 bg-slate-700 rounded-lg">
              <span className="text-sm text-slate-400 block mb-1">Days Since Last Backup</span>
              <span className={`font-medium ${
                status?.daysSinceLastBackup === null || status?.daysSinceLastBackup === undefined ? 'text-slate-500' :
                status.daysSinceLastBackup > 7 ? 'text-red-400' :
                status.daysSinceLastBackup > 3 ? 'text-yellow-400' :
                'text-green-400'
              }`}>
                {status?.daysSinceLastBackup !== null && status?.daysSinceLastBackup !== undefined ? `${status.daysSinceLastBackup} days` : 'N/A'}
              </span>
            </div>

            <div className="p-3 bg-slate-700 rounded-lg">
              <span className="text-sm text-slate-400 block mb-1">Backup Type</span>
              <span className="font-medium text-white capitalize">{status?.backupType || 'unknown'}</span>
            </div>

            <div className="p-3 bg-slate-700 rounded-lg">
              <span className="text-sm text-slate-400 block mb-1">Backup Size</span>
              <span className="font-medium text-white">{formatSize(status?.backupSize || null)}</span>
            </div>
          </div>

          {status?.warnings && status.warnings.length > 0 && (
            <div className="mt-4 space-y-2">
              <h4 className="font-medium text-sm text-yellow-400">Warnings:</h4>
              <ul className="space-y-1">
                {status.warnings.map((warning, idx) => (
                  <li key={idx} className="flex items-start space-x-2">
                    <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm text-slate-300">{warning}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 text-xs text-slate-500">
            Last checked: {status?.lastChecked ? new Date(status.lastChecked).toLocaleString() : 'N/A'}
          </div>
        </div>
      ))}
    </div>
  );
};
