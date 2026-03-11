import React from 'react';
import { Layout } from '../components/Layout';
import { ReplicationMonitor } from '../components/ReplicationMonitor';
import { BackupMonitor } from '../components/BackupMonitor';

export const ReplicationPage: React.FC = () => {
  return (
    <Layout>
      <div className="space-y-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">Replication & Backup</h1>
          <p className="text-slate-400">Monitor database replication status and backup health</p>
        </div>
        
        <div className="grid grid-cols-1 gap-6">
          <ReplicationMonitor />
          <BackupMonitor />
        </div>
      </div>
    </Layout>
  );
};
