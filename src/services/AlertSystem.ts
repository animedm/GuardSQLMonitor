import nodemailer from 'nodemailer';
import { randomUUID } from 'crypto';
import { config } from '../config';
import { logger } from '../utils/logger';
import { Alert } from '../types';

interface AlertInput {
  severity: 'critical' | 'warning' | 'info';
  database: string;
  type: string;
  message: string;
  metric?: string;
  value?: number;
  threshold?: number;
  cooldownMs?: number;
  notifyEmail?: {
    enabled: boolean;
    to: string;
  };
  notifyWebhook?: {
    enabled: boolean;
    url: string;
  };
}

export class AlertSystem {
  private static instance: AlertSystem;
  private alerts: Map<string, Alert> = new Map();
  private emailTransporter: nodemailer.Transporter | null = null;
  private alertCooldown: Map<string, number> = new Map();
  private readonly defaultCooldownPeriod = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    if (config.alerts.email.smtp.host) {
      this.setupEmailTransporter();
    }
  }

  public static getInstance(): AlertSystem {
    if (!AlertSystem.instance) {
      AlertSystem.instance = new AlertSystem();
    }
    return AlertSystem.instance;
  }

  private setupEmailTransporter(): void {
    try {
      const transportConfig: any = {
        host: config.alerts.email.smtp.host,
        port: config.alerts.email.smtp.port,
        secure: false
      };

      if (config.alerts.email.smtp.user) {
        transportConfig.auth = {
          user: config.alerts.email.smtp.user,
          pass: config.alerts.email.smtp.password
        };
      }

      this.emailTransporter = nodemailer.createTransport({
        ...transportConfig
      });
      logger.info('Email alerting configured');
    } catch (error) {
      logger.error('Failed to setup email transporter:', error);
    }
  }

  public createAlert(input: AlertInput): Alert {
    if (!config.alerts.enabled && !input.notifyEmail?.enabled) {
      return this.buildAlert(input);
    }

    const cooldownMs = input.cooldownMs && input.cooldownMs > 0 ? input.cooldownMs : this.defaultCooldownPeriod;

    // Check cooldown to avoid alert spam
    const alertKey = `${input.database}:${input.type}`;
    const lastAlertTime = this.alertCooldown.get(alertKey);
    
    if (lastAlertTime && Date.now() - lastAlertTime < cooldownMs) {
      logger.debug(`Alert ${alertKey} is in cooldown period`);
      return this.buildAlert(input);
    }

    const alert = this.buildAlert(input);
    this.alerts.set(alert.id, alert);
    this.alertCooldown.set(alertKey, Date.now());

    logger.warn(`🚨 Alert created: [${alert.severity.toUpperCase()}] ${alert.message}`, {
      database: alert.database,
      type: alert.type,
      value: alert.value,
      threshold: alert.threshold
    });

    // Send email notification if enabled
    const emailEnabled = typeof input.notifyEmail?.enabled === 'boolean' ? input.notifyEmail.enabled : config.alerts.email.enabled;
    const emailTo = typeof input.notifyEmail?.to === 'string' ? input.notifyEmail.to : config.alerts.email.to;

    if (emailEnabled && emailTo && (alert.severity === 'critical' || alert.severity === 'warning')) {
      this.sendEmailAlert(alert, emailTo).catch(err => 
        logger.error('Failed to send email alert:', err)
      );
    }

    const webhookEnabled = Boolean(input.notifyWebhook?.enabled);
    const webhookUrl = input.notifyWebhook?.url || '';

    if (webhookEnabled && webhookUrl) {
      this.sendWebhookAlert(alert, webhookUrl).catch(err =>
        logger.error('Failed to send webhook alert:', err)
      );
    }

    return alert;
  }

  private buildAlert(input: AlertInput): Alert {
    return {
      id: randomUUID(),
      timestamp: new Date(),
      severity: input.severity,
      database: input.database,
      type: input.type,
      message: input.message,
      metric: input.metric,
      value: input.value,
      threshold: input.threshold,
      resolved: false
    };
  }

  private async sendEmailAlert(alert: Alert, recipient: string): Promise<void> {
    if (!this.emailTransporter) {
      this.setupEmailTransporter();
    }

    if (!this.emailTransporter) {
      return;
    }

    const subject = `[${alert.severity.toUpperCase()}] Database Alert: ${alert.database}`;
    const body = `
Database Monitoring Alert

Severity: ${alert.severity.toUpperCase()}
Database: ${alert.database}
Type: ${alert.type}
Message: ${alert.message}
${alert.metric ? `Metric: ${alert.metric}` : ''}
${alert.value !== undefined ? `Current Value: ${alert.value.toFixed(2)}` : ''}
${alert.threshold !== undefined ? `Threshold: ${alert.threshold}` : ''}

Timestamp: ${alert.timestamp.toISOString()}
Alert ID: ${alert.id}

---
GuardSQL Monitor
    `.trim();

    try {
      await this.emailTransporter.sendMail({
        from: config.alerts.email.smtp.user,
        to: recipient,
        subject,
        text: body
      });
      logger.info(`Email alert sent for ${alert.id}`);
    } catch (error) {
      logger.error('Failed to send email:', error);
      throw error;
    }
  }

  private async sendWebhookAlert(alert: Alert, webhookUrl: string): Promise<void> {
    const payload = {
      id: alert.id,
      timestamp: alert.timestamp.toISOString(),
      severity: alert.severity,
      database: alert.database,
      type: alert.type,
      message: alert.message,
      metric: alert.metric,
      value: alert.value,
      threshold: alert.threshold,
      resolved: alert.resolved
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Webhook request failed with status ${response.status}`);
    }
  }

  public resolveAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.resolved = true;
      logger.info(`Alert ${alertId} resolved`);
      return true;
    }
    return false;
  }

  public getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter(a => !a.resolved);
  }

  public getAllAlerts(limit?: number): Alert[] {
    const allAlerts = Array.from(this.alerts.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    return limit ? allAlerts.slice(0, limit) : allAlerts;
  }

  public getAlertById(id: string): Alert | undefined {
    return this.alerts.get(id);
  }

  public clearResolvedAlerts(): number {
    let count = 0;
    for (const [id, alert] of this.alerts.entries()) {
      if (alert.resolved) {
        this.alerts.delete(id);
        count++;
      }
    }
    logger.info(`Cleared ${count} resolved alerts`);
    return count;
  }

  public getAlertStats() {
    const all = Array.from(this.alerts.values());
    return {
      total: all.length,
      active: all.filter(a => !a.resolved).length,
      resolved: all.filter(a => a.resolved).length,
      critical: all.filter(a => a.severity === 'critical' && !a.resolved).length,
      warning: all.filter(a => a.severity === 'warning' && !a.resolved).length,
      info: all.filter(a => a.severity === 'info' && !a.resolved).length
    };
  }
}
