import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface QuerySuggestion {
  type: 'warning' | 'suggestion' | 'optimization';
  message: string;
  impact?: string;
}

interface QueryExplanation {
  executionPlan: any;
  estimatedCost?: number;
  actualTime?: number;
  suggestions: QuerySuggestion[];
  indexes: string[];
  warnings: string[];
}

const QueryAnalyzerPage: React.FC = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [databaseType, setDatabaseType] = useState('postgres');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<QueryExplanation | null>(null);
  const [error, setError] = useState<string>('');

  const handleAnalyze = async () => {
    if (!query.trim()) {
      setError('Please enter a SQL query to analyze');
      return;
    }

    setAnalyzing(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('http://localhost:3001/api/query-analyzer/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: query.trim(),
          databaseType,
          databaseName: 'neondb'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to analyze query');
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'An error occurred while analyzing the query');
    } finally {
      setAnalyzing(false);
    }
  };

  const getSuggestionColor = (type: string) => {
    switch (type) {
      case 'warning':
        return 'bg-red-500/20 border-red-500/30 text-red-300';
      case 'suggestion':
        return 'bg-blue-500/20 border-blue-500/30 text-blue-300';
      case 'optimization':
        return 'bg-green-500/20 border-green-500/30 text-green-300';
      default:
        return 'bg-gray-500/20 border-gray-500/30 text-gray-300';
    }
  };

  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case 'warning':
        return '⚠️';
      case 'suggestion':
        return '💡';
      case 'optimization':
        return '🚀';
      default:
        return 'ℹ️';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/')}
            className="mb-4 text-blue-400 hover:text-blue-300 flex items-center gap-2 transition-colors"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-4xl font-bold text-white mb-2">Query Analyzer</h1>
          <p className="text-gray-400">
            Analyze SQL queries and get optimization suggestions
          </p>
        </div>

        {/* Input Section */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-2xl p-6 border border-gray-700/50 mb-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Database Type
            </label>
            <select
              value={databaseType}
              onChange={(e) => setDatabaseType(e.target.value)}
              className="w-full bg-gray-900/50 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="postgres">PostgreSQL</option>
              <option value="mysql">MySQL</option>
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              SQL Query
            </label>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="SELECT * FROM users WHERE email = 'example@email.com';"
              className="w-full h-48 bg-gray-900/50 border border-gray-600 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <button
            onClick={handleAnalyze}
            disabled={analyzing || !query.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {analyzing ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Analyzing...
              </>
            ) : (
              <>
                <span>🔍</span>
                Analyze Query
              </>
            )}
          </button>

          {error && (
            <div className="mt-4 bg-red-500/20 border border-red-500/30 rounded-lg p-4 text-red-300">
              <strong>Error:</strong> {error}
            </div>
          )}
        </div>

        {/* Results Section */}
        {result && (
          <div className="space-y-6">
            {/* Performance Metrics */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-2xl p-6 border border-gray-700/50">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <span>📊</span>
                Performance Metrics
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {result.estimatedCost !== undefined && (
                  <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-600">
                    <div className="text-sm text-gray-400 mb-1">Estimated Cost</div>
                    <div className="text-2xl font-bold text-blue-300">
                      {result.estimatedCost.toFixed(2)}
                    </div>
                  </div>
                )}
                {result.actualTime !== undefined && (
                  <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-600">
                    <div className="text-sm text-gray-400 mb-1">Actual Time</div>
                    <div className="text-2xl font-bold text-green-300">
                      {result.actualTime.toFixed(2)} ms
                    </div>
                  </div>
                )}
                {result.indexes.length > 0 && (
                  <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-600">
                    <div className="text-sm text-gray-400 mb-1">Indexes Used</div>
                    <div className="text-2xl font-bold text-purple-300">
                      {result.indexes.length}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Suggestions */}
            {result.suggestions.length > 0 && (
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-2xl p-6 border border-gray-700/50">
                <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                  <span>💡</span>
                  Optimization Suggestions
                </h2>
                <div className="space-y-3">
                  {result.suggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      className={`rounded-lg p-4 border ${getSuggestionColor(suggestion.type)}`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">{getSuggestionIcon(suggestion.type)}</span>
                        <div className="flex-1">
                          <div className="font-medium mb-1">{suggestion.message}</div>
                          {suggestion.impact && (
                            <div className="text-sm opacity-80">Impact: {suggestion.impact}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Warnings */}
            {result.warnings.length > 0 && (
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-2xl p-6 border border-gray-700/50">
                <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                  <span>⚠️</span>
                  Warnings
                </h2>
                <div className="space-y-2">
                  {result.warnings.map((warning, index) => (
                    <div
                      key={index}
                      className="bg-red-500/20 border border-red-500/30 rounded-lg p-3 text-red-300"
                    >
                      {warning}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Indexes Used */}
            {result.indexes.length > 0 && (
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-2xl p-6 border border-gray-700/50">
                <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                  <span>🔑</span>
                  Indexes Used
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {result.indexes.map((index, idx) => (
                    <div
                      key={idx}
                      className="bg-gray-900/50 border border-gray-600 rounded-lg p-3 text-green-300 font-mono text-sm"
                    >
                      {index}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Execution Plan */}
            {result.executionPlan && (
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-2xl p-6 border border-gray-700/50">
                <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                  <span>🗺️</span>
                  Execution Plan
                </h2>
                <pre className="bg-gray-900/50 border border-gray-600 rounded-lg p-4 text-gray-300 text-sm overflow-x-auto">
                  {JSON.stringify(result.executionPlan, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default QueryAnalyzerPage;
