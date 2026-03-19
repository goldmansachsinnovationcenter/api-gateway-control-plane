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
`);

export default db;
