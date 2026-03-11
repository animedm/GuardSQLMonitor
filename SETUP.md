# GuardSQL Monitor - Setup Guide

## Table of Contents
1. [System Requirements](#system-requirements)
2. [Installation Methods](#installation-methods)
3. [Database Configuration](#database-configuration)
4. [Email Alerts Setup](#email-alerts-setup)
5. [Production Deployment](#production-deployment)
6. [Troubleshooting](#troubleshooting)

## System Requirements

### Minimum Requirements
- **Node.js**: 20.x or higher
- **Memory**: 512MB RAM
- **Disk**: 1GB free space
- **Database Access**: Network connectivity to monitored databases

### Recommended for Production
- **Node.js**: 20.x LTS
- **Memory**: 2GB RAM
- **Disk**: 5GB free space
- **CPU**: 2 cores
- **Network**: Low latency connection to databases

## Installation Methods

### Method 1: Docker Compose (Recommended)

This is the easiest way to get started with all the demo databases included.

```bash
# 1. Clone and navigate
cd GuardSqlMonitor

# 2. Copy environment file
cp .env.example .env

# 3. Start everything
docker-compose up -d

# 4. Check status
docker-compose ps

# 5. View logs
docker-compose logs -f backend
```

**Access Points:**
- Frontend: http://localhost
- Backend API: http://localhost:3001
- Metrics: http://localhost:3001/metrics

### Method 2: Manual Installation

For connecting to existing databases without Docker.

#### Step 1: Install Backend

```bash
# Install dependencies
npm install

# Copy and edit environment
cp .env.example .env
nano .env  # or use any text editor

# Build TypeScript
npm run build

# Start in production
npm start

# OR start in development mode
npm run dev
```

#### Step 2: Install Frontend

```bash
cd frontend

# Install dependencies
npm install

# For development
npm run dev

# For production
npm run build
# Then serve the 'dist' folder with nginx or any static server
```

### Method 3: Docker without Test Databases

If you want to use Docker but connect to your existing databases:

```bash
# 1. Create docker-compose.override.yml
cat > docker-compose.override.yml << EOF
version: '3.8'
services:
  backend:
    environment:
      PG_HOST: your-postgres-host
      MYSQL_HOST: your-mysql-host
      MSSQL_HOST: your-mssql-host
EOF

# 2. Remove test database services
docker-compose up -d backend frontend
```

## Database Configuration

### PostgreSQL Setup

#### 1. Create Monitoring User (Recommended)

```sql
-- Create read-only user
CREATE USER guardsql_monitor WITH PASSWORD 'secure_password';

-- Grant connection
GRANT CONNECT ON DATABASE your_database TO guardsql_monitor;

-- Grant schema usage
GRANT USAGE ON SCHEMA public TO guardsql_monitor;

-- Grant select on all tables
GRANT SELECT ON ALL TABLES IN SCHEMA public TO guardsql_monitor;

-- Grant select on system catalogs
GRANT pg_monitor TO guardsql_monitor;
```

#### 2. Enable Query Statistics

```bash
# Edit postgresql.conf
shared_preload_libraries = 'pg_stat_statements'
pg_stat_statements.track = all
pg_stat_statements.max = 10000

# Restart PostgreSQL
sudo systemctl restart postgresql

# Create extension
psql -U postgres -d your_database -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements;"
```

#### 3. Configure .env

```env
PG_ENABLED=true
PG_HOST=your-postgres-host
PG_PORT=5432
PG_DATABASE=your_database
PG_USER=guardsql_monitor
PG_PASSWORD=secure_password
```

### MySQL Setup

#### 1. Create Monitoring User

```sql
-- Create user
CREATE USER 'guardsql_monitor'@'%' IDENTIFIED BY 'secure_password';

-- Grant privileges
GRANT SELECT, PROCESS, REPLICATION CLIENT ON *.* TO 'guardsql_monitor'@'%';
GRANT SELECT ON mysql.slow_log TO 'guardsql_monitor'@'%';
GRANT SELECT ON performance_schema.* TO 'guardsql_monitor'@'%';

FLUSH PRIVILEGES;
```

#### 2. Enable Slow Query Log

```sql
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 1;
SET GLOBAL log_output = 'TABLE';
```

Or in `my.cnf`:

```ini
[mysqld]
slow_query_log = 1
long_query_time = 1
log_output = TABLE
```

#### 3. Configure .env

```env
MYSQL_ENABLED=true
MYSQL_HOST=your-mysql-host
MYSQL_PORT=3306
MYSQL_DATABASE=your_database
MYSQL_USER=guardsql_monitor
MYSQL_PASSWORD=secure_password
```

### SQL Server Setup

#### 1. Create Monitoring Login

```sql
-- Create login
CREATE LOGIN guardsql_monitor WITH PASSWORD = 'Secure_Password123!';

-- Create user in each database to monitor
USE your_database;
CREATE USER guardsql_monitor FOR LOGIN guardsql_monitor;

-- Grant view permissions
GRANT VIEW SERVER STATE TO guardsql_monitor;
GRANT VIEW DATABASE STATE TO guardsql_monitor;
GRANT VIEW ANY DEFINITION TO guardsql_monitor;

-- Add to db_datareader role
ALTER ROLE db_datareader ADD MEMBER guardsql_monitor;
```

#### 2. Configure .env

```env
MSSQL_ENABLED=true
MSSQL_HOST=your-sqlserver-host
MSSQL_PORT=1433
MSSQL_DATABASE=your_database
MSSQL_USER=guardsql_monitor
MSSQL_PASSWORD=Secure_Password123!
```

## Email Alerts Setup

### Gmail Configuration

1. **Enable 2-Factor Authentication** on your Google account

2. **Generate App Password**:
   - Go to https://myaccount.google.com/apppasswords
   - Select "Mail" and "Other (Custom name)"
   - Copy the generated 16-character password

3. **Configure .env**:

```env
ALERTS_ENABLED=true
ALERT_EMAIL_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-16-char-app-password
ALERT_EMAIL_TO=admin@example.com
```

### Other SMTP Providers

#### Outlook/Office 365
```env
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
```

#### SendGrid
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=your-sendgrid-api-key
```

#### AWS SES
```env
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=your-ses-smtp-username
SMTP_PASSWORD=your-ses-smtp-password
```

## Production Deployment

### Using PM2 (Process Manager)

```bash
# Install PM2
npm install -g pm2

# Start backend
pm2 start dist/server.js --name guardsql-backend

# Save PM2 configuration
pm2 save

# Setup auto-start on reboot
pm2 startup
```

### Using Systemd

Create `/etc/systemd/system/guardsql.service`:

```ini
[Unit]
Description=GuardSQL Monitor
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/guardsql
ExecStart=/usr/bin/node /opt/guardsql/dist/server.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=guardsql
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable guardsql
sudo systemctl start guardsql
sudo systemctl status guardsql
```

### Nginx Reverse Proxy

Create `/etc/nginx/sites-available/guardsql`:

```nginx
server {
    listen 80;
    server_name monitor.yourdomain.com;

    # Frontend
    location / {
        root /opt/guardsql/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Metrics
    location /metrics {
        proxy_pass http://localhost:3001;
        # Optional: Restrict access
        allow 10.0.0.0/8;
        deny all;
    }
}
```

Enable site:

```bash
sudo ln -s /etc/nginx/sites-available/guardsql /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### SSL with Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d monitor.yourdomain.com
```

## Troubleshooting

### Backend Won't Start

**Issue**: Port already in use
```bash
# Find process using port 3001
lsof -i :3001
# Or on Windows
netstat -ano | findstr :3001

# Kill the process or change PORT in .env
```

**Issue**: Database connection failed
```bash
# Test database connectivity
telnet db-host 5432

# Check credentials
# Verify firewall rules
# Check database logs
```

### Frontend Shows No Data

1. **Check backend is running**:
```bash
curl http://localhost:3001/api/health
```

2. **Check browser console** for errors

3. **Verify CORS settings** if frontend and backend on different domains

### Prometheus Metrics Not Showing

```bash
# Test metrics endpoint
curl http://localhost:3001/metrics

# Should return Prometheus-formatted metrics
```

### High Memory Usage

1. **Reduce metrics history**:
   - Edit `src/services/MetricsCollector.ts`
   - Change `maxHistorySize` to lower value

2. **Increase METRICS_INTERVAL** in `.env`

### Slow Query Detection Not Working

**PostgreSQL**: Verify `pg_stat_statements` extension
```sql
SELECT * FROM pg_available_extensions WHERE name = 'pg_stat_statements';
```

**MySQL**: Check slow query log is enabled
```sql
SHOW VARIABLES LIKE 'slow_query_log';
```

### Email Alerts Not Sending

1. Test SMTP connection manually
2. Check spam folder
3. Verify app password (not regular password)
4. Check firewall allows outbound port 587

### Docker Issues

```bash
# View all logs
docker-compose logs

# Restart services
docker-compose restart

# Rebuild images
docker-compose build --no-cache
docker-compose up -d

# Check service health
docker-compose ps
```

## Getting Help

If you encounter issues not covered here:

1. Check the logs: `logs/combined.log` and `logs/error.log`
2. Enable debug logging: `LOG_LEVEL=debug` in `.env`
3. Open an issue on GitHub with:
   - Error messages
   - Configuration (hide passwords!)
   - System information
   - Steps to reproduce

---

**Next Steps**: 
- See [README.md](README.md) for feature documentation and API reference
- Check [FEATURES.md](FEATURES.md) for comprehensive feature details including:
  - **Deadlock Analyzer**: Real-time blocking chain detection
  - **Connection Pool Monitor**: 8 key metrics + detailed connection tracking
  - **Query Analyzer**: EXPLAIN plan analysis for PostgreSQL and MySQL
  - **Advanced Exports**: Excel, CSV, and PDF report generation
  - **Custom Dashboards**: Build personalized monitoring views
  - **Historical Analytics**: 30-day data retention with SQLite
- Review [ROADMAP.md](ROADMAP.md) for upcoming features and enhancements
