import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', '..', 'data', 'control-plane.db');

// Ensure data directory exists
import fs from 'fs';
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent access
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS gateways (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('aws', 'kong', 'azure', 'mulesoft', 'apigee', 'tyk', 'nginx', 'custom')),
    config TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS apis (
    id TEXT PRIMARY KEY,
    gateway_id TEXT NOT NULL,
    name TEXT NOT NULL,
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    description TEXT,
    spec TEXT,
    security_score INTEGER DEFAULT 0,
    quality_score INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (gateway_id) REFERENCES gateways(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    mcp_enabled INTEGER DEFAULT 0,
    mcp_server_url TEXT,
    mcp_api_key TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS product_apis (
    product_id TEXT NOT NULL,
    api_id TEXT NOT NULL,
    added_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (product_id, api_id),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (api_id) REFERENCES apis(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS mcp_servers (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL UNIQUE,
    endpoint TEXT NOT NULL,
    api_key TEXT NOT NULL,
    status TEXT DEFAULT 'running',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    product_id TEXT,
    status TEXT DEFAULT 'idle',
    model TEXT DEFAULT 'local',
    system_prompt TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS agent_logs (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    args TEXT,
    result TEXT,
    success INTEGER DEFAULT 1,
    duration_ms INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS cloud_agents (
    id TEXT PRIMARY KEY,
    aws_agent_id TEXT NOT NULL,
    aws_agent_version TEXT DEFAULT 'DRAFT',
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'NOT_PREPARED',
    foundation_model TEXT,
    instruction TEXT,
    idle_session_ttl INTEGER DEFAULT 1800,
    agent_arn TEXT,
    alias_id TEXT,
    alias_arn TEXT,
    region TEXT NOT NULL DEFAULT 'us-east-1',
    gateway_id TEXT,
    enabled INTEGER DEFAULT 0,
    last_synced TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (gateway_id) REFERENCES gateways(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS agentcore_runtimes (
    id TEXT PRIMARY KEY,
    runtime_id TEXT NOT NULL,
    runtime_arn TEXT,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'UNKNOWN',
    version TEXT,
    region TEXT NOT NULL DEFAULT 'us-east-1',
    gateway_id TEXT,
    last_synced TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (gateway_id) REFERENCES gateways(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS agentcore_gateways (
    id TEXT PRIMARY KEY,
    ac_gateway_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'UNKNOWN',
    protocol_type TEXT DEFAULT 'MCP',
    authorizer_type TEXT DEFAULT 'NONE',
    region TEXT NOT NULL DEFAULT 'us-east-1',
    gateway_id TEXT,
    target_count INTEGER DEFAULT 0,
    last_synced TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (gateway_id) REFERENCES gateways(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS agentcore_gateway_targets (
    id TEXT PRIMARY KEY,
    agentcore_gateway_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'UNKNOWN',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (agentcore_gateway_id) REFERENCES agentcore_gateways(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS agentcore_runtime_logs (
    id TEXT PRIMARY KEY,
    runtime_id TEXT NOT NULL,
    session_id TEXT,
    input_text TEXT,
    output_text TEXT,
    success INTEGER DEFAULT 1,
    duration_ms INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (runtime_id) REFERENCES agentcore_runtimes(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS plans (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    rate_limit_per_minute INTEGER DEFAULT 0,
    rate_limit_per_hour INTEGER DEFAULT 0,
    rate_limit_per_day INTEGER DEFAULT 0,
    quota_per_month INTEGER DEFAULT 0,
    throttle_burst_limit INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL,
    application_name TEXT NOT NULL,
    api_key TEXT NOT NULL UNIQUE,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS rate_limit_logs (
    id TEXT PRIMARY KEY,
    subscription_id TEXT NOT NULL,
    window_key TEXT NOT NULL,
    request_count INTEGER DEFAULT 1,
    window_start TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_rate_limit_logs_lookup ON rate_limit_logs(subscription_id, window_key);

  CREATE TABLE IF NOT EXISTS cloud_agent_logs (
    id TEXT PRIMARY KEY,
    cloud_agent_id TEXT NOT NULL,
    session_id TEXT,
    input_text TEXT,
    output_text TEXT,
    success INTEGER DEFAULT 1,
    duration_ms INTEGER DEFAULT 0,
    trace TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (cloud_agent_id) REFERENCES cloud_agents(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS compliance_policies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    rule_type TEXT NOT NULL,
    rule_config TEXT DEFAULT '{}',
    severity TEXT DEFAULT 'medium' CHECK(severity IN ('critical', 'high', 'medium', 'low')),
    enabled INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS policy_violations (
    id TEXT PRIMARY KEY,
    policy_id TEXT NOT NULL,
    api_id TEXT NOT NULL,
    violation_details TEXT DEFAULT '{}',
    status TEXT DEFAULT 'open' CHECK(status IN ('open', 'resolved', 'dismissed')),
    resolved_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (policy_id) REFERENCES compliance_policies(id) ON DELETE CASCADE,
    FOREIGN KEY (api_id) REFERENCES apis(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS api_lifecycle (
    id TEXT PRIMARY KEY,
    api_id TEXT NOT NULL UNIQUE,
    version TEXT DEFAULT '1.0.0',
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'deprecated', 'sunset', 'retired')),
    deprecation_date TEXT,
    sunset_date TEXT,
    successor_api_id TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (api_id) REFERENCES apis(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS governance_audit_log (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    actor TEXT DEFAULT 'system',
    changes TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS data_classifications (
    id TEXT PRIMARY KEY,
    api_id TEXT NOT NULL UNIQUE,
    classification TEXT DEFAULT 'internal' CHECK(classification IN ('public', 'internal', 'confidential', 'restricted')),
    pii_flag INTEGER DEFAULT 0,
    financial_flag INTEGER DEFAULT 0,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (api_id) REFERENCES apis(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS api_standards (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'general',
    rule TEXT DEFAULT '{}',
    severity TEXT DEFAULT 'medium' CHECK(severity IN ('critical', 'high', 'medium', 'low')),
    enabled INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS salesforce_agents (
    id TEXT PRIMARY KEY,
    sf_agent_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'Active',
    agent_type TEXT DEFAULT 'AgentForce',
    channel TEXT DEFAULT 'API',
    model TEXT,
    instruction TEXT,
    instance_url TEXT,
    region TEXT,
    enabled INTEGER DEFAULT 0,
    last_synced TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS salesforce_agent_logs (
    id TEXT PRIMARY KEY,
    salesforce_agent_id TEXT NOT NULL,
    session_id TEXT,
    input_text TEXT,
    output_text TEXT,
    success INTEGER DEFAULT 1,
    duration_ms INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (salesforce_agent_id) REFERENCES salesforce_agents(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS azure_agents (
    id TEXT PRIMARY KEY,
    azure_agent_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'Active',
    agent_type TEXT DEFAULT 'CopilotAgent',
    model TEXT,
    instruction TEXT,
    endpoint_url TEXT,
    tenant_id TEXT,
    resource_group TEXT,
    region TEXT,
    enabled INTEGER DEFAULT 0,
    last_synced TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS azure_agent_logs (
    id TEXT PRIMARY KEY,
    azure_agent_id TEXT NOT NULL,
    session_id TEXT,
    input_text TEXT,
    output_text TEXT,
    success INTEGER DEFAULT 1,
    duration_ms INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (azure_agent_id) REFERENCES azure_agents(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS mcp_connections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    api_key TEXT,
    description TEXT,
    status TEXT DEFAULT 'connected',
    tool_count INTEGER DEFAULT 0,
    last_discovered TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS devin_sessions (
    id TEXT PRIMARY KEY,
    devin_session_id TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT DEFAULT 'finished',
    created_by TEXT,
    token_usage INTEGER DEFAULT 0,
    prompt_tokens INTEGER DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    model TEXT DEFAULT 'devin-1.0',
    duration_seconds INTEGER DEFAULT 0,
    session_url TEXT,
    started_at TEXT,
    finished_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS claude_invocations (
    id TEXT PRIMARY KEY,
    invocation_id TEXT NOT NULL,
    title TEXT NOT NULL,
    category TEXT DEFAULT 'Other',
    model TEXT NOT NULL,
    model_short_name TEXT,
    user_email TEXT,
    status TEXT DEFAULT 'completed',
    prompt_tokens INTEGER DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    duration_ms INTEGER DEFAULT 0,
    estimated_cost REAL DEFAULT 0,
    region TEXT DEFAULT 'us-east-1',
    started_at TEXT,
    finished_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS agent_anomalies (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    anomaly_type TEXT NOT NULL,
    severity TEXT DEFAULT 'medium' CHECK(severity IN ('critical', 'high', 'medium', 'low')),
    details TEXT DEFAULT '{}',
    metric_value REAL DEFAULT 0,
    threshold_value REAL DEFAULT 0,
    auto_action TEXT DEFAULT 'none',
    resolved INTEGER DEFAULT 0,
    resolved_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_agent_anomalies_agent ON agent_anomalies(agent_id, resolved);
  CREATE INDEX IF NOT EXISTS idx_policy_violations_lookup ON policy_violations(policy_id, status);
  CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON governance_audit_log(entity_type, entity_id);
  CREATE INDEX IF NOT EXISTS idx_audit_log_created ON governance_audit_log(created_at);
`);

// Migration: add new columns to agents table for guardrails, behavior, tool permissions, anomaly thresholds
try {
  const agentCols = db.prepare("PRAGMA table_info(agents)").all().map(c => c.name);
  if (!agentCols.includes('enabled')) {
    db.exec(`ALTER TABLE agents ADD COLUMN enabled INTEGER DEFAULT 1`);
  }
  if (!agentCols.includes('guardrails')) {
    db.exec(`ALTER TABLE agents ADD COLUMN guardrails TEXT DEFAULT '{}'`);
  }
  if (!agentCols.includes('behavior_config')) {
    db.exec(`ALTER TABLE agents ADD COLUMN behavior_config TEXT DEFAULT '{}'`);
  }
  if (!agentCols.includes('tool_permissions')) {
    db.exec(`ALTER TABLE agents ADD COLUMN tool_permissions TEXT DEFAULT '{}'`);
  }
  if (!agentCols.includes('anomaly_thresholds')) {
    db.exec(`ALTER TABLE agents ADD COLUMN anomaly_thresholds TEXT DEFAULT '{}'`);
  }
} catch (agentMigrationErr) {
  console.log('Agent columns migration note:', agentMigrationErr.message);
}

// Settings tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'viewer' CHECK(role IN ('admin', 'editor', 'viewer', 'operator')),
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'suspended')),
    avatar TEXT,
    last_login TEXT,
    mfa_enabled INTEGER DEFAULT 0,
    notification_preferences TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    key_prefix TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    user_id TEXT,
    scopes TEXT DEFAULT '["read"]',
    rate_limit INTEGER DEFAULT 1000,
    expires_at TEXT,
    last_used TEXT,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'revoked', 'expired')),
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    description TEXT,
    updated_at TEXT DEFAULT (datetime('now')),
    updated_by TEXT
  );

  CREATE TABLE IF NOT EXISTS audit_settings_log (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    user_name TEXT,
    action TEXT NOT NULL,
    category TEXT,
    details TEXT DEFAULT '{}',
    ip_address TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS webhooks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    events TEXT DEFAULT '[]',
    secret TEXT,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
    last_triggered TEXT,
    failure_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
`);

// Seed default admin user if no users exist
try {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (userCount.count === 0) {
    const { v4: uuidv4 } = await import('uuid');
    db.prepare(`INSERT INTO users (id, email, name, role, status) VALUES (?, ?, ?, ?, ?)`).run(
      uuidv4(), 'admin@gsic.local', 'System Admin', 'admin', 'active'
    );
  }
} catch (seedErr) {
  console.log('User seed note:', seedErr.message);
}

// Seed default app settings if none exist
try {
  const settingsCount = db.prepare('SELECT COUNT(*) as count FROM app_settings').get();
  if (settingsCount.count === 0) {
    const defaults = [
      ['app.name', 'GSIC API Control Plane', 'general', 'Application display name'],
      ['app.description', 'Gateway, MCP & Agent Governance', 'general', 'Application description'],
      ['app.timezone', 'UTC', 'general', 'Default timezone'],
      ['app.date_format', 'YYYY-MM-DD HH:mm:ss', 'general', 'Default date format'],
      ['app.pagination_size', '25', 'general', 'Default page size for lists'],
      ['security.session_timeout', '3600', 'security', 'Session timeout in seconds'],
      ['security.max_login_attempts', '5', 'security', 'Max failed login attempts before lockout'],
      ['security.password_min_length', '8', 'security', 'Minimum password length'],
      ['security.require_mfa', 'false', 'security', 'Require MFA for all users'],
      ['security.allowed_origins', '*', 'security', 'CORS allowed origins'],
      ['security.ip_whitelist', '', 'security', 'IP whitelist (comma-separated, empty = allow all)'],
      ['notifications.email_enabled', 'false', 'notifications', 'Enable email notifications'],
      ['notifications.smtp_host', '', 'notifications', 'SMTP server host'],
      ['notifications.smtp_port', '587', 'notifications', 'SMTP server port'],
      ['notifications.smtp_user', '', 'notifications', 'SMTP username'],
      ['notifications.webhook_enabled', 'false', 'notifications', 'Enable webhook notifications'],
      ['notifications.slack_enabled', 'false', 'notifications', 'Enable Slack notifications'],
      ['notifications.slack_webhook_url', '', 'notifications', 'Slack webhook URL'],
      ['appearance.theme', 'dark', 'appearance', 'UI theme (dark/light/system)'],
      ['appearance.sidebar_collapsed', 'false', 'appearance', 'Default sidebar state'],
      ['appearance.logo_url', '', 'appearance', 'Custom logo URL'],
      ['appearance.primary_color', '#3b82f6', 'appearance', 'Primary brand color'],
      ['data.retention_days', '90', 'data', 'Data retention period in days'],
      ['data.auto_cleanup', 'true', 'data', 'Enable automatic data cleanup'],
      ['data.backup_enabled', 'false', 'data', 'Enable automatic backups'],
      ['data.backup_interval', '24', 'data', 'Backup interval in hours'],
    ];
    const stmt = db.prepare('INSERT INTO app_settings (key, value, category, description) VALUES (?, ?, ?, ?)');
    for (const d of defaults) {
      stmt.run(...d);
    }
  }
} catch (settingsSeedErr) {
  console.log('Settings seed note:', settingsSeedErr.message);
}

// Migration: expand gateway type CHECK constraint to include new providers
try {
  const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='gateways'").get();
  if (tableInfo && tableInfo.sql && !tableInfo.sql.includes("'azure'")) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS gateways_new (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('aws', 'kong', 'azure', 'mulesoft', 'apigee', 'tyk', 'nginx', 'custom')),
        config TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
      INSERT INTO gateways_new SELECT * FROM gateways;
      DROP TABLE gateways;
      ALTER TABLE gateways_new RENAME TO gateways;
    `);
  }
} catch (migrationErr) {
  console.log('Gateway type migration note:', migrationErr.message);
}

export default db;
