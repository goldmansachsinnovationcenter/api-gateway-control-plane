import db from '../models/database.js';
import { v4 as uuidv4 } from 'uuid';
import {
  BedrockAgentClient,
  ListAgentsCommand,
  GetAgentCommand,
  PrepareAgentCommand,
  CreateAgentAliasCommand,
  UpdateAgentAliasCommand,
  DeleteAgentAliasCommand,
  ListAgentAliasesCommand,
  ListAgentActionGroupsCommand,
  ListAgentKnowledgeBasesCommand,
} from '@aws-sdk/client-bedrock-agent';
import {
  BedrockAgentRuntimeClient,
  InvokeAgentCommand,
} from '@aws-sdk/client-bedrock-agent-runtime';

/**
 * Get AWS credentials from a gateway config.
 * Looks at the original gateway registration config stored in the gateway row.
 */
function getAwsCredentialsFromGateway(gatewayId) {
  const gw = db.prepare('SELECT * FROM gateways WHERE id = ?').get(gatewayId);
  if (!gw) return null;
  const config = JSON.parse(gw.config);
  return {
    region: config.region || 'us-east-1',
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
  };
}

/**
 * Build a BedrockAgentClient from explicit credentials or gateway-stored credentials.
 */
function buildClient(credentials) {
  if (!credentials || !credentials.accessKeyId || !credentials.secretAccessKey) {
    return null;
  }
  return new BedrockAgentClient({
    region: credentials.region || 'us-east-1',
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
    },
  });
}

function buildRuntimeClient(credentials) {
  if (!credentials || !credentials.accessKeyId || !credentials.secretAccessKey) {
    return null;
  }
  return new BedrockAgentRuntimeClient({
    region: credentials.region || 'us-east-1',
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
    },
  });
}

// ─── Discovery ──────────────────────────────────────────────────────────────

/**
 * Discover Bedrock agents from an AWS account.
 * If real credentials are provided, uses the AWS SDK.
 * Otherwise returns mock demo agents.
 */
export async function discoverAgents(gatewayId, credentials) {
  const creds = credentials || getAwsCredentialsFromGateway(gatewayId);
  const client = buildClient(creds);

  if (!client) {
    console.log('No valid AWS credentials for Bedrock agent discovery, using mock data');
    return discoverMockAgents(gatewayId, creds?.region || 'us-east-1');
  }

  try {
    const result = await client.send(new ListAgentsCommand({ maxResults: 50 }));
    const agentSummaries = result.agentSummaries || [];
    const discovered = [];

    for (const summary of agentSummaries) {
      // Get full agent details
      let agentDetail = null;
      try {
        const detailResult = await client.send(new GetAgentCommand({ agentId: summary.agentId }));
        agentDetail = detailResult.agent;
      } catch (err) {
        console.log(`Could not get details for agent ${summary.agentId}:`, err.message);
      }

      // Get aliases
      let aliases = [];
      try {
        const aliasResult = await client.send(new ListAgentAliasesCommand({ agentId: summary.agentId }));
        aliases = aliasResult.agentAliasSummaries || [];
      } catch (err) {
        // Ignore
      }

      const liveAlias = aliases.find(a => a.agentAliasStatus === 'PREPARED');

      // Get action groups
      let actionGroups = [];
      try {
        const agResult = await client.send(new ListAgentActionGroupsCommand({
          agentId: summary.agentId,
          agentVersion: 'DRAFT',
        }));
        actionGroups = (agResult.actionGroupSummaries || []).map(ag => ({
          name: ag.actionGroupName,
          state: ag.actionGroupState,
          description: ag.description,
        }));
      } catch (err) {
        // Ignore
      }

      // Get knowledge bases
      let knowledgeBases = [];
      try {
        const kbResult = await client.send(new ListAgentKnowledgeBasesCommand({
          agentId: summary.agentId,
          agentVersion: 'DRAFT',
        }));
        knowledgeBases = (kbResult.agentKnowledgeBaseSummaries || []).map(kb => ({
          knowledgeBaseId: kb.knowledgeBaseId,
          state: kb.knowledgeBaseState,
          description: kb.description,
        }));
      } catch (err) {
        // Ignore
      }

      discovered.push({
        awsAgentId: summary.agentId,
        name: agentDetail?.agentName || summary.agentName || summary.agentId,
        description: agentDetail?.description || summary.description || '',
        status: agentDetail?.agentStatus || summary.agentStatus || 'UNKNOWN',
        foundationModel: agentDetail?.foundationModel || '',
        instruction: agentDetail?.instruction || '',
        idleSessionTtl: agentDetail?.idleSessionTTLInSeconds || 1800,
        agentArn: agentDetail?.agentArn || '',
        aliasId: liveAlias?.agentAliasId || null,
        aliasArn: liveAlias?.agentAliasArn || null,
        region: creds.region || 'us-east-1',
        actionGroups,
        knowledgeBases,
      });
    }

    if (discovered.length === 0) {
      console.log('No Bedrock agents found in AWS account, using mock data');
      return discoverMockAgents(gatewayId, creds.region || 'us-east-1');
    }

    return discovered;
  } catch (err) {
    console.error('Bedrock agent discovery failed:', err.message);
    return discoverMockAgents(gatewayId, creds?.region || 'us-east-1');
  }
}

function discoverMockAgents(gatewayId, region) {
  return [
    {
      awsAgentId: 'MOCK-AGENT-001',
      name: 'Customer Support Agent',
      description: 'Handles customer inquiries about orders, returns, and account issues using company knowledge base.',
      status: 'PREPARED',
      foundationModel: 'anthropic.claude-3-sonnet-20240229-v1:0',
      instruction: 'You are a helpful customer support agent. Answer questions about orders, returns, and account issues. Be polite and concise.',
      idleSessionTtl: 1800,
      agentArn: `arn:aws:bedrock:${region}:123456789012:agent/MOCK-AGENT-001`,
      aliasId: 'MOCK-ALIAS-001',
      aliasArn: `arn:aws:bedrock:${region}:123456789012:agent-alias/MOCK-AGENT-001/MOCK-ALIAS-001`,
      region,
      actionGroups: [
        { name: 'OrderLookup', state: 'ENABLED', description: 'Look up order details and status' },
        { name: 'ReturnProcess', state: 'ENABLED', description: 'Process return requests' },
      ],
      knowledgeBases: [
        { knowledgeBaseId: 'KB-001', state: 'ENABLED', description: 'Product catalog and FAQ' },
      ],
    },
    {
      awsAgentId: 'MOCK-AGENT-002',
      name: 'Data Analysis Agent',
      description: 'Analyzes business metrics, generates reports, and provides insights from structured data sources.',
      status: 'PREPARED',
      foundationModel: 'anthropic.claude-3-haiku-20240307-v1:0',
      instruction: 'You are a data analysis assistant. Help users understand business metrics, create summaries, and identify trends.',
      idleSessionTtl: 3600,
      agentArn: `arn:aws:bedrock:${region}:123456789012:agent/MOCK-AGENT-002`,
      aliasId: 'MOCK-ALIAS-002',
      aliasArn: `arn:aws:bedrock:${region}:123456789012:agent-alias/MOCK-AGENT-002/MOCK-ALIAS-002`,
      region,
      actionGroups: [
        { name: 'QueryDatabase', state: 'ENABLED', description: 'Run SQL queries against analytics DB' },
        { name: 'GenerateReport', state: 'ENABLED', description: 'Generate formatted reports' },
      ],
      knowledgeBases: [],
    },
    {
      awsAgentId: 'MOCK-AGENT-003',
      name: 'Code Review Agent',
      description: 'Reviews code changes, suggests improvements, and checks for security vulnerabilities.',
      status: 'NOT_PREPARED',
      foundationModel: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
      instruction: 'You are a senior software engineer. Review code for bugs, security issues, and best practices. Provide actionable suggestions.',
      idleSessionTtl: 900,
      agentArn: `arn:aws:bedrock:${region}:123456789012:agent/MOCK-AGENT-003`,
      aliasId: null,
      aliasArn: null,
      region,
      actionGroups: [
        { name: 'CodeAnalysis', state: 'ENABLED', description: 'Analyze code quality and patterns' },
      ],
      knowledgeBases: [
        { knowledgeBaseId: 'KB-002', state: 'ENABLED', description: 'Internal coding standards' },
      ],
    },
  ];
}

// ─── CRUD Operations ────────────────────────────────────────────────────────

/**
 * Import discovered agents into local DB.
 * Upserts based on aws_agent_id + region to avoid duplicates.
 */
export function importAgents(gatewayId, agents) {
  const imported = [];
  const upsert = db.prepare(`
    INSERT INTO cloud_agents (id, aws_agent_id, aws_agent_version, name, description, status, foundation_model, instruction, idle_session_ttl, agent_arn, alias_id, alias_arn, region, gateway_id, enabled, last_synced)
    VALUES (?, ?, 'DRAFT', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name, description=excluded.description, status=excluded.status,
      foundation_model=excluded.foundation_model, instruction=excluded.instruction,
      idle_session_ttl=excluded.idle_session_ttl, agent_arn=excluded.agent_arn,
      alias_id=excluded.alias_id, alias_arn=excluded.alias_arn,
      last_synced=datetime('now'), updated_at=datetime('now')
  `);

  const txn = db.transaction((agents) => {
    for (const agent of agents) {
      // Use a deterministic ID based on aws_agent_id + region
      const existing = db.prepare('SELECT id FROM cloud_agents WHERE aws_agent_id = ? AND region = ?').get(agent.awsAgentId, agent.region);
      const id = existing?.id || uuidv4();
      const enabled = agent.status === 'PREPARED' && agent.aliasId ? 1 : 0;

      upsert.run(
        id, agent.awsAgentId, agent.name, agent.description, agent.status,
        agent.foundationModel, agent.instruction, agent.idleSessionTtl,
        agent.agentArn, agent.aliasId, agent.aliasArn, agent.region,
        gatewayId, enabled,
      );

      imported.push({ id, ...agent, enabled });
    }
  });

  txn(agents);
  return imported;
}

export function listCloudAgents() {
  const agents = db.prepare('SELECT * FROM cloud_agents ORDER BY created_at DESC').all();
  return agents.map(agent => {
    const gateway = agent.gateway_id
      ? db.prepare('SELECT id, name, type FROM gateways WHERE id = ?').get(agent.gateway_id)
      : null;
    const logCount = db.prepare('SELECT COUNT(*) as count FROM cloud_agent_logs WHERE cloud_agent_id = ?').get(agent.id).count;
    const successCount = db.prepare('SELECT COUNT(*) as count FROM cloud_agent_logs WHERE cloud_agent_id = ? AND success = 1').get(agent.id).count;
    return { ...agent, gateway, logCount, successCount, successRate: logCount > 0 ? Math.round((successCount / logCount) * 100) : 0 };
  });
}

export function getCloudAgent(id) {
  const agent = db.prepare('SELECT * FROM cloud_agents WHERE id = ?').get(id);
  if (!agent) return null;
  const gateway = agent.gateway_id
    ? db.prepare('SELECT id, name, type FROM gateways WHERE id = ?').get(agent.gateway_id)
    : null;
  const logCount = db.prepare('SELECT COUNT(*) as count FROM cloud_agent_logs WHERE cloud_agent_id = ?').get(agent.id).count;
  const successCount = db.prepare('SELECT COUNT(*) as count FROM cloud_agent_logs WHERE cloud_agent_id = ? AND success = 1').get(agent.id).count;
  const logs = db.prepare('SELECT * FROM cloud_agent_logs WHERE cloud_agent_id = ? ORDER BY created_at DESC LIMIT 50').all(agent.id);
  return {
    ...agent,
    gateway,
    logCount,
    successCount,
    successRate: logCount > 0 ? Math.round((successCount / logCount) * 100) : 0,
    logs,
  };
}

export function deleteCloudAgent(id) {
  db.prepare('DELETE FROM cloud_agents WHERE id = ?').run(id);
}

// ─── Enable / Disable ───────────────────────────────────────────────────────

/**
 * Enable a Bedrock agent by preparing it and creating/updating an alias.
 * With real AWS credentials this calls PrepareAgent + CreateAgentAlias.
 * Without credentials it simulates the state change locally.
 */
export async function enableAgent(id, credentials) {
  const agent = db.prepare('SELECT * FROM cloud_agents WHERE id = ?').get(id);
  if (!agent) throw new Error('Cloud agent not found');

  const creds = credentials || getAwsCredentialsFromGateway(agent.gateway_id);
  const client = buildClient(creds);

  if (client && !agent.aws_agent_id.startsWith('MOCK-')) {
    try {
      // Prepare the agent
      await client.send(new PrepareAgentCommand({ agentId: agent.aws_agent_id }));

      // Wait briefly for preparation
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check if alias exists, create or update
      let aliasId = agent.alias_id;
      let aliasArn = agent.alias_arn;

      if (aliasId) {
        // Update existing alias to point to latest version
        const result = await client.send(new UpdateAgentAliasCommand({
          agentId: agent.aws_agent_id,
          agentAliasId: aliasId,
          agentAliasName: 'live',
        }));
        aliasArn = result.agentAlias?.agentAliasArn || aliasArn;
      } else {
        // Create a new alias
        const result = await client.send(new CreateAgentAliasCommand({
          agentId: agent.aws_agent_id,
          agentAliasName: 'live',
        }));
        aliasId = result.agentAlias?.agentAliasId;
        aliasArn = result.agentAlias?.agentAliasArn;
      }

      db.prepare(`
        UPDATE cloud_agents SET enabled = 1, status = 'PREPARED', alias_id = ?, alias_arn = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(aliasId, aliasArn, id);
    } catch (err) {
      console.error('Failed to enable agent on AWS:', err.message);
      // Still update locally
      db.prepare("UPDATE cloud_agents SET enabled = 1, status = 'PREPARED', updated_at = datetime('now') WHERE id = ?").run(id);
    }
  } else {
    // Mock mode: just update local state
    const mockAliasId = agent.alias_id || `ALIAS-${uuidv4().substring(0, 8).toUpperCase()}`;
    const mockAliasArn = agent.alias_arn || `arn:aws:bedrock:${agent.region}:123456789012:agent-alias/${agent.aws_agent_id}/${mockAliasId}`;
    db.prepare(`
      UPDATE cloud_agents SET enabled = 1, status = 'PREPARED', alias_id = ?, alias_arn = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(mockAliasId, mockAliasArn, id);
  }

  return getCloudAgent(id);
}

/**
 * Disable a Bedrock agent by deleting its alias (if real) or toggling local state.
 */
export async function disableAgent(id, credentials) {
  const agent = db.prepare('SELECT * FROM cloud_agents WHERE id = ?').get(id);
  if (!agent) throw new Error('Cloud agent not found');

  const creds = credentials || getAwsCredentialsFromGateway(agent.gateway_id);
  const client = buildClient(creds);

  if (client && !agent.aws_agent_id.startsWith('MOCK-') && agent.alias_id) {
    try {
      await client.send(new DeleteAgentAliasCommand({
        agentId: agent.aws_agent_id,
        agentAliasId: agent.alias_id,
      }));
      db.prepare(`
        UPDATE cloud_agents SET enabled = 0, alias_id = NULL, alias_arn = NULL, updated_at = datetime('now')
        WHERE id = ?
      `).run(id);
    } catch (err) {
      console.error('Failed to disable agent on AWS:', err.message);
      db.prepare("UPDATE cloud_agents SET enabled = 0, updated_at = datetime('now') WHERE id = ?").run(id);
    }
  } else {
    // Mock mode
    db.prepare("UPDATE cloud_agents SET enabled = 0, updated_at = datetime('now') WHERE id = ?").run(id);
  }

  return getCloudAgent(id);
}

// ─── Invoke Agent ────────────────────────────────────────────────────────────

/**
 * Invoke a Bedrock agent with a prompt.
 * With real credentials uses InvokeAgent API.
 * Without credentials returns a mock response.
 */
export async function invokeAgent(id, inputText, sessionId, credentials) {
  const agent = db.prepare('SELECT * FROM cloud_agents WHERE id = ?').get(id);
  if (!agent) throw new Error('Cloud agent not found');
  if (!agent.enabled) throw new Error('Agent is not enabled');

  const resolvedSessionId = sessionId || uuidv4();
  const start = Date.now();
  let success = 1;
  let outputText = '';
  let trace = null;

  const creds = credentials || getAwsCredentialsFromGateway(agent.gateway_id);
  const runtimeClient = buildRuntimeClient(creds);

  if (runtimeClient && !agent.aws_agent_id.startsWith('MOCK-') && agent.alias_id) {
    try {
      const response = await runtimeClient.send(new InvokeAgentCommand({
        agentId: agent.aws_agent_id,
        agentAliasId: agent.alias_id,
        sessionId: resolvedSessionId,
        inputText,
      }));

      // Process streamed response
      if (response.completion) {
        const chunks = [];
        for await (const event of response.completion) {
          if (event.chunk?.bytes) {
            chunks.push(new TextDecoder().decode(event.chunk.bytes));
          }
        }
        outputText = chunks.join('');
      }
    } catch (err) {
      success = 0;
      outputText = `Error: ${err.message}`;
    }
  } else {
    // Mock invocation
    outputText = generateMockResponse(agent, inputText);
  }

  const durationMs = Date.now() - start;

  // Log the invocation
  const logId = uuidv4();
  db.prepare(
    'INSERT INTO cloud_agent_logs (id, cloud_agent_id, session_id, input_text, output_text, success, duration_ms, trace) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(logId, id, resolvedSessionId, inputText, outputText, success, durationMs, trace ? JSON.stringify(trace) : null);

  return {
    logId,
    sessionId: resolvedSessionId,
    inputText,
    outputText,
    success: !!success,
    durationMs,
  };
}

function generateMockResponse(agent, inputText) {
  const lowerInput = inputText.toLowerCase();

  if (agent.aws_agent_id === 'MOCK-AGENT-001') {
    if (lowerInput.includes('order')) {
      return 'I found your order #12345. It was placed on March 15, 2026 and is currently in transit. Expected delivery is March 22, 2026. The order contains 2 items totaling $89.99. Would you like to know more details?';
    }
    if (lowerInput.includes('return')) {
      return 'I can help you with a return. To process your return, I will need your order number and the reason for the return. Our return policy allows returns within 30 days of delivery for a full refund. Would you like to proceed?';
    }
    return 'Hello! I am the Customer Support Agent. I can help you with order inquiries, returns, and account issues. How can I assist you today?';
  }

  if (agent.aws_agent_id === 'MOCK-AGENT-002') {
    if (lowerInput.includes('revenue') || lowerInput.includes('sales')) {
      return 'Based on the latest data, Q1 2026 revenue is $2.4M, up 15% from Q4 2025. Key growth drivers: Enterprise segment (+22%), API Platform subscriptions (+18%). The top-performing product line is the API Gateway tier, contributing 45% of total revenue.';
    }
    if (lowerInput.includes('report')) {
      return 'I have generated the monthly performance report. Key highlights:\n- Active users: 12,500 (+8% MoM)\n- API calls processed: 45M (+12% MoM)\n- Average response time: 120ms (-5% improvement)\n- Error rate: 0.02% (within SLA)\nWould you like me to export this as a PDF?';
    }
    return 'Hello! I am the Data Analysis Agent. I can help you analyze business metrics, generate reports, and identify trends. What data would you like to explore?';
  }

  if (agent.aws_agent_id === 'MOCK-AGENT-003') {
    return 'I am the Code Review Agent. I can analyze code for bugs, security vulnerabilities, and best practices. Please share the code or PR you would like me to review. Note: I am currently in DRAFT mode and need to be prepared before full functionality is available.';
  }

  return `I received your message: "${inputText}". This is a simulated response from the Bedrock agent "${agent.name}". In production, this would be processed by the ${agent.foundation_model} model on AWS Bedrock.`;
}

// ─── Sync / Refresh ──────────────────────────────────────────────────────────

/**
 * Re-sync a single agent's status from AWS.
 */
export async function syncAgent(id, credentials) {
  const agent = db.prepare('SELECT * FROM cloud_agents WHERE id = ?').get(id);
  if (!agent) throw new Error('Cloud agent not found');

  const creds = credentials || getAwsCredentialsFromGateway(agent.gateway_id);
  const client = buildClient(creds);

  if (client && !agent.aws_agent_id.startsWith('MOCK-')) {
    try {
      const result = await client.send(new GetAgentCommand({ agentId: agent.aws_agent_id }));
      const detail = result.agent;

      // Check aliases
      let aliasId = null;
      let aliasArn = null;
      try {
        const aliasResult = await client.send(new ListAgentAliasesCommand({ agentId: agent.aws_agent_id }));
        const liveAlias = (aliasResult.agentAliasSummaries || []).find(a => a.agentAliasStatus === 'PREPARED');
        aliasId = liveAlias?.agentAliasId || null;
        aliasArn = liveAlias?.agentAliasArn || null;
      } catch (err) {
        // Ignore
      }

      db.prepare(`
        UPDATE cloud_agents SET
          name = ?, description = ?, status = ?, foundation_model = ?,
          instruction = ?, agent_arn = ?, alias_id = ?, alias_arn = ?,
          enabled = ?, last_synced = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `).run(
        detail.agentName, detail.description || '', detail.agentStatus,
        detail.foundationModel, detail.instruction || '', detail.agentArn,
        aliasId, aliasArn, (detail.agentStatus === 'PREPARED' && aliasId) ? 1 : 0, id,
      );
    } catch (err) {
      console.error('Failed to sync agent:', err.message);
    }
  }

  // Update last_synced even in mock mode
  db.prepare("UPDATE cloud_agents SET last_synced = datetime('now') WHERE id = ?").run(id);
  return getCloudAgent(id);
}

// ─── Logs ────────────────────────────────────────────────────────────────────

export function getCloudAgentLogs(id, limit = 50) {
  return db.prepare('SELECT * FROM cloud_agent_logs WHERE cloud_agent_id = ? ORDER BY created_at DESC LIMIT ?').all(id, limit);
}

export function clearCloudAgentLogs(id) {
  db.prepare('DELETE FROM cloud_agent_logs WHERE cloud_agent_id = ?').run(id);
}

export function exportCloudAgentLogs(id) {
  const agent = db.prepare('SELECT * FROM cloud_agents WHERE id = ?').get(id);
  if (!agent) throw new Error('Cloud agent not found');
  const logs = db.prepare('SELECT * FROM cloud_agent_logs WHERE cloud_agent_id = ? ORDER BY created_at DESC').all(id);
  return { agent: { id: agent.id, name: agent.name, awsAgentId: agent.aws_agent_id }, logs, exportedAt: new Date().toISOString() };
}
