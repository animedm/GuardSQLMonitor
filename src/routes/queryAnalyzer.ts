import { Router, Request, Response } from 'express';
import { DatabaseMonitor } from '../services/DatabaseMonitor';
import QueryAnalyzer from '../services/QueryAnalyzer';
import { logger } from '../utils/logger';

const router = Router();
const queryAnalyzer = new QueryAnalyzer();

// Analyze a query
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const { query, databaseType, databaseName } = req.body;

    if (!query || !databaseType) {
      return res.status(400).json({ error: 'query and databaseType are required' });
    }

    const dbMonitor = DatabaseMonitor.getInstance();
    let result;

    // Get basic suggestions first
    const basicSuggestions = queryAnalyzer.getQuerySuggestions(query);

    switch (databaseType) {
      case 'postgres': {
        const pgConnector = (dbMonitor as any).pgConnector;
        if (!pgConnector) {
          return res.status(400).json({ error: 'PostgreSQL not configured' });
        }
        result = await queryAnalyzer.analyzePostgresQuery(pgConnector.pool, query);
        result.suggestions = [...basicSuggestions, ...result.suggestions];
        break;
      }

      case 'mysql': {
        const mysqlConnector = (dbMonitor as any).mysqlConnector;
        if (!mysqlConnector || !mysqlConnector.connection) {
          return res.status(400).json({ error: 'MySQL not configured' });
        }
        result = await queryAnalyzer.analyzeMySQLQuery(mysqlConnector.connection, query);
        result.suggestions = [...basicSuggestions, ...result.suggestions];
        break;
      }

      default:
        return res.status(400).json({ 
          error: 'Unsupported database type',
          hint: 'Supported types: postgres, mysql'
        });
    }

    res.json(result);
  } catch (error: any) {
    logger.error('Error in query analysis:', error);
    res.status(500).json({
      error: 'Failed to analyze query',
      message: error.message
    });
  }
});

// Get query suggestions (without executing)
router.post('/suggest', (req: Request, res: Response) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'query is required' });
    }

    const suggestions = queryAnalyzer.getQuerySuggestions(query);

    res.json({ 
      query,
      suggestions,
      count: suggestions.length
    });
  } catch (error: any) {
    logger.error('Error getting query suggestions:', error);
    res.status(500).json({
      error: 'Failed to get suggestions',
      message: error.message
    });
  }
});

export default router;
