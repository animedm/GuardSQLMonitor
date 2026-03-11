import { randomUUID } from 'crypto';
import { logger } from '../utils/logger';
import { CustomDashboard, DashboardWidget } from '../types/advanced';
import * as fs from 'fs/promises';
import * as path from 'path';

export class DashboardManager {
  private static instance: DashboardManager;
  private dashboards: Map<string, CustomDashboard> = new Map();
  private dashboardsPath = path.join(process.cwd(), 'data', 'dashboards.json');

  private constructor() {
    this.loadDashboards();
  }

  public static getInstance(): DashboardManager {
    if (!DashboardManager.instance) {
      DashboardManager.instance = new DashboardManager();
    }
    return DashboardManager.instance;
  }

  // Create default dashboard if none exist
  private createDefaultDashboard(): CustomDashboard {
    return {
      id: randomUUID(),
      name: 'Default Dashboard',
      description: 'Overview of all databases',
      owner: 'system',
      isPublic: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      layout: 'grid',
      theme: 'dark',
      refreshInterval: 30,
      tags: ['default', 'overview'],
      widgets: [
        {
          id: randomUUID(),
          type: 'metric',
          title: 'Total Databases',
          position: { x: 0, y: 0, w: 3, h: 2 },
          config: {
            metric: 'database_count'
          }
        },
        {
          id: randomUUID(),
          type: 'metric',
          title: 'Total Connections',
          position: { x: 3, y: 0, w: 3, h: 2 },
          config: {
            metric: 'total_connections'
          }
        },
        {
          id: randomUUID(),
          type: 'metric',
          title: 'Avg Response Time',
          position: { x: 6, y: 0, w: 3, h: 2 },
          config: {
            metric: 'avg_response_time',
            thresholds: {
              warning: 100,
              critical: 500
            }
          }
        },
        {
          id: randomUUID(),
          type: 'alert',
          title: 'Active Alerts',
          position: { x: 9, y: 0, w: 3, h: 2 },
          config: {
            metric: 'active_alerts'
          }
        },
        {
          id: randomUUID(),
          type: 'chart',
          title: 'Connection Trends',
          position: { x: 0, y: 2, w: 6, h: 4 },
          config: {
            chartType: 'line',
            metric: 'connections',
            timeRange: 60
          }
        },
        {
          id: randomUUID(),
          type: 'chart',
          title: 'Response Time Trends',
          position: { x: 6, y: 2, w: 6, h: 4 },
          config: {
            chartType: 'area',
            metric: 'response_time',
            timeRange: 60
          }
        },
        {
          id: randomUUID(),
          type: 'table',
          title: 'Slow Queries',
          position: { x: 0, y: 6, w: 12, h: 4 },
          config: {
            metric: 'slow_queries'
          }
        }
      ]
    };
  }

  // Load dashboards from file
  private async loadDashboards(): Promise<void> {
    try {
      // Ensure data directory exists
      const dataDir = path.dirname(this.dashboardsPath);
      await fs.mkdir(dataDir, { recursive: true });

      try {
        const data = await fs.readFile(this.dashboardsPath, 'utf-8');
        const dashboards = JSON.parse(data) as CustomDashboard[];
        
        dashboards.forEach(dashboard => {
          this.dashboards.set(dashboard.id, {
            ...dashboard,
            createdAt: new Date(dashboard.createdAt),
            updatedAt: new Date(dashboard.updatedAt)
          });
        });
        
        logger.info(`Loaded ${dashboards.length} custom dashboards`);
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          // File doesn't exist, create default
          const defaultDashboard = this.createDefaultDashboard();
          this.dashboards.set(defaultDashboard.id, defaultDashboard);
          await this.saveDashboards();
          logger.info('Created default dashboard');
        } else {
          throw error;
        }
      }
    } catch (error) {
      logger.error('Failed to load dashboards:', error);
    }
  }

  // Save dashboards to file
  private async saveDashboards(): Promise<void> {
    try {
      const dashboards = Array.from(this.dashboards.values());
      await fs.writeFile(
        this.dashboardsPath,
        JSON.stringify(dashboards, null, 2),
        'utf-8'
      );
      logger.debug('Dashboards saved successfully');
    } catch (error) {
      logger.error('Failed to save dashboards:', error);
      throw error;
    }
  }

  // Get all dashboards
  public getAllDashboards(includePrivate: boolean = false): CustomDashboard[] {
    const dashboards = Array.from(this.dashboards.values());
    if (includePrivate) {
      return dashboards;
    }
    return dashboards.filter(d => d.isPublic);
  }

  // Get dashboard by ID
  public getDashboard(id: string): CustomDashboard | undefined {
    return this.dashboards.get(id);
  }

  // Create new dashboard
  public async createDashboard(
    dashboard: Omit<CustomDashboard, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<CustomDashboard> {
    const newDashboard: CustomDashboard = {
      ...dashboard,
      id: randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.dashboards.set(newDashboard.id, newDashboard);
    await this.saveDashboards();

    logger.info(`Dashboard created: ${newDashboard.name} (${newDashboard.id})`);
    return newDashboard;
  }

  // Update dashboard
  public async updateDashboard(
    id: string,
    updates: Partial<Omit<CustomDashboard, 'id' | 'createdAt'>>
  ): Promise<CustomDashboard | null> {
    const dashboard = this.dashboards.get(id);
    if (!dashboard) {
      return null;
    }

    const updatedDashboard: CustomDashboard = {
      ...dashboard,
      ...updates,
      id: dashboard.id,
      createdAt: dashboard.createdAt,
      updatedAt: new Date()
    };

    this.dashboards.set(id, updatedDashboard);
    await this.saveDashboards();

    logger.info(`Dashboard updated: ${id}`);
    return updatedDashboard;
  }

  // Delete dashboard
  public async deleteDashboard(id: string): Promise<boolean> {
    const deleted = this.dashboards.delete(id);
    if (deleted) {
      await this.saveDashboards();
      logger.info(`Dashboard deleted: ${id}`);
    }
    return deleted;
  }

  // Add widget to dashboard
  public async addWidget(
    dashboardId: string,
    widget: Omit<DashboardWidget, 'id'>
  ): Promise<DashboardWidget | null> {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) {
      return null;
    }

    const newWidget: DashboardWidget = {
      ...widget,
      id: randomUUID()
    };

    dashboard.widgets.push(newWidget);
    dashboard.updatedAt = new Date();

    await this.saveDashboards();
    logger.info(`Widget added to dashboard ${dashboardId}`);

    return newWidget;
  }

  // Update widget
  public async updateWidget(
    dashboardId: string,
    widgetId: string,
    updates: Partial<Omit<DashboardWidget, 'id'>>
  ): Promise<DashboardWidget | null> {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) {
      return null;
    }

    const widgetIndex = dashboard.widgets.findIndex(w => w.id === widgetId);
    if (widgetIndex === -1) {
      return null;
    }

    dashboard.widgets[widgetIndex] = {
      ...dashboard.widgets[widgetIndex],
      ...updates
    };
    dashboard.updatedAt = new Date();

    await this.saveDashboards();
    logger.info(`Widget updated: ${widgetId} in dashboard ${dashboardId}`);

    return dashboard.widgets[widgetIndex];
  }

  // Remove widget
  public async removeWidget(dashboardId: string, widgetId: string): Promise<boolean> {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) {
      return false;
    }

    const initialLength = dashboard.widgets.length;
    dashboard.widgets = dashboard.widgets.filter(w => w.id !== widgetId);

    if (dashboard.widgets.length < initialLength) {
      dashboard.updatedAt = new Date();
      await this.saveDashboards();
      logger.info(`Widget removed: ${widgetId} from dashboard ${dashboardId}`);
      return true;
    }

    return false;
  }

  // Clone dashboard
  public async cloneDashboard(id: string, newName: string, owner: string): Promise<CustomDashboard | null> {
    const original = this.dashboards.get(id);
    if (!original) {
      return null;
    }

    const cloned: CustomDashboard = {
      ...original,
      id: randomUUID(),
      name: newName,
      owner,
      isPublic: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      widgets: original.widgets.map(w => ({
        ...w,
        id: randomUUID()
      }))
    };

    this.dashboards.set(cloned.id, cloned);
    await this.saveDashboards();

    logger.info(`Dashboard cloned: ${id} -> ${cloned.id}`);
    return cloned;
  }

  // Search dashboards
  public searchDashboards(query: string, tags?: string[]): CustomDashboard[] {
    const lowercaseQuery = query.toLowerCase();
    
    return Array.from(this.dashboards.values()).filter(dashboard => {
      const matchesQuery = 
        dashboard.name.toLowerCase().includes(lowercaseQuery) ||
        dashboard.description?.toLowerCase().includes(lowercaseQuery);

      const matchesTags = !tags || tags.length === 0 || 
        tags.some(tag => dashboard.tags.includes(tag));

      return matchesQuery && matchesTags;
    });
  }

  // Get dashboards by owner
  public getDashboardsByOwner(owner: string): CustomDashboard[] {
    return Array.from(this.dashboards.values()).filter(d => d.owner === owner);
  }

  // Export dashboard
  public exportDashboard(id: string): string | null {
    const dashboard = this.dashboards.get(id);
    if (!dashboard) {
      return null;
    }

    return JSON.stringify(dashboard, null, 2);
  }

  // Import dashboard
  public async importDashboard(dashboardJson: string, owner: string): Promise<CustomDashboard> {
    const dashboard = JSON.parse(dashboardJson) as CustomDashboard;
    
    return await this.createDashboard({
      name: `${dashboard.name} (Imported)`,
      description: dashboard.description,
      owner,
      isPublic: false,
      layout: dashboard.layout,
      theme: dashboard.theme,
      refreshInterval: dashboard.refreshInterval,
      tags: [...dashboard.tags, 'imported'],
      widgets: dashboard.widgets.map(w => ({
        ...w,
        id: randomUUID()
      }))
    });
  }
}
