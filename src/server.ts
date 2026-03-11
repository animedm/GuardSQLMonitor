import express, { Application } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { register } from 'prom-client';
import { logger } from './utils/logger';
import { config } from './config';
import { DatabaseMonitor } from './services/DatabaseMonitor';
import { AlertSystem } from './services/AlertSystem';
import metricsRouter from './routes/metrics';
import healthRouter from './routes/health';
import databaseRouter from './routes/database';
import replicationRouter from './routes/replication';
import dashboardsRouter from './routes/dashboards';
import historyRouter from './routes/history';
import queryAnalyzerRouter from './routes/queryAnalyzer';
import exportRouter from './routes/export';
import monitoringRouter from './routes/monitoring';

dotenv.config();

const app: Application = express();
const PORT = config.server.port;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/metrics', metricsRouter);
app.use('/api/health', healthRouter);
app.use('/api/database', databaseRouter);
app.use('/api/database', replicationRouter);
app.use('/api/dashboards', dashboardsRouter);
app.use('/api/history', historyRouter);
app.use('/api/query-analyzer', queryAnalyzerRouter);
app.use('/api/export', exportRouter);
app.use('/api/monitoring', monitoringRouter);

// Prometheus metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'GuardSQL Monitor',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Initialize services
const dbMonitor = DatabaseMonitor.getInstance();
const alertSystem = AlertSystem.getInstance();

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  await dbMonitor.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  await dbMonitor.stop();
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  logger.info(`🚀 GuardSQL Monitor running on port ${PORT}`);
  logger.info(`📊 Metrics available at http://localhost:${PORT}/metrics`);
  logger.info(`🏥 Health check at http://localhost:${PORT}/api/health`);
  
  // Start monitoring
  dbMonitor.start();
  logger.info('✅ Database monitoring started');
});

export default app;
