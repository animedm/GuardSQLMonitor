import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import axios from 'axios';

interface Dashboard {
  id: string;
  name: string;
  description?: string;
  owner: string;
  isPublic: boolean;
  layout: 'grid' | 'flex';
  theme?: 'dark' | 'light' | 'auto';
  refreshInterval: number;
  tags: string[];
  widgets: DashboardWidget[];
  createdAt: Date;
  updatedAt: Date;
}

interface DashboardWidget {
  id: string;
  type: 'metric' | 'chart' | 'alert' | 'table' | 'gauge' | 'status';
  title: string;
  position: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  config: Record<string, any>;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const DashboardsPage: React.FC = () => {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [selectedDashboard, setSelectedDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newDashboardName, setNewDashboardName] = useState('');
  const [newDashboardDescription, setNewDashboardDescription] = useState('');

  useEffect(() => {
    fetchDashboards();
  }, []);

  const fetchDashboards = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/dashboards`);
      setDashboards(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch dashboards');
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const createDashboard = async () => {
    if (!newDashboardName.trim()) {
      alert('Please enter a dashboard name');
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/api/dashboards`, {
        name: newDashboardName,
        description: newDashboardDescription,
        owner: 'user',
        isPublic: true,
        layout: 'grid',
        refreshInterval: 30,
        tags: [],
        widgets: []
      });
      
      setDashboards([...dashboards, response.data]);
      setNewDashboardName('');
      setNewDashboardDescription('');
      setShowCreateModal(false);
      setSelectedDashboard(response.data);
    } catch (err: any) {
      alert('Failed to create dashboard: ' + (err.response?.data?.message || err.message));
    }
  };

  const deleteDashboard = async (id: string) => {
    if (!confirm('Are you sure you want to delete this dashboard?')) return;

    try {
      await axios.delete(`${API_URL}/api/dashboards/${id}`);
      setDashboards(dashboards.filter(d => d.id !== id));
      if (selectedDashboard?.id === id) {
        setSelectedDashboard(null);
      }
    } catch (err: any) {
      alert('Failed to delete dashboard: ' + (err.response?.data?.message || err.message));
    }
  };

  const cloneDashboard = async (id: string) => {
    const name = prompt('Enter a name for the cloned dashboard:');
    if (!name) return;

    try {
      const response = await axios.post(`${API_URL}/api/dashboards/${id}/clone`, {
        name,
        owner: 'user'
      });
      setDashboards([...dashboards, response.data]);
    } catch (err: any) {
      alert('Failed to clone dashboard: ' + (err.response?.data?.message || err.message));
    }
  };

  const exportDashboard = async (id: string) => {
    try {
      const response = await axios.get(`${API_URL}/api/dashboards/${id}/export`);
      const blob = new Blob([response.data], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dashboard-${id}.json`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Failed to export dashboard: ' + (err.response?.data?.message || err.message));
    }
  };

  const renderWidget = (widget: DashboardWidget) => {
    const widgetClass = "bg-slate-700 rounded-lg shadow-md p-4 border-2 border-slate-600";
    
    switch (widget.type) {
      case 'metric':
        return (
          <div className={widgetClass}>
            <h3 className="text-lg font-semibold mb-2 text-white">{widget.title}</h3>
            <div className="text-3xl font-bold text-blue-400">
              {widget.config.value || '--'}
            </div>
            <p className="text-sm text-slate-400 mt-1">{widget.config.label || 'Metric'}</p>
          </div>
        );
      
      case 'status':
        return (
          <div className={widgetClass}>
            <h3 className="text-lg font-semibold mb-2 text-white">{widget.title}</h3>
            <div className="flex items-center space-x-2">
              <div className={`w-4 h-4 rounded-full ${
                widget.config.status === 'healthy' ? 'bg-green-500' :
                widget.config.status === 'warning' ? 'bg-yellow-500' :
                widget.config.status === 'error' ? 'bg-red-500' :
                'bg-slate-400'
              }`}></div>
              <span className="text-lg text-white">{widget.config.statusText || 'Unknown'}</span>
            </div>
          </div>
        );

      case 'chart':
        return (
          <div className={widgetClass}>
            <h3 className="text-lg font-semibold mb-2 text-white">{widget.title}</h3>
            <div className="h-48 flex items-center justify-center text-slate-400">
              Chart: {widget.config.chartType || 'line'}
            </div>
          </div>
        );

      case 'table':
        return (
          <div className={widgetClass}>
            <h3 className="text-lg font-semibold mb-2 text-white">{widget.title}</h3>
            <div className="text-slate-400">
              Table with {widget.config.columns?.length || 0} columns
            </div>
          </div>
        );

      case 'alert':
        return (
          <div className={widgetClass}>
            <h3 className="text-lg font-semibold mb-2 text-white">{widget.title}</h3>
            <div className="space-y-1">
              {widget.config.alerts?.map((alert: any, idx: number) => (
                <div key={idx} className="text-sm p-2 bg-red-900 bg-opacity-30 text-red-300 rounded">
                  {alert.message}
                </div>
              )) || <p className="text-slate-400">No alerts</p>}
            </div>
          </div>
        );

      default:
        return (
          <div className={widgetClass}>
            <h3 className="text-lg font-semibold mb-2 text-white">{widget.title}</h3>
            <p className="text-slate-400">Widget type: {widget.type}</p>
          </div>
        );
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="bg-red-900 bg-opacity-20 border border-red-700 rounded-lg p-4">
          <p className="text-red-300">Error: {error}</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Custom Dashboards</h1>
            <p className="text-slate-400">Create and manage personalized monitoring dashboards</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            + Create Dashboard
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Dashboard List */}
          <div className="lg:col-span-1">
            <div className="bg-slate-800 rounded-lg shadow-md p-4 border border-slate-700">
              <h2 className="text-xl font-semibold mb-4 text-white">Your Dashboards</h2>
              <div className="space-y-2">
                {dashboards.length === 0 ? (
                  <p className="text-slate-400 text-sm">No dashboards yet. Create one to get started!</p>
                ) : (
                  dashboards.map(dashboard => (
                    <div
                      key={dashboard.id}
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                        selectedDashboard?.id === dashboard.id
                          ? 'border-blue-500 bg-slate-700'
                          : 'border-slate-600 hover:border-slate-500'
                      }`}
                      onClick={() => setSelectedDashboard(dashboard)}
                    >
                      <h3 className="font-medium text-white">{dashboard.name}</h3>
                      {dashboard.description && (
                        <p className="text-sm text-slate-400 mt-1">{dashboard.description}</p>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-slate-400">
                          {dashboard.widgets.length} widgets
                        </span>
                        <div className="flex space-x-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); cloneDashboard(dashboard.id); }}
                            className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1"
                            title="Clone"
                          >
                            📋
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); exportDashboard(dashboard.id); }}
                            className="text-xs text-green-600 hover:text-green-800 px-2 py-1"
                            title="Export"
                          >
                            ⬇️
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteDashboard(dashboard.id); }}
                            className="text-xs text-red-600 hover:text-red-800 px-2 py-1"
                            title="Delete"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Dashboard View */}
          <div className="lg:col-span-2">
            {selectedDashboard ? (
              <div className="space-y-4">
                <div className="bg-slate-800 rounded-lg shadow-md p-6 border border-slate-700">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-2xl font-bold text-white">{selectedDashboard.name}</h2>
                      {selectedDashboard.description && (
                        <p className="text-slate-400 mt-1">{selectedDashboard.description}</p>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-slate-400">
                        Refresh: {selectedDashboard.refreshInterval}s
                      </span>
                      {selectedDashboard.tags.map(tag => (
                        <span key={tag} className="px-2 py-1 bg-slate-700 text-slate-300 rounded text-xs">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Widgets Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedDashboard.widgets.length === 0 ? (
                  <div className="col-span-2 bg-slate-700 border-2 border-dashed border-slate-600 rounded-lg p-12 text-center">
                    <p className="text-slate-400">No widgets yet. Add widgets to customize your dashboard.</p>
                    <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                        + Add Widget
                      </button>
                    </div>
                  ) : (
                    selectedDashboard.widgets.map(widget => (
                      <div key={widget.id}>
                        {renderWidget(widget)}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-slate-700 border-2 border-dashed border-slate-600 rounded-lg p-12 text-center">
                <p className="text-slate-400">Select a dashboard from the list to view it</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Dashboard Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full border border-slate-700">
            <h2 className="text-2xl font-bold mb-4 text-white">Create New Dashboard</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Dashboard Name *
                </label>
                <input
                  type="text"
                  value={newDashboardName}
                  onChange={(e) => setNewDashboardName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="My Dashboard"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  value={newDashboardDescription}
                  onChange={(e) => setNewDashboardDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Optional description..."
                />
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewDashboardName('');
                    setNewDashboardDescription('');
                  }}
                  className="px-4 py-2 border border-slate-600 rounded-lg hover:bg-slate-700 text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={createDashboard}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};
