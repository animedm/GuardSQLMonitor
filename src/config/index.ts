import dotenv from 'dotenv';

dotenv.config();

export const config = {
  server: {
    port: parseInt(process.env.PORT || '3001', 10),
    host: process.env.HOST || '0.0.0.0',
    env: process.env.NODE_ENV || 'development'
  },
  
  databases: {
    postgres: {
      enabled: process.env.PG_ENABLED === 'true',
      host: process.env.PG_HOST || 'localhost',
      port: parseInt(process.env.PG_PORT || '5432', 10),
      database: process.env.PG_DATABASE || 'postgres',
      user: process.env.PG_USER || 'postgres',
      password: process.env.PG_PASSWORD || '',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    },
    mysql: {
      enabled: process.env.MYSQL_ENABLED === 'true',
      host: process.env.MYSQL_HOST || 'localhost',
      port: parseInt(process.env.MYSQL_PORT || '3306', 10),
      database: process.env.MYSQL_DATABASE || 'mysql',
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      waitForConnections: true,
      connectionLimit: 20,
      queueLimit: 0
    },
    mssql: {
      enabled: process.env.MSSQL_ENABLED === 'true',
      server: process.env.MSSQL_HOST || 'localhost',
      port: parseInt(process.env.MSSQL_PORT || '1433', 10),
      database: process.env.MSSQL_DATABASE || 'master',
      user: process.env.MSSQL_USER || 'sa',
      password: process.env.MSSQL_PASSWORD || '',
      options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true
      },
      pool: {
        max: 20,
        min: 0,
        idleTimeoutMillis: 30000
      }
    }
  },
  
  redis: {
    enabled: process.env.REDIS_ENABLED === 'true',
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined
  },
  
  monitoring: {
    metricsInterval: parseInt(process.env.METRICS_INTERVAL || '30000', 10),
    slowQueryThreshold: parseInt(process.env.SLOW_QUERY_THRESHOLD || '1000', 10),
    connectionPoolCheckInterval: parseInt(process.env.CONNECTION_POOL_CHECK_INTERVAL || '60000', 10)
  },
  
  alerts: {
    enabled: process.env.ALERTS_ENABLED === 'true',
    email: {
      enabled: process.env.ALERT_EMAIL_ENABLED === 'true',
      smtp: {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        user: process.env.SMTP_USER || '',
        password: process.env.SMTP_PASSWORD || ''
      },
      to: process.env.ALERT_EMAIL_TO || ''
    },
    thresholds: {
      cpu: parseInt(process.env.CPU_THRESHOLD || '80', 10),
      memory: parseInt(process.env.MEMORY_THRESHOLD || '85', 10),
      disk: parseInt(process.env.DISK_THRESHOLD || '90', 10),
      connections: parseInt(process.env.CONNECTION_THRESHOLD || '90', 10),
      slowQueryCount: parseInt(process.env.SLOW_QUERY_COUNT_THRESHOLD || '10', 10)
    }
  }
};
