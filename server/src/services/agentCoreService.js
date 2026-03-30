import { randomUUID, createHash } from 'crypto';
import db from '../models/database.js';

// ─── AWS SDK imports (AgentCore Control Plane + Runtime) ────────────────────

let BedrockAgentCoreControlClient, ListAgentRuntimesCommand, GetAgentRuntimeCommand,
    UpdateAgentRuntimeCommand, DeleteAgentRuntimeCommand,
    ListGatewaysCommand, GetGatewayCommand, ListGatewayTargetsCommand, GetGatewayTargetCommand;

let BedrockAgentCoreClient, InvokeAgentRuntimeCommand, GetAgentCardCommand;

try {
  const controlMod = await import('@aws-sdk/client-bedrock-agentcore-control');
  BedrockAgentCoreControlClient = controlMod.BedrockAgentCoreControlClient;
  ListAgentRuntimesCommand = controlMod.ListAgentRuntimesCommand;
  GetAgentRuntimeCommand = controlMod.GetAgentRuntimeCommand;
  UpdateAgentRuntimeCommand = controlMod.UpdateAgentRuntimeCommand;
  DeleteAgentRuntimeCommand = controlMod.DeleteAgentRuntimeCommand;
  ListGatewaysCommand = controlMod.ListGatewaysCommand;
  GetGatewayCommand = controlMod.GetGatewayCommand;
  ListGatewayTargetsCommand = controlMod.ListGatewayTargetsCommand;
  GetGatewayTargetCommand = controlMod.GetGatewayTargetCommand;
} catch {
  console.warn('AgentCore Control SDK not available — will use mock data');
}

try {
  const runtimeMod = await import('@aws-sdk/client-bedrock-agentcore');
  BedrockAgentCoreClient = runtimeMod.BedrockAgentCoreClient;
  InvokeAgentRuntimeCommand = runtimeMod.InvokeAgentRuntimeCommand;
  GetAgentCardCommand = runtimeMod.GetAgentCardCommand;
} catch {
  console.warn('AgentCore Runtime SDK not available — will use mock data');
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function deterministicId(prefix, ...parts) {
  const hash = createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 12);
  return `${prefix}-${hash}`;
}

function getCredentials(gatewayId) {
  if (!gatewayId) return null;
  const gw = db.prepare('SELECT config FROM gateways WHERE id = ?').get(gatewayId);
  if (!gw) return null;
  const config = JSON.parse(gw.config);
  if (config.accessKeyId && config.secretAccessKey) {
    return {
      region: config.region || 'us-east-1',
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    };
  }
  return null;
}

// ─── Mock Data ──────────────────────────────────────────────────────────────

const MOCK_RUNTIMES = [
  {
    agentRuntimeId: 'rt-mock-assistant-001',
    agentRuntimeArn: 'arn:aws:bedrock-agentcore:us-east-1:123456789012:runtime/rt-mock-assistant-001',
    agentRuntimeName: 'General Assistant Runtime',
    agentRuntimeVersion: '1',
    description: 'A general-purpose AI assistant runtime for handling diverse queries, document analysis, and task automation.',
    status: 'READY',
  },
  {
    agentRuntimeId: 'rt-mock-research-002',
    agentRuntimeArn: 'arn:aws:bedrock-agentcore:us-east-1:123456789012:runtime/rt-mock-research-002',
    agentRuntimeName: 'Research Agent Runtime',
    agentRuntimeVersion: '2',
    description: 'Specialized runtime for research tasks including web search, data aggregation, and citation generation.',
    status: 'READY',
  },
  {
    agentRuntimeId: 'rt-mock-devops-003',
    agentRuntimeArn: 'arn:aws:bedrock-agentcore:us-east-1:123456789012:runtime/rt-mock-devops-003',
    agentRuntimeName: 'DevOps Automation Runtime',
    agentRuntimeVersion: '1',
    description: 'Runtime for CI/CD pipeline management, infrastructure monitoring, and incident response.',
    status: 'CREATING',
  },
];

const MOCK_GATEWAYS = [
  {
    gatewayId: 'gw-mock-mcp-001',
    name: 'Production MCP Gateway',
    description: 'Primary MCP gateway for production tool access with JWT authentication.',
    status: 'READY',
    protocolType: 'MCP',
    authorizerType: 'CUSTOM_JWT',
    targets: [
      { targetId: 'tgt-001', name: 'Database Query Tool', description: 'Execute read-only SQL queries against analytics databases', status: 'READY' },
      { targetId: 'tgt-002', name: 'Email Sender Tool', description: 'Send formatted emails via corporate SMTP server', status: 'READY' },
      { targetId: 'tgt-003', name: 'Slack Notifier Tool', description: 'Post messages and notifications to Slack channels', status: 'READY' },
    ],
  },
  {
    gatewayId: 'gw-mock-mcp-002',
    name: 'Development MCP Gateway',
    description: 'Development and testing MCP gateway with open access for tool development.',
    status: 'READY',
    protocolType: 'MCP',
    authorizerType: 'NONE',
    targets: [
      { targetId: 'tgt-004', name: 'File System Tool', description: 'Read and write files in the sandboxed development environment', status: 'READY' },
      { targetId: 'tgt-005', name: 'API Tester Tool', description: 'Make HTTP requests to test API endpoints', status: 'READY' },
    ],
  },
  {
    gatewayId: 'gw-mock-mcp-003',
    name: 'Staging MCP Gateway',
    description: 'Pre-production MCP gateway with IAM authentication for staging environment tools.',
    status: 'UPDATING',
    protocolType: 'MCP',
    authorizerType: 'AWS_IAM',
    targets: [
      { targetId: 'tgt-006', name: 'Log Analyzer Tool', description: 'Search and analyze application logs from CloudWatch', status: 'SYNCHRONIZING' },
    ],
  },
];

// ─── Runtime Discovery ──────────────────────────────────────────────────────

export async function discoverRuntimes(gatewayId) {
  const creds = getCredentials(gatewayId);
  let runtimes = [];

  if (creds && BedrockAgentCoreControlClient && ListAgentRuntimesCommand) {
    try {
      const client = new BedrockAgentCoreControlClient(creds);
      const response = await client.send(new ListAgentRuntimesCommand({}));
      runtimes = response.agentRuntimes || [];
    } catch (err) {
      console.warn('AgentCore ListAgentRuntimes failed, using mock data:', err.message);
      runtimes = MOCK_RUNTIMES;
    }
  } else {
    runtimes = MOCK_RUNTIMES;
  }

  const region = creds?.region || 'us-east-1';
  return importRuntimes(gatewayId, runtimes, region);
}

function importRuntimes(gatewayId, runtimes, region) {
  const upsert = db.prepare(`
    INSERT INTO agentcore_runtimes (id, runtime_id, runtime_arn, name, description, status, version, region, gateway_id, last_synced)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name, description = excluded.description, status = excluded.status,
      version = excluded.version, runtime_arn = excluded.runtime_arn,
      last_synced = datetime('now'), updated_at = datetime('now')
  `);

  const imported = [];
  const tx = db.transaction(() => {
    for (const rt of runtimes) {
      const id = deterministicId('acrt', rt.agentRuntimeId, region);
      upsert.run(
        id, rt.agentRuntimeId, rt.agentRuntimeArn || null, rt.agentRuntimeName,
        rt.description || null, rt.status || 'UNKNOWN', rt.agentRuntimeVersion || '1',
        region, gatewayId || null
      );
      imported.push(id);
    }
  });
  tx();
  return { discovered: runtimes.length, imported: imported.map(id => getRuntime(id)) };
}

// ─── Gateway (MCP Server) Discovery ─────────────────────────────────────────

export async function discoverGateways(gatewayId) {
  const creds = getCredentials(gatewayId);
  let gateways = [];

  if (creds && BedrockAgentCoreControlClient && ListGatewaysCommand) {
    try {
      const client = new BedrockAgentCoreControlClient(creds);
      const response = await client.send(new ListGatewaysCommand({}));
      gateways = (response.items || []).map(gw => ({ ...gw, targets: [] }));

      // Fetch targets for each gateway
      for (const gw of gateways) {
        try {
          const targetsResp = await client.send(new ListGatewayTargetsCommand({ gatewayIdentifier: gw.gatewayId }));
          gw.targets = targetsResp.items || [];
        } catch {
          gw.targets = [];
        }
      }
    } catch (err) {
      console.warn('AgentCore ListGateways failed, using mock data:', err.message);
      gateways = MOCK_GATEWAYS;
    }
  } else {
    gateways = MOCK_GATEWAYS;
  }

  const region = creds?.region || 'us-east-1';
  return importGateways(gatewayId, gateways, region);
}

function importGateways(gatewayId, gateways, region) {
  const upsertGw = db.prepare(`
    INSERT INTO agentcore_gateways (id, ac_gateway_id, name, description, status, protocol_type, authorizer_type, region, gateway_id, target_count, last_synced)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name, description = excluded.description, status = excluded.status,
      protocol_type = excluded.protocol_type, authorizer_type = excluded.authorizer_type,
      target_count = excluded.target_count, last_synced = datetime('now'), updated_at = datetime('now')
  `);

  const upsertTarget = db.prepare(`
    INSERT INTO agentcore_gateway_targets (id, agentcore_gateway_id, target_id, name, description, status)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name, description = excluded.description, status = excluded.status, updated_at = datetime('now')
  `);

  const imported = [];
  const tx = db.transaction(() => {
    for (const gw of gateways) {
      const gwId = deterministicId('acgw', gw.gatewayId, region);
      upsertGw.run(
        gwId, gw.gatewayId, gw.name, gw.description || null,
        gw.status || 'UNKNOWN', gw.protocolType || 'MCP',
        gw.authorizerType || 'NONE', region, gatewayId || null,
        (gw.targets || []).length
      );

      for (const tgt of (gw.targets || [])) {
        const tgtId = deterministicId('actgt', tgt.targetId, gwId);
        upsertTarget.run(tgtId, gwId, tgt.targetId, tgt.name, tgt.description || null, tgt.status || 'UNKNOWN');
      }

      imported.push(gwId);
    }
  });
  tx();
  return { discovered: gateways.length, imported: imported.map(id => getGateway(id)) };
}

// ─── CRUD Operations ────────────────────────────────────────────────────────

export function listRuntimes() {
  const runtimes = db.prepare(`
    SELECT r.*, g.name as gateway_name, g.type as gateway_type
    FROM agentcore_runtimes r
    LEFT JOIN gateways g ON r.gateway_id = g.id
    ORDER BY r.created_at DESC
  `).all();

  return runtimes.map(rt => {
    const logCount = db.prepare('SELECT COUNT(*) as count FROM agentcore_runtime_logs WHERE runtime_id = ?').get(rt.id).count;
    const successCount = db.prepare('SELECT COUNT(*) as count FROM agentcore_runtime_logs WHERE runtime_id = ? AND success = 1').get(rt.id).count;
    return {
      ...rt,
      gateway: rt.gateway_id ? { id: rt.gateway_id, name: rt.gateway_name, type: rt.gateway_type } : null,
      logCount,
      successCount,
      successRate: logCount > 0 ? Math.round((successCount / logCount) * 100) : 0,
    };
  });
}

export function getRuntime(id) {
  const rt = db.prepare(`
    SELECT r.*, g.name as gateway_name, g.type as gateway_type
    FROM agentcore_runtimes r
    LEFT JOIN gateways g ON r.gateway_id = g.id
    WHERE r.id = ?
  `).get(id);
  if (!rt) return null;

  const logs = db.prepare('SELECT * FROM agentcore_runtime_logs WHERE runtime_id = ? ORDER BY created_at DESC LIMIT 50').all(id);
  const logCount = db.prepare('SELECT COUNT(*) as count FROM agentcore_runtime_logs WHERE runtime_id = ?').get(id).count;
  const successCount = db.prepare('SELECT COUNT(*) as count FROM agentcore_runtime_logs WHERE runtime_id = ? AND success = 1').get(id).count;

  return {
    ...rt,
    gateway: rt.gateway_id ? { id: rt.gateway_id, name: rt.gateway_name, type: rt.gateway_type } : null,
    logs,
    logCount,
    successCount,
    successRate: logCount > 0 ? Math.round((successCount / logCount) * 100) : 0,
  };
}

export function listGateways() {
  const gateways = db.prepare(`
    SELECT g.*, gw.name as local_gateway_name, gw.type as local_gateway_type
    FROM agentcore_gateways g
    LEFT JOIN gateways gw ON g.gateway_id = gw.id
    ORDER BY g.created_at DESC
  `).all();

  return gateways.map(gw => {
    const targets = db.prepare('SELECT * FROM agentcore_gateway_targets WHERE agentcore_gateway_id = ? ORDER BY name').all(gw.id);
    return {
      ...gw,
      gateway: gw.gateway_id ? { id: gw.gateway_id, name: gw.local_gateway_name, type: gw.local_gateway_type } : null,
      targets,
    };
  });
}

export function getGateway(id) {
  const gw = db.prepare(`
    SELECT g.*, gw.name as local_gateway_name, gw.type as local_gateway_type
    FROM agentcore_gateways g
    LEFT JOIN gateways gw ON g.gateway_id = gw.id
    WHERE g.id = ?
  `).get(id);
  if (!gw) return null;

  const targets = db.prepare('SELECT * FROM agentcore_gateway_targets WHERE agentcore_gateway_id = ? ORDER BY name').all(id);
  return {
    ...gw,
    gateway: gw.gateway_id ? { id: gw.gateway_id, name: gw.local_gateway_name, type: gw.local_gateway_type } : null,
    targets,
  };
}

// ─── Invoke AgentCore Runtime ───────────────────────────────────────────────

export async function invokeRuntime(id, inputText, sessionId) {
  const rt = db.prepare('SELECT * FROM agentcore_runtimes WHERE id = ?').get(id);
  if (!rt) throw new Error('Runtime not found');

  const start = Date.now();
  const sid = sessionId || randomUUID();
  let outputText = '';
  let success = true;

  const creds = getCredentials(rt.gateway_id);

  if (creds && BedrockAgentCoreClient && InvokeAgentRuntimeCommand) {
    try {
      const client = new BedrockAgentCoreClient(creds);
      const payload = JSON.stringify({ prompt: inputText });
      const response = await client.send(new InvokeAgentRuntimeCommand({
        agentRuntimeArn: rt.runtime_arn,
        payload: new TextEncoder().encode(payload),
        contentType: 'application/json',
        accept: 'application/json',
        runtimeSessionId: sid,
      }));

      if (response.response) {
        const bytes = await response.response.transformToByteArray();
        outputText = new TextDecoder().decode(bytes);
      }
    } catch (err) {
      console.warn('AgentCore InvokeAgentRuntime failed, using mock:', err.message);
      outputText = generateMockRuntimeResponse(rt.name, inputText);
    }
  } else {
    outputText = generateMockRuntimeResponse(rt.name, inputText);
  }

  const durationMs = Date.now() - start;
  const logId = randomUUID();

  db.prepare(`
    INSERT INTO agentcore_runtime_logs (id, runtime_id, session_id, input_text, output_text, success, duration_ms)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(logId, id, sid, inputText, outputText, success ? 1 : 0, durationMs);

  return { logId, sessionId: sid, inputText, outputText, success, durationMs };
}

function generateMockRuntimeResponse(runtimeName, input) {
  const lower = input.toLowerCase();
  if (runtimeName.includes('General Assistant')) {
    if (lower.includes('hello') || lower.includes('hi')) return 'Hello! I\'m the General Assistant runtime. I can help with a wide range of tasks including document analysis, question answering, task planning, and more. How can I assist you today?';
    if (lower.includes('summarize') || lower.includes('summary')) return 'I\'d be happy to help summarize content for you. Please provide the text or document you\'d like me to summarize, and I\'ll create a concise overview highlighting the key points.';
    return `I've processed your request: "${input}". As a general-purpose assistant, I can help with analysis, writing, coding, and research tasks. This is a simulated response from the AgentCore runtime.`;
  }
  if (runtimeName.includes('Research')) {
    if (lower.includes('search') || lower.includes('find')) return 'I\'ve conducted a search across multiple sources. Here are the top findings:\n\n1. **Primary Source**: Found 15 relevant results from academic databases\n2. **Web Sources**: 8 news articles from the past 30 days\n3. **Internal Docs**: 3 matching documents in the knowledge base\n\nWould you like me to dive deeper into any of these categories?';
    return `Research query received: "${input}". I've analyzed available sources and compiled preliminary findings. In a production environment, I would search across configured data sources, APIs, and knowledge bases to provide comprehensive research results.`;
  }
  if (runtimeName.includes('DevOps')) {
    if (lower.includes('deploy') || lower.includes('pipeline')) return 'Pipeline Status Report:\n\n- **Build**: Passed (2m 34s)\n- **Unit Tests**: 142/142 passed\n- **Integration Tests**: 28/28 passed\n- **Security Scan**: No vulnerabilities detected\n- **Deployment**: Ready for staging\n\nWould you like me to proceed with the staging deployment?';
    return `DevOps query received: "${input}". I can help with CI/CD pipeline management, infrastructure monitoring, log analysis, and incident response. This is a simulated response from the AgentCore DevOps runtime.`;
  }
  return `AgentCore runtime "${runtimeName}" processed your request: "${input}". This is a mock response for demonstration purposes. With real AWS credentials, this would invoke the actual AgentCore runtime.`;
}

// ─── Sync & Manage ──────────────────────────────────────────────────────────

export async function syncRuntime(id) {
  const rt = db.prepare('SELECT * FROM agentcore_runtimes WHERE id = ?').get(id);
  if (!rt) throw new Error('Runtime not found');

  const creds = getCredentials(rt.gateway_id);
  if (creds && BedrockAgentCoreControlClient && GetAgentRuntimeCommand) {
    try {
      const client = new BedrockAgentCoreControlClient(creds);
      const response = await client.send(new GetAgentRuntimeCommand({ agentRuntimeId: rt.runtime_id }));
      db.prepare(`
        UPDATE agentcore_runtimes SET status = ?, name = ?, description = ?, last_synced = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `).run(response.status || rt.status, response.agentRuntimeName || rt.name, response.description || rt.description, id);
    } catch (err) {
      console.warn('Sync failed:', err.message);
      db.prepare("UPDATE agentcore_runtimes SET last_synced = datetime('now') WHERE id = ?").run(id);
    }
  } else {
    db.prepare("UPDATE agentcore_runtimes SET last_synced = datetime('now') WHERE id = ?").run(id);
  }

  return getRuntime(id);
}

export async function syncGateway(id) {
  const gw = db.prepare('SELECT * FROM agentcore_gateways WHERE id = ?').get(id);
  if (!gw) throw new Error('Gateway not found');

  const creds = getCredentials(gw.gateway_id);
  if (creds && BedrockAgentCoreControlClient && GetGatewayCommand) {
    try {
      const client = new BedrockAgentCoreControlClient(creds);
      const response = await client.send(new GetGatewayCommand({ gatewayIdentifier: gw.ac_gateway_id }));
      db.prepare(`
        UPDATE agentcore_gateways SET status = ?, name = ?, description = ?, last_synced = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `).run(response.status || gw.status, response.name || gw.name, response.description || gw.description, id);
    } catch (err) {
      console.warn('Gateway sync failed:', err.message);
      db.prepare("UPDATE agentcore_gateways SET last_synced = datetime('now') WHERE id = ?").run(id);
    }
  } else {
    db.prepare("UPDATE agentcore_gateways SET last_synced = datetime('now') WHERE id = ?").run(id);
  }

  return getGateway(id);
}

// ─── Logs ───────────────────────────────────────────────────────────────────

export function getRuntimeLogs(runtimeId, limit = 50) {
  return db.prepare('SELECT * FROM agentcore_runtime_logs WHERE runtime_id = ? ORDER BY created_at DESC LIMIT ?').all(runtimeId, limit);
}

export function clearRuntimeLogs(runtimeId) {
  db.prepare('DELETE FROM agentcore_runtime_logs WHERE runtime_id = ?').run(runtimeId);
}

export function exportRuntimeLogs(runtimeId) {
  const rt = db.prepare('SELECT id, name, runtime_id FROM agentcore_runtimes WHERE id = ?').get(runtimeId);
  const logs = db.prepare('SELECT * FROM agentcore_runtime_logs WHERE runtime_id = ? ORDER BY created_at DESC').all(runtimeId);
  return { runtime: rt, logs, exportedAt: new Date().toISOString() };
}

// ─── Delete ─────────────────────────────────────────────────────────────────

export function deleteRuntime(id) {
  db.prepare('DELETE FROM agentcore_runtimes WHERE id = ?').run(id);
}

export function deleteGateway(id) {
  db.prepare('DELETE FROM agentcore_gateway_targets WHERE agentcore_gateway_id = ?').run(id);
  db.prepare('DELETE FROM agentcore_gateways WHERE id = ?').run(id);
}
