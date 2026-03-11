import { Pool } from 'pg';
import { Connection } from 'mysql2/promise';
import { ConnectionPool } from 'mssql';
import { logger } from '../utils/logger';

export interface QueryExplanation {
  query: string;
  executionPlan: any[];
  estimatedCost: number;
  actualTime?: number;
  suggestions: string[];
  indexes: string[];
  warnings: string[];
}

export class QueryAnalyzer {
  
  // Analyze PostgreSQL query
  async analyzePostgresQuery(pool: Pool, query: string): Promise<QueryExplanation> {
    try {
      // Get EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      const explainResult = await pool.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`);
      const plan = explainResult.rows[0]['QUERY PLAN'][0];
      
      const suggestions: string[] = [];
      const indexes: string[] = [];
      const warnings: string[] = [];
      
      // Analyze plan for suggestions
      this.analyzePostgresPlan(plan.Plan, suggestions, indexes, warnings);
      
      return {
        query,
        executionPlan: [plan],
        estimatedCost: plan.Plan['Total Cost'] || 0,
        actualTime: plan['Execution Time'] || 0,
        suggestions,
        indexes,
        warnings
      };
    } catch (error: any) {
      logger.error('Error analyzing PostgreSQL query:', error);
      
      // Try without ANALYZE if it fails
      try {
        const explainResult = await pool.query(`EXPLAIN (FORMAT JSON) ${query}`);
        const plan = explainResult.rows[0]['QUERY PLAN'][0];
        
        return {
          query,
          executionPlan: [plan],
          estimatedCost: plan.Plan['Total Cost'] || 0,
          suggestions: ['Could not run ANALYZE (query may modify data)'],
          indexes: [],
          warnings: [error.message]
        };
      } catch (secondError: any) {
        throw new Error(`Failed to analyze query: ${secondError.message}`);
      }
    }
  }

  private analyzePostgresPlan(
    node: any,
    suggestions: string[],
    indexes: string[],
    warnings: string[]
  ): void {
    // Sequential Scan suggestions
    if (node['Node Type'] === 'Seq Scan') {
      const relation = node['Relation Name'];
      const rows = node['Plan Rows'];
      
      if (rows > 1000) {
        suggestions.push(
          `Consider adding an index on table "${relation}" - Sequential scan on ${rows.toLocaleString()} rows`
        );
        indexes.push(`CREATE INDEX idx_${relation}_<column> ON ${relation}(<column>);`);
      }
    }
    
    // Nested Loop warnings
    if (node['Node Type'] === 'Nested Loop' && node['Plan Rows'] > 10000) {
      warnings.push(
        'Nested Loop with large dataset detected - May cause performance issues'
      );
      suggestions.push('Consider adding indexes on join columns or rewriting query');
    }
    
    // Hash Join analysis
    if (node['Node Type'] === 'Hash Join' && node['Hash Cond']) {
      suggestions.push('Hash Join detected - Ensure enough work_mem is allocated');
    }
    
    // Sort operations
    if (node['Node Type'] === 'Sort' && node['Sort Method']?.includes('external')) {
      warnings.push('External sort detected - Query is using disk, increase work_mem');
    }
    
    // Index scans
    if (node['Node Type'] === 'Index Scan' || node['Node Type'] === 'Index Only Scan') {
      const indexName = node['Index Name'];
      indexes.push(`Using index: ${indexName}`);
    }
    
    // Check if using index
    if (node['Filter'] && node['Node Type'] === 'Seq Scan') {
      const relation = node['Relation Name'];
      suggestions.push(
        `Filter condition on "${relation}" might benefit from an index`
      );
    }
    
    // Recursively analyze child nodes
    if (node['Plans']) {
      for (const childNode of node['Plans']) {
        this.analyzePostgresPlan(childNode, suggestions, indexes, warnings);
      }
    }
  }
  
  // Analyze MySQL query
  async analyzeMySQLQuery(connection: Connection, query: string): Promise<QueryExplanation> {
    try {
      const [explainResult] = await connection.query(`EXPLAIN FORMAT=JSON ${query}`);
      const plan = JSON.parse((explainResult as any[])[0]['EXPLAIN']);
      
      const suggestions: string[] = [];
      const indexes: string[] = [];
      const warnings: string[] = [];
      
      this.analyzeMySQLPlan(plan.query_block, suggestions, indexes, warnings);
      
      return {
        query,
        executionPlan: [plan],
        estimatedCost: plan.query_block?.cost_info?.query_cost || 0,
        suggestions,
        indexes,
        warnings
      };
    } catch (error: any) {
      logger.error('Error analyzing MySQL query:', error);
      throw new Error(`Failed to analyze query: ${error.message}`);
    }
  }
  
  private analyzeMySQLPlan(
    node: any,
    suggestions: string[],
    indexes: string[],
    warnings: string[]
  ): void {
    if (!node) return;
    
    // Check table access
    if (node.table) {
      const table = node.table;
      
      if (table.access_type === 'ALL') {
        suggestions.push(
          `Full table scan on "${table.table_name}" - Consider adding an index`
        );
        warnings.push(`Table "${table.table_name}" is scanned without index`);
      }
      
      if (table.key) {
        indexes.push(`Using index: ${table.key} on ${table.table_name}`);
      }
      
      if (table.rows_examined_per_scan > 10000) {
        warnings.push(
          `High row count (${table.rows_examined_per_scan.toLocaleString()}) examined on ${table.table_name}`
        );
      }
    }
    
    // Nested loops
    if (node.nested_loop) {
      for (const nestedTable of node.nested_loop) {
        this.analyzeMySQLPlan(nestedTable, suggestions, indexes, warnings);
      }
    }
    
    // Ordering
    if (node.ordering_operation) {
      if (node.ordering_operation.using_filesort) {
        warnings.push('Using filesort - Consider adding an index on ORDER BY columns');
      }
    }
    
    // Grouping
    if (node.grouping_operation) {
      if (node.grouping_operation.using_temporary_table) {
        warnings.push('Using temporary table for grouping - May impact performance');
      }
    }
  }
  
  // Simple query suggestions based on patterns
  getQuerySuggestions(query: string): string[] {
    const suggestions: string[] = [];
    const lowerQuery = query.toLowerCase();
    
    // SELECT * suggestions
    if (lowerQuery.includes('select *')) {
      suggestions.push('Avoid SELECT * - Specify only needed columns for better performance');
    }
    
    // Missing WHERE
    if (lowerQuery.includes('delete') && !lowerQuery.includes('where')) {
      suggestions.push('⚠️ DELETE without WHERE clause - This will delete ALL rows!');
    }
    
    if (lowerQuery.includes('update') && !lowerQuery.includes('where')) {
      suggestions.push('⚠️ UPDATE without WHERE clause - This will update ALL rows!');
    }
    
    // OR in WHERE
    if (lowerQuery.match(/where.*or/)) {
      suggestions.push('Multiple OR conditions may not use indexes efficiently - Consider UNION or IN clause');
    }
    
    // LIKE with leading wildcard
    if (lowerQuery.match(/like\s+['"]%/)) {
      suggestions.push('LIKE with leading wildcard (LIKE \'%...\') cannot use indexes');
    }
    
    // Missing LIMIT
    if (lowerQuery.includes('select') && !lowerQuery.includes('limit') && !lowerQuery.includes('where')) {
      suggestions.push('Consider adding LIMIT clause to prevent large result sets');
    }
    
    // Subqueries
    if (lowerQuery.match(/select.*select/)) {
      suggestions.push('Subquery detected - Consider using JOIN for better performance');
    }
    
    // NOT IN
    if (lowerQuery.includes('not in')) {
      suggestions.push('NOT IN may have poor performance - Consider NOT EXISTS or LEFT JOIN with NULL check'); 
    }
    
    return suggestions;
  }
}

export default QueryAnalyzer;
