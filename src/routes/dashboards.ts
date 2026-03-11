import { Router, Request, Response } from 'express';
import { DashboardManager } from '../services/DashboardManager';
import { z } from 'zod';

const router = Router();
const dashboardManager = DashboardManager.getInstance();

// Validation schemas
const createDashboardSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  owner: z.string().default('anonymous'),
  isPublic: z.boolean().default(false),
  layout: z.enum(['grid', 'flex']).default('grid'),
  theme: z.enum(['dark', 'light', 'auto']).optional(),
  refreshInterval: z.number().min(5).max(300).default(30),
  tags: z.array(z.string()).default([]),
  widgets: z.array(z.any()).default([])
});

const updateDashboardSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  isPublic: z.boolean().optional(),
  layout: z.enum(['grid', 'flex']).optional(),
  theme: z.enum(['dark', 'light', 'auto']).optional(),
  refreshInterval: z.number().min(5).max(300).optional(),
  tags: z.array(z.string()).optional(),
  widgets: z.array(z.any()).optional()
});

const addWidgetSchema = z.object({
  type: z.enum(['metric', 'chart', 'alert', 'table', 'gauge', 'status']),
  title: z.string().min(1).max(100),
  position: z.object({
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number()
  }),
  config: z.record(z.any()).default({})
});

// Get all dashboards
router.get('/', (req: Request, res: Response) => {
  try {
    const includePrivate = req.query.includePrivate === 'true';
    const dashboards = dashboardManager.getAllDashboards(includePrivate);
    res.json(dashboards);
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to retrieve dashboards',
      message: error.message
    });
  }
});

// Search dashboards
router.get('/search', (req: Request, res: Response) => {
  try {
    const query = (req.query.q as string) || '';
    const tags = req.query.tags 
      ? (req.query.tags as string).split(',')
      : undefined;
    
    const results = dashboardManager.searchDashboards(query, tags);
    res.json(results);
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to search dashboards',
      message: error.message
    });
  }
});

// Get dashboard by ID
router.get('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const dashboard = dashboardManager.getDashboard(id);
    
    if (!dashboard) {
      return res.status(404).json({ error: 'Dashboard not found' });
    }
    
    res.json(dashboard);
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to retrieve dashboard',
      message: error.message
    });
  }
});

// Create new dashboard
router.post('/', async (req: Request, res: Response) => {
  try {
    const validated = createDashboardSchema.parse(req.body);
    const dashboard = await dashboardManager.createDashboard(validated);
    res.status(201).json(dashboard);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors
      });
    }
    res.status(500).json({
      error: 'Failed to create dashboard',
      message: error.message
    });
  }
});

// Update dashboard
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validated = updateDashboardSchema.parse(req.body);
    const dashboard = await dashboardManager.updateDashboard(id, validated);
    
    if (!dashboard) {
      return res.status(404).json({ error: 'Dashboard not found' });
    }
    
    res.json(dashboard);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors
      });
    }
    res.status(500).json({
      error: 'Failed to update dashboard',
      message: error.message
    });
  }
});

// Delete dashboard
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await dashboardManager.deleteDashboard(id);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Dashboard not found' });
    }
    
    res.json({ success: true, message: 'Dashboard deleted' });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to delete dashboard',
      message: error.message
    });
  }
});

// Add widget to dashboard
router.post('/:id/widgets', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validated = addWidgetSchema.parse(req.body);
    const widget = await dashboardManager.addWidget(id, validated);
    
    if (!widget) {
      return res.status(404).json({ error: 'Dashboard not found' });
    }
    
    res.status(201).json(widget);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors
      });
    }
    res.status(500).json({
      error: 'Failed to add widget',
      message: error.message
    });
  }
});

// Update widget
router.put('/:id/widgets/:widgetId', async (req: Request, res: Response) => {
  try {
    const { id, widgetId } = req.params;
    const widget = await dashboardManager.updateWidget(id, widgetId, req.body);
    
    if (!widget) {
      return res.status(404).json({ error: 'Dashboard or widget not found' });
    }
    
    res.json(widget);
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to update widget',
      message: error.message
    });
  }
});

// Remove widget
router.delete('/:id/widgets/:widgetId', async (req: Request, res: Response) => {
  try {
    const { id, widgetId } = req.params;
    const removed = await dashboardManager.removeWidget(id, widgetId);
    
    if (!removed) {
      return res.status(404).json({ error: 'Dashboard or widget not found' });
    }
    
    res.json({ success: true, message: 'Widget removed' });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to remove widget',
      message: error.message
    });
  }
});

// Clone dashboard
router.post('/:id/clone', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, owner } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    const dashboard = await dashboardManager.cloneDashboard(
      id,
      name,
      owner || 'anonymous'
    );
    
    if (!dashboard) {
      return res.status(404).json({ error: 'Dashboard not found' });
    }
    
    res.status(201).json(dashboard);
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to clone dashboard',
      message: error.message
    });
  }
});

// Export dashboard
router.get('/:id/export', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const exported = dashboardManager.exportDashboard(id);
    
    if (!exported) {
      return res.status(404).json({ error: 'Dashboard not found' });
    }
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="dashboard-${id}.json"`);
    res.send(exported);
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to export dashboard',
      message: error.message
    });
  }
});

// Import dashboard
router.post('/import', async (req: Request, res: Response) => {
  try {
    const { dashboard, owner } = req.body;
    
    if (!dashboard) {
      return res.status(400).json({ error: 'Dashboard data is required' });
    }
    
    const dashboardJson = typeof dashboard === 'string' 
      ? dashboard 
      : JSON.stringify(dashboard);
    
    const imported = await dashboardManager.importDashboard(
      dashboardJson,
      owner || 'anonymous'
    );
    
    res.status(201).json(imported);
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to import dashboard',
      message: error.message
    });
  }
});

// Get dashboards by owner
router.get('/owner/:owner', (req: Request, res: Response) => {
  try {
    const { owner } = req.params;
    const dashboards = dashboardManager.getDashboardsByOwner(owner);
    res.json(dashboards);
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to retrieve dashboards',
      message: error.message
    });
  }
});

export default router;
