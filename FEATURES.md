# GuardSQL Monitor - Features Documentation 📋

**Version:** 1.0.0  
**Last Updated:** March 2026

---

## 🎯 Complete Feature List

### **Core Monitoring**

#### 1. **Real-Time Metrics Collection**
- ✅ Automatic metrics collection every 30 seconds (configurable)
- ✅ Connection statistics (active, idle, total, waiting)
- ✅ Query performance metrics (QPS, slow queries, transaction rate)
- ✅ Resource usage (CPU, memory, disk)
- ✅ Database size tracking (data, indexes, total)
- ✅ Health checks with response time monitoring
- ✅ Uptime tracking

**Supported Databases:**
- PostgreSQL 10+
- MySQL 5.7+
- SQL Server 2019+

**API Endpoints:**
- `GET /api/metrics` - Current metrics
- `GET /api/health` - Health check
- `GET /api/database` - Database list

---

### **Historical Data & Analytics**

#### 2. **SQLite Historical Storage**
- ✅ Local SQLite database for historical data
- ✅ 30-day automatic retention
- ✅ WAL mode for performance
- ✅ Metrics history tracking
- ✅ Slow query history
- ✅ Alert history

**Features:**
- Automatic cleanup of old data
- Efficient indexing for fast queries
- Export historical data

**API Endpoints:**
- `GET /api/history/metrics` - Metrics timeline
- `GET /api/history/slow-queries` - Slow query history
- `GET /api/history/alerts` - Alert history

**Database Schema:**
- `metrics` table (timestamp, database, metrics JSON)
- `slow_queries` table (timestamp, query, duration, database)
- `alerts` table (timestamp, severity, message, resolved)

---

### **Connection Pool Monitoring**

#### 3. **Advanced Pool Analytics**
- ✅ Real-time pool utilization tracking
- ✅ Connection leak detection (>5 minutes idle in transaction)
- ✅ Blocked and blocking connection identification
- ✅ Long-running connection alerts (>5 minutes)
- ✅ Wait event tracking
- ✅ Connection trends analysis (increasing/decreasing/stable)
- ✅ Pool exhaustion warnings (80% warning, 95% critical)

**Metrics Tracked:**
- Total connections
- Active connections
- Idle connections
- Utilization percentage
- Connection leaks with full details
- Blocking chains

**UI Features:**
- 8 metric cards (4 main + 4 advanced)
- Full connection table with all active connections
- Connection detail modal with:
  - Client IP, hostname, port
  - Backend start time, transaction start, query start
  - Full query text (no truncation)
  - Wait events
  - Blocking/blocked status
- Historical charts (Recharts integration)
- Auto-refresh every 30 seconds

**API Endpoints:**
- `GET /api/monitoring/pool/stats` - Current pool statistics
- `GET /api/monitoring/pool/history` - Pool metrics history
- `GET /api/monitoring/pool/trends` - Pool trend analysis
- `GET /api/monitoring/connections` - All active connections

---

### **Deadlock Detection & Analysis**

#### 4. **Intelligent Deadlock Monitoring**
- ✅ Real-time deadlock detection
- ✅ Blocking chain visualization
- ✅ PostgreSQL: `pg_locks` analysis
- ✅ MySQL: `SHOW ENGINE INNODB STATUS` parsing
- ✅ Deadlock history (last 100)
- ✅ Automatic resolution tracking
- ✅ Suggestions for prevention

**Features:**
- Identify circular blocking dependencies
- Show affected queries and PIDs
- Track transaction victims
- Generate prevention recommendations
  - "Access tables in same order"
  - "Use shorter transactions"
  - "Add appropriate indexes"
  - "Use row-level locking"

**UI Components:**
- Scan for deadlocks button
- Auto-scan with configurable interval
- Blocking chains display with:
  - PIDs involved
  - User and application
  - Query preview
  - Duration
  - Wait events
- Active connections table
- Deadlock history timeline

**API Endpoints:**
- `POST /api/monitoring/deadlocks/detect` - Detect deadlocks
- `GET /api/monitoring/deadlocks/history` - Deadlock history
- `DELETE /api/monitoring/deadlocks/history` - Clear history
- `GET /api/monitoring/connections` - Connection details

---

### **Query Performance Analysis**

#### 5. **Query Analyzer with EXPLAIN**
- ✅ EXPLAIN plan analysis for PostgreSQL and MySQL
- ✅ Visual execution plan display
- ✅ Cost breakdown
- ✅ Buffer statistics (PostgreSQL)
- ✅ Execution time tracking
- ✅ Query optimization suggestions
- ✅ JSON format support

**PostgreSQL Features:**
- `EXPLAIN (ANALYZE, BUFFERS)` support
- Shared hits/reads/dirtied tracking
- Temp blocks analysis
- Detailed node information

**MySQL Features:**
- `EXPLAIN FORMAT=JSON` support
- Query cost estimation
- Index usage analysis
- Table scan detection

**Suggestions Generated:**
- Missing indexes
- Sequential scan warnings
- High cost operations
- Buffer inefficiencies

**UI Features:**
- SQL query input with syntax highlighting
- Database and type selector
- Execution plan tree visualization
- Metrics breakdown table
- Optimization suggestions panel

**API Endpoints:**
- `POST /api/query-analyzer/explain` - Analyze query

---

### **Replication Monitoring**

#### 6. **Master-Slave Replication Tracking**
- ✅ Replication lag monitoring
- ✅ Replica status tracking
- ✅ Multiple replica support
- ✅ WAL position tracking (PostgreSQL)
- ✅ Binlog position tracking (MySQL)
- ✅ Replication health alerts

**Features:**
- Real-time lag measurement
- Replica state monitoring
- Sync status tracking
- LSN/position comparison

**UI Components:**
- Replica cards with status indicators
- Lag metrics display
- Sync/async indication
- Health status badges

**API Endpoints:**
- `GET /api/replication/status` - Replication status

---

### **Backup Monitoring**

#### 7. **Backup Status Tracking**
- ✅ Last backup timestamp
- ✅ Backup size tracking
- ✅ Backup age monitoring
- ✅ Backup location tracking
- ✅ Success/failure status

**Features:**
- Multiple backup job support
- Age-based alerts
- Size trending
- Status history

**UI Components:**
- Backup job cards
- Time since last backup
- Size display
- Status indicators

---

### **Advanced Charts & Visualization**

#### 8. **Recharts Integration**
- ✅ Area charts for metrics timeline
- ✅ Line charts for connection pools
- ✅ Bar charts for comparisons
- ✅ Responsive design
- ✅ Interactive tooltips
- ✅ Legend with toggle
- ✅ Time-based X-axis

**Chart Types:**
- Metrics Timeline (Area)
- Connection Pool Trends (Line)
- Query Performance (Bar)
- Custom dashboard charts

**Features:**
- Zoom and pan
- Export as PNG
- Customizable colors
- Dark theme optimized

---

### **Export & Reporting**

#### 9. **Multi-Format Export**
- ✅ **Excel (.xlsx)** - Multi-sheet workbooks
- ✅ **CSV** - Metrics and slow queries
- ✅ **PDF** - Formatted reports with tables

**Excel Export:**
- Sheet 1: Summary (database info, key metrics)
- Sheet 2: Detailed metrics (all metrics with formatting)
- Sheet 3: Slow queries (query, duration, database, timestamp)
- Styled headers (blue background, white text)
- Auto-width columns
- Number formatting

**CSV Export:**
- Metrics: timestamp, database, all metrics columns
- Slow Queries: timestamp, query, duration, database

**PDF Export:**
- Title and metadata
- Auto-table with headers
- Page numbering
- Formatted dates

**UI Features:**
- Export buttons on History page
- One-click download
- Progress indicators

**API Endpoints:**
- `GET /api/export/excel` - Excel workbook
- `GET /api/export/metrics/csv` - Metrics CSV
- `GET /api/export/slow-queries/csv` - Slow queries CSV
- `GET /api/export/slow-queries/pdf` - Slow queries PDF

---

### **Customizable Dashboards**

#### 10. **Dashboard Management**
- ✅ Create custom dashboards
- ✅ Configure widgets
- ✅ Reorder widgets
- ✅ Edit dashboard settings
- ✅ Delete dashboards
- ✅ Multiple dashboard support

**Widget Types:**
- Metric cards
- Charts
- Tables
- Alerts

**Features:**
- Drag-and-drop layout (planned)
- Per-dashboard settings
- Widget configuration
- Dashboard templates

**UI Components:**
- Dashboard list view
- Dashboard editor
- Widget configurator
- Preview mode

**API Endpoints:**
- `GET /api/dashboards` - List dashboards
- `POST /api/dashboards` - Create dashboard
- `GET /api/dashboards/:id` - Get dashboard
- `PUT /api/dashboards/:id` - Update dashboard
- `DELETE /api/dashboards/:id` - Delete dashboard

---

### **Date Range Filtering**

#### 11. **Flexible Time Selection**
- ✅ Calendar date picker
- ✅ Time picker (hours and minutes)
- ✅ Quick preset buttons
- ✅ Date range validation

**Presets:**
- Last Hour
- Last 24 Hours
- Last 7 Days
- Last 30 Days

**Features:**
- Start and end date/time
- Timezone aware
- URL state preservation
- Fast preset switching

---

### **Alert System**

#### 12. **Intelligent Alerting**
- ✅ Real-time alert generation
- ✅ Email notifications (SMTP)
- ✅ Multiple severity levels (info, warning, critical)
- ✅ Configurable thresholds
- ✅ Cooldown period to prevent spam
- ✅ Alert history
- ✅ Alert acknowledgment (planned)

**Alert Triggers:**
- High CPU usage (>80%)
- High memory usage (>85%)
- High disk usage (>90%)
- High connection usage (>90%)
- Too many slow queries (>10)
- Replication lag
- Backup failures

**Email Templates:**
- HTML formatted
- Severity-based colors
- Database details
- Threshold information
- Timestamp

**Configuration:**
```env
ALERTS_ENABLED=true
ALERT_EMAIL_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
ALERT_EMAIL_TO=admin@example.com

CPU_THRESHOLD=80
MEMORY_THRESHOLD=85
DISK_THRESHOLD=90
CONNECTION_THRESHOLD=90
SLOW_QUERY_COUNT_THRESHOLD=10
```

---

### **Prometheus Integration**

#### 13. **Metrics Export**
- ✅ Prometheus-compatible metrics endpoint
- ✅ Standard metric naming conventions
- ✅ Database-labeled metrics
- ✅ Real-time updates

**Exported Metrics:**
- `database_connections_active`
- `database_connections_idle`
- `database_connections_total`
- `database_cpu_usage_percent`
- `database_memory_usage_mb`
- `database_qps`
- `database_slow_queries_count`
- `database_size_bytes`

**Endpoint:**
- `GET /metrics` - Prometheus metrics

**Grafana Compatible:** Import metrics directly into Grafana dashboards

---

### **Connection Detail Modal**

#### 14. **Full Connection Metadata**
- ✅ Client connection information
  - IP address
  - Hostname
  - Port
- ✅ Timing information
  - Backend start time
  - Transaction start time
  - Query start time
  - Duration
- ✅ Query information
  - Full SQL text (no truncation)
  - Query state
  - Wait events
- ✅ Blocking information
  - Blocked status
  - Blocking other connections (PIDs)
  - Blocking chain visualization

**UI Features:**
- Modal popup on demand
- Tabbed sections for organization
- Copy-to-clipboard buttons
- Formatted timestamps (localized)
- Color-coded states
- Sticky header/footer

**Available From:**
- Deadlock Analyzer page
- Connection Pool page
- Any connection table

---

### **Frontend UI**

#### 15. **Modern React Dashboard**
- ✅ React 18 with TypeScript
- ✅ Vite for fast development
- ✅ Tailwind CSS for styling
- ✅ Lucide React icons
- ✅ React Router for navigation
- ✅ Dark theme optimized
- ✅ Responsive layout

**Pages:**
1. **Dashboard** - Overview with all databases
2. **Replication** - Replica monitoring
3. **Dashboards** - Custom dashboard management
4. **History** - Historical data with charts
5. **Query Analyzer** - EXPLAIN plan analysis
6. **Deadlock Analyzer** - Deadlock detection
7. **Connection Pool** - Pool monitoring

**Components:**
- DatabaseCard - Database overview
- AlertPanel - Alert display
- MetricsTimeline - Historical charts
- ReplicationMonitor - Replica status
- BackupMonitor - Backup status
- ConnectionDetailModal - Full connection info

---

### **Backend Architecture**

#### 16. **Node.js + TypeScript**
- ✅ Express.js REST API
- ✅ TypeScript for type safety
- ✅ Modular service architecture
- ✅ Connection pooling
- ✅ Error handling
- ✅ Logging (Winston)
- ✅ CORS enabled

**Services:**
- `DatabaseMonitor` - Main monitoring service
- `AlertService` - Alert generation and delivery
- `HistoricalDatabase` - SQLite management
- `DeadlockMonitor` - Deadlock detection
- `ConnectionPoolMonitor` - Pool monitoring
- `ExportService` - Report generation
- `PrometheusService` - Metrics export

**Connectors:**
- `PostgresConnector` - PostgreSQL client
- `MySQLConnector` - MySQL client
- `SQLServerConnector` - SQL Server client

**Routes:**
- `/api/health` - Health check
- `/api/metrics` - Current metrics
- `/api/database` - Database operations
- `/api/history/*` - Historical data
- `/api/monitoring/*` - Deadlock and pool monitoring
- `/api/export/*` - Report export
- `/api/query-analyzer/*` - Query analysis
- `/api/replication/*` - Replication monitoring
- `/api/dashboards/*` - Dashboard CRUD

---

## 🔧 Configuration Options

### Environment Variables

All features can be configured via `.env` file:

```env
# Server
NODE_ENV=production
PORT=3001
HOST=0.0.0.0

# Database Connections
PG_ENABLED=true
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=mydb
PG_USER=postgres
PG_PASSWORD=password
PG_SSL_ENABLED=false

MYSQL_ENABLED=false
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DATABASE=mydb
MYSQL_USER=root
MYSQL_PASSWORD=password

MSSQL_ENABLED=false
MSSQL_HOST=localhost
MSSQL_PORT=1433
MSSQL_DATABASE=mydb
MSSQL_USER=sa
MSSQL_PASSWORD=password

# Monitoring
METRICS_INTERVAL=30000
SLOW_QUERY_THRESHOLD=1000
CONNECTION_POOL_CHECK_INTERVAL=60000

# Alerts
ALERTS_ENABLED=true
ALERT_EMAIL_ENABLED=false
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email
SMTP_PASSWORD=your-password
ALERT_EMAIL_TO=admin@example.com

# Thresholds
CPU_THRESHOLD=80
MEMORY_THRESHOLD=85
DISK_THRESHOLD=90
CONNECTION_THRESHOLD=90
SLOW_QUERY_COUNT_THRESHOLD=10
```

---

## 📊 Technical Specifications

### Performance
- Monitoring interval: 30 seconds (configurable)
- Historical retention: 30 days
- Max deadlock history: 100 entries
- Max pool metrics history: 100 entries
- API response time: <500ms average
- Frontend load time: <2 seconds

### Scalability
- Supports multiple databases simultaneously
- SQLite WAL mode for concurrent access
- Connection pooling for efficiency
- Async/await throughout
- Non-blocking I/O

### Security
- Environment variable configuration
- No credentials in code
- CORS protection
- Input validation (Zod)
- Prepared statements (SQL injection protection)
- SSL/TLS support for database connections

### Dependencies
**Backend:**
- express: Web framework
- pg: PostgreSQL client
- mysql2: MySQL client
- mssql: SQL Server client
- better-sqlite3: SQLite client
- winston: Logging
- nodemailer: Email sending
- exceljs: Excel generation
- prom-client: Prometheus metrics
- node-cron: Scheduled tasks

**Frontend:**
- react: UI framework
- recharts: Charts
- lucide-react: Icons
- tailwind: Styling
- react-router: Navigation

---

## 🚀 Next Features (Roadmap)

See [ROADMAP.md](ROADMAP.md) for the complete feature roadmap.

**Coming Soon:**
- 🔐 Authentication & Authorization
- 🔔 Slack/Discord/Teams integrations
- 📊 Cache hit ratio monitoring
- 🤖 Predictive analytics
- 🏢 Multi-tenancy

---

## 📝 Feature Status

| Feature | Status | Version |
|---------|--------|---------|
| Multi-DB Support | ✅ Stable | 1.0.0 |
| Real-time Monitoring | ✅ Stable | 1.0.0 |
| Historical Data | ✅ Stable | 1.0.0 |
| Connection Pool Monitor | ✅ Stable | 1.0.0 |
| Deadlock Detection | ✅ Stable | 1.0.0 |
| Query Analyzer | ✅ Stable | 1.0.0 |
| Export (Excel/CSV/PDF) | ✅ Stable | 1.0.0 |
| Replication Monitor | ✅ Stable | 1.0.0 |
| Custom Dashboards | ✅ Stable | 1.0.0 |
| Email Alerts | ✅ Stable | 1.0.0 |
| Prometheus Export | ✅ Stable | 1.0.0 |
| Authentication | 🔄 Planned | 1.1.0 |
| Advanced Alerts | 🔄 Planned | 1.1.0 |
| Cache Monitoring | 🔄 Planned | 1.2.0 |
| Predictive Analytics | 🔄 Planned | 1.2.0 |

---

**Last Updated:** March 11, 2026  
**Version:** 1.0.0
