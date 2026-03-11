# GuardSQL Monitor - Quick Start 🚀

Get GuardSQL Monitor running in less than 5 minutes!

## Super Quick Start (Docker)

**Prerequisites**: Docker and Docker Compose installed

```bash
# 1. Clone the repository
git clone <repository-url>
cd GuardSqlMonitor

# 2. Copy environment file
cp .env.example .env

# 3. Start everything (includes test databases)
docker-compose up -d

# 4. Open your browser
# Dashboard: http://localhost
# API: http://localhost:3001
```

That's it! The system includes test PostgreSQL, MySQL, and SQL Server databases.

## Connect to Your Own Databases

### Step 1: Edit .env file

```bash
# Open .env in your favorite editor
nano .env
```

### Step 2: Configure Your Databases

**PostgreSQL:**
```env
PG_ENABLED=true
PG_HOST=your-postgres-host
PG_PORT=5432
PG_DATABASE=your_database
PG_USER=your_user
PG_PASSWORD=your_password
```

**MySQL:**
```env
MYSQL_ENABLED=true
MYSQL_HOST=your-mysql-host
MYSQL_PORT=3306
MYSQL_DATABASE=your_database
MYSQL_USER=your_user
MYSQL_PASSWORD=your_password
```

**SQL Server:**
```env
MSSQL_ENABLED=true
MSSQL_HOST=your-sqlserver-host
MSSQL_PORT=1433
MSSQL_DATABASE=your_database
MSSQL_USER=your_user
MSSQL_PASSWORD=your_password
```

### Step 3: Start Only Backend and Frontend

```bash
# If using Docker (without test databases)
docker-compose up -d backend frontend

# Or run manually
npm install
npm run dev

# In another terminal
cd frontend
npm install
npm run dev
```

## What's Monitoring?

GuardSQL Monitor tracks:

### Core Metrics
✅ **Connection Pool Usage** - See active, idle, and waiting connections  
✅ **Query Performance** - Identify slow queries instantly  
✅ **Database Size** - Track growth over time  
✅ **Response Times** - Monitor database latency  
✅ **Cache Hit Ratios** - Optimize performance  
✅ **Real-time Alerts** - Get notified of issues  

### Advanced Features (v1.0.0+)
🔍 **Deadlock Analyzer** - Real-time detection of blocking chains  
💻 **Connection Pool Monitor** - 8 key metrics + full connection details  
⚡ **Query Analyzer** - EXPLAIN plan analysis for query optimization  
📊 **Advanced Charts** - Historical trends with Recharts  
📥 **Data Export** - Excel, CSV, and PDF report generation  
🎨 **Custom Dashboards** - Build personalized monitoring views  
📅 **Date Range Filtering** - Flexible time-based analysis  
🔐 **Connection Details Modal** - Full metadata including client IP, hostname, query text  

💾 **Historical Database** - 30-day data retention with SQLite (WAL mode)  

## Need Help?

- 📖 Full documentation: [README.md](README.md)
- ⚙️ Setup guide: [SETUP.md](SETUP.md)
- 🎯 Features & API: [FEATURES.md](FEATURES.md)
- 🗺️ Product roadmap: [ROADMAP.md](ROADMAP.md)
- 🐛 Issues: Open an issue on GitHub

## Tips

1. **Start with one database** - Enable just PostgreSQL first, then add others
2. **Check the dashboard** - Refresh might be needed on first load
3. **Email alerts** - Configure later, not required for basic monitoring
4. **Prometheus** - Metrics available at http://localhost:3001/metrics

## Common Issues

**"Cannot connect to database"**
- Verify host, port, username, and password
- Check firewall allows connections
- Test with: `telnet your-host 5432`

**"Port already in use"**
- Change PORT in .env file
- Or kill the process: `lsof -i :3001`

**"Frontend shows error"**
- Backend must be running first
- Check: `curl http://localhost:3001/api/health`

---

**You're all set! 🎉 Check http://localhost for your dashboard**
