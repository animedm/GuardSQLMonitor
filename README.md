# GuardSQL Monitor 🛡️

**Enterprise-grade database monitoring solution** for PostgreSQL, MySQL, and SQL Server with real-time metrics, alerts, and beautiful dashboards.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)

## ✨ Features

### 🎯 Core Capabilities
- **Multi-Database Support**: PostgreSQL, MySQL, and SQL Server
- **Real-Time Monitoring**: Live metrics collection every 30 seconds
- **Performance Tracking**: Query performance, connection pooling, and response times
- **Smart Alerting**: Configurable thresholds with email notifications
- **Historical Data**: Track trends and performance over time
- **Prometheus Integration**: Export metrics for Prometheus/Grafana
- **Beautiful Dashboard**: Modern React-based UI with real-time updates

### 📊 Monitored Metrics
- **Connection Stats**: Active, idle, total, and waiting connections
- **Performance**: Queries per second, slow queries, transaction rates
- **Resources**: CPU usage, memory usage, cache hit ratios
- **Database Size**: Total size, data size, index size
- **Health Checks**: Database availability and response times
- **Uptime**: Database server uptime tracking

### 🚨 Alert System
- **Real-time Alerts**: Instant notifications when thresholds are exceeded
- **Multiple Severity Levels**: Critical, warning, and info alerts
- **Email Notifications**: SMTP-based alert delivery
- **Alert Management**: View, acknowledge, and resolve alerts
- **Cooldown Period**: Prevent alert spam

### 🔮 Advanced Features (v1.0.0+)
- **Deadlock Detection**: Real-time deadlock analysis with blocking chains
- **Connection Pool Monitor**: Track pool utilization, leaks, and trends
- **Query Analyzer**: EXPLAIN plan analysis for PostgreSQL and MySQL
- **Advanced Charts**: Recharts integration with historical data
- **Export Options**: Excel, CSV, and PDF reports
- **Replication Monitoring**: Master-slave lag tracking
- **Backup Monitoring**: Backup status and validation
- **Customizable Dashboards**: Create and manage custom views
- **Date Range Picker**: Flexible time-based filtering
- **Connection Details**: Full metadata including client IP, hostname, query text

## � Documentation

- **[FEATURES.md](FEATURES.md)** - Complete feature documentation with API endpoints
- **[ROADMAP.md](ROADMAP.md)** - Product roadmap and future plans
- **[SETUP.md](SETUP.md)** - Detailed setup and configuration guide
- **[QUICKSTART.md](QUICKSTART.md)** - Get started in 5 minutes

## 🗺️ What's Next?

Check out our [Product Roadmap](ROADMAP.md) for upcoming features:

**Phase 1 (Q2 2026):**
- 🔐 Authentication & Authorization (JWT, roles)
- 🔔 Advanced Alerting (Slack, Discord, Teams)
- 📝 Audit logs for compliance

**Phase 2 (Q3 2026):**
- 📊 Cache hit ratio & table bloat monitoring
- 🔍 Advanced index usage statistics
- 🤖 Predictive analytics (ML-based)

**Phase 3 (Q4 2026):**
- 💻 Infrastructure monitoring (I/O, network, memory)
- 📧 Scheduled reports
- 📱 Mobile-responsive enhancements

**Phase 4 (Q1 2027):**
- 🏢 Multi-tenancy support
- 🔌 Enterprise integrations (Grafana plugin, PagerDuty)
- 💾 Backup management from UI

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Docker & Docker Compose (optional)
- At least one database (PostgreSQL, MySQL, or SQL Server)

### Option 1: Docker (Recommended)

```bash
# Clone the repository
git clone <your-repo-url>
cd GuardSqlMonitor

# Copy and configure environment
cp .env.example .env
# Edit .env with your database credentials

# Start everything with Docker
docker-compose up -d

# Access the dashboard
# Frontend: http://localhost
# Backend API: http://localhost:3001
# Prometheus Metrics: http://localhost:3001/metrics
```

### Option 2: Manual Setup

#### Backend Setup

```bash
# Install dependencies
npm install

# Copy and configure environment
cp .env.example .env
# Edit .env with your database credentials

# Development mode
npm run dev

# Production mode
npm run build
npm start
```

#### Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Development mode
npm run dev

# Production build
npm run build
npm run preview
```

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Server Configuration
NODE_ENV=production
PORT=3001
HOST=0.0.0.0

# PostgreSQL Database
PG_ENABLED=true
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=mydb
PG_USER=postgres
PG_PASSWORD=password

# MySQL Database
MYSQL_ENABLED=false
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DATABASE=mydb
MYSQL_USER=root
MYSQL_PASSWORD=password

# SQL Server Database
MSSQL_ENABLED=false
MSSQL_HOST=localhost
MSSQL_PORT=1433
MSSQL_DATABASE=mydb
MSSQL_USER=sa
MSSQL_PASSWORD=YourPassword123!

# Monitoring Configuration
METRICS_INTERVAL=30000              # Collect metrics every 30 seconds
SLOW_QUERY_THRESHOLD=1000          # Queries slower than 1000ms
CONNECTION_POOL_CHECK_INTERVAL=60000

# Alerting Configuration
ALERTS_ENABLED=true
ALERT_EMAIL_ENABLED=false
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-password
ALERT_EMAIL_TO=admin@example.com

# Alert Thresholds
CPU_THRESHOLD=80
MEMORY_THRESHOLD=85
DISK_THRESHOLD=90
CONNECTION_THRESHOLD=90
SLOW_QUERY_COUNT_THRESHOLD=10
```

### Database-Specific Setup

#### PostgreSQL
Enable `pg_stat_statements` for slow query tracking:

```sql
-- Add to postgresql.conf
shared_preload_libraries = 'pg_stat_statements'
pg_stat_statements.track = all

-- Restart PostgreSQL, then run:
CREATE EXTENSION pg_stat_statements;
```

#### MySQL
Enable slow query log:

```sql
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 1;
SET GLOBAL log_output = 'TABLE';
```

#### SQL Server
No additional configuration required.

## 📖 API Documentation

### Health Endpoints

```http
GET /api/health
# Returns overall health status of all databases

GET /api/health/ready
# Readiness check for Kubernetes

GET /api/health/live
# Liveness check for Kubernetes
```

### Metrics Endpoints

```http
GET /api/metrics/latest
# Get latest metrics for all databases

GET /api/metrics/history/:type/:name?limit=100
# Get metrics history for a specific database

GET /api/metrics/aggregate/:type/:name?minutes=5
# Get aggregated metrics over time period

GET /metrics
# Prometheus-formatted metrics
```

### Database Endpoints

```http
GET /api/database/list
# List all configured databases

GET /api/database/:type/slow-queries?limit=10
# Get slow queries for a specific database

GET /api/database/alerts?active=true
# Get alerts (optionally filter by active status)

GET /api/database/alerts/stats
# Get alert statistics

PATCH /api/database/alerts/:id/resolve
# Resolve a specific alert

DELETE /api/database/alerts/resolved
# Clear all resolved alerts
```

### Advanced Monitoring Endpoints

```http
# Deadlock Detection
GET /api/monitoring/deadlocks
# Get current blocking chains and deadlock analysis

# Connection Pool Monitor
GET /api/monitoring/connection-pool
# Get detailed connection pool metrics and active connections

# Query Analyzer
POST /api/query-analyzer/explain
# Body: { type: 'postgres'|'mysql', query: 'SELECT ...' }
# Analyze query execution plan

# Replication Monitor
GET /api/replication/status
# Get replication lag and status for all databases

# Backup Monitor (if configured)
GET /api/monitoring/backups
# Get backup status and history
```

### Dashboard & Export Endpoints

```http
# Custom Dashboards
GET /api/dashboards
POST /api/dashboards
PUT /api/dashboards/:id
DELETE /api/dashboards/:id
# Manage custom dashboard configurations

# Historical Data
GET /api/history/metrics?startDate=2024-01-01&endDate=2024-01-31
# Query historical metrics from SQLite database

# Export Data
GET /api/export/excel?type=metrics&date=2024-01-15
GET /api/export/csv?type=connections&date=2024-01-15
GET /api/export/pdf?type=report&date=2024-01-15
# Export data in various formats
```

## 🎨 Dashboard Features

### Overview Section
- Active database count
- Total connections across all databases
- Average response time
- Active alerts summary

### Database Cards
- Real-time connection usage with visual indicators
- Performance metrics (response time, slow queries)
- Database size information
- Cache hit ratios
- Version and uptime information

### Alert Panel
- Severity-based color coding
- One-click alert resolution
- Timestamp and database information
- Metric details and threshold values

### Performance Charts
- Historical connection tracking
- Response time trends
- Slow query visualization
- Real-time updates every 30 seconds

## 🐳 Docker Deployment

The `docker-compose.yml` includes:
- Backend service (Node.js API)
- Frontend service (Nginx + React)
- PostgreSQL test database
- MySQL test database
- SQL Server test database

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

## 🔒 Security Considerations

1. **Environment Variables**: Never commit `.env` files
2. **Database Credentials**: Use read-only users when possible
3. **Network Security**: Restrict database access to monitoring server
4. **HTTPS**: Use reverse proxy (nginx/traefik) for SSL termination
5. **Email Alerts**: Use application-specific passwords
6. **Production**: Change all default passwords

## 📊 Prometheus Integration

GuardSQL Monitor exports Prometheus-compatible metrics:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'guardsql'
    static_configs:
      - targets: ['localhost:3001']
    scrape_interval: 30s
```

Available metrics:
- `db_connections_total` - Connection counts by state
- `db_response_time_ms` - Response time histogram
- `db_queries_total` - Total query counter
- `db_slow_queries` - Slow query count
- `db_size_mb` - Database size by type
- `db_cache_hit_ratio` - Cache hit percentage
- `db_uptime_seconds` - Database uptime

## 🛠️ Development

### Project Structure

```
GuardSqlMonitor/
├── src/
│   ├── config/           # Configuration management
│   ├── connectors/       # Database connectors
│   ├── services/         # Core services
│   ├── routes/           # API routes
│   ├── types/            # TypeScript types
│   ├── utils/            # Utilities
│   └── server.ts         # Main server file
├── frontend/
│   ├── src/
│   │   ├── api/         # API client
│   │   ├── components/  # React components
│   │   ├── pages/       # Page components
│   │   └── App.tsx      # Main app
│   └── package.json
├── Dockerfile            # Backend Dockerfile
├── docker-compose.yml    # Multi-container setup
└── package.json          # Backend dependencies
```

### Running Tests

```bash
# Backend tests
npm test

# Frontend tests
cd frontend
npm test
```

### Building for Production

```bash
# Backend
npm run build

# Frontend
cd frontend
npm run build
```

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Built with TypeScript, Node.js, and React
- Uses Prometheus for metrics collection
- Powered by PostgreSQL, MySQL, and SQL Server client libraries
- UI components styled with Tailwind CSS
- Charts powered by Recharts

## 📞 Support

For issues, questions, or contributions:
- Open an issue on GitHub


## 🗺️ Roadmap

See our complete [Product Roadmap](ROADMAP.md) for detailed plans across 4 phases (Q2 2026 - Q1 2027):

**Highlights:**
- 🔐 Authentication & Authorization (Phase 1)
- 🤖 Predictive Analytics with ML (Phase 2)
- 💻 Infrastructure Monitoring (Phase 3)
- 🏢 Multi-tenancy & Enterprise Integrations (Phase 4)

Plus 20+ quick wins and continuous improvements!

---

**Made with ❤️ for database administrators and developers**
