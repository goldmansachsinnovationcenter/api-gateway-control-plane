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
    type TEXT NOT NULL CHECK(type IN ('aws', 'kong', 'custom')),
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

  CREATE INDEX IF NOT EXISTS idx_policy_violations_lookup ON policy_violations(policy_id, status);
  CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON governance_audit_log(entity_type, entity_id);
  CREATE INDEX IF NOT EXISTS idx_audit_log_created ON governance_audit_log(created_at);
`);

export default db;
