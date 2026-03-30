import db from '../models/database.js';
import { v4 as uuidv4 } from 'uuid';

// ─── Discovery ──────────────────────────────────────────────────────────────

/**
 * Discover Salesforce Agentforce agents.
 * With real credentials (instance URL + OAuth token), calls Salesforce REST API.
 * Otherwise returns mock demo agents.
 */
export async function discoverAgents(instanceUrl, accessToken) {
  if (instanceUrl && accessToken) {
    try {
      // Real Salesforce API call
      const response = await fetch(
        `${instanceUrl}/services/data/v62.0/connect/ai/agents`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        console.log('Salesforce API returned error, using mock data');
        return discoverMockAgents(instanceUrl);
      }

      const data = await response.json();
      const agents = (data.agents || data.records || []).map(agent => ({
        sfAgentId: agent.id || agent.Id,
        name: agent.name || agent.Name || agent.masterLabel || 'Unnamed Agent',
        description: agent.description || agent.Description || '',
        status: agent.status || agent.Status || 'Active',
        agentType: agent.agentType || agent.botType || 'AgentForce',
        channel: agent.channel || 'API',
        model: agent.model || agent.aiModel || 'Einstein GPT',
        instruction: agent.instruction || agent.systemMessage || '',
        instanceUrl,
        region: extractRegion(instanceUrl),
      }));

      if (agents.length === 0) {
        return discoverMockAgents(instanceUrl);
      }
      return agents;
    } catch (err) {
      console.error('Salesforce agent discovery failed:', err.message);
      return discoverMockAgents(instanceUrl);
    }
  }

  return discoverMockAgents(instanceUrl || 'https://demo.salesforce.com');
}

function extractRegion(instanceUrl) {
  if (!instanceUrl) return 'US';
  if (instanceUrl.includes('.eu')) return 'EU';
  if (instanceUrl.includes('.ap')) return 'AP';
  if (instanceUrl.includes('.na')) return 'NA';
  return 'US';
}

function discoverMockAgents(instanceUrl) {
  const region = extractRegion(instanceUrl);
  return [
    {
      sfAgentId: 'SF-AGENT-001',
      name: 'Sales Coach Agent',
      description: 'Provides real-time coaching and recommendations to sales reps during customer interactions. Analyzes deal context and suggests next best actions.',
      status: 'Active',
      agentType: 'AgentForce',
      channel: 'Sales Cloud',
      model: 'Einstein GPT',
      instruction: 'You are a sales coaching assistant. Help reps close deals by analyzing customer context, suggesting talking points, and recommending next best actions based on CRM data.',
      instanceUrl: instanceUrl || 'https://demo.salesforce.com',
      region,
    },
    {
      sfAgentId: 'SF-AGENT-002',
      name: 'Service Case Agent',
      description: 'Automates case routing, resolution, and customer follow-up using knowledge articles and case history analysis.',
      status: 'Active',
      agentType: 'AgentForce',
      channel: 'Service Cloud',
      model: 'Einstein GPT',
      instruction: 'You are a customer service agent. Route cases to the right team, suggest resolutions from knowledge base, and draft customer responses.',
      instanceUrl: instanceUrl || 'https://demo.salesforce.com',
      region,
    },
    {
      sfAgentId: 'SF-AGENT-003',
      name: 'Commerce Advisor Agent',
      description: 'Provides personalized product recommendations, handles order inquiries, and assists with commerce-related customer interactions.',
      status: 'Inactive',
      agentType: 'AgentForce',
      channel: 'Commerce Cloud',
      model: 'Einstein GPT',
      instruction: 'You are a commerce advisor. Help customers find products, answer order questions, and provide personalized shopping recommendations.',
      instanceUrl: instanceUrl || 'https://demo.salesforce.com',
      region,
    },
  ];
}

// ─── CRUD Operations ────────────────────────────────────────────────────────

export function importAgents(agents) {
  const imported = [];
  const upsert = db.prepare(`
    INSERT INTO salesforce_agents (id, sf_agent_id, name, description, status, agent_type, channel, model, instruction, instance_url, region, enabled, last_synced)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name, description=excluded.description, status=excluded.status,
      agent_type=excluded.agent_type, channel=excluded.channel, model=excluded.model,
      instruction=excluded.instruction, instance_url=excluded.instance_url,
      last_synced=datetime('now'), updated_at=datetime('now')
  `);

  const txn = db.transaction((agents) => {
    for (const agent of agents) {
      const existing = db.prepare('SELECT id FROM salesforce_agents WHERE sf_agent_id = ?').get(agent.sfAgentId);
      const id = existing?.id || uuidv4();
      const enabled = agent.status === 'Active' ? 1 : 0;

      upsert.run(
        id, agent.sfAgentId, agent.name, agent.description, agent.status,
        agent.agentType, agent.channel, agent.model, agent.instruction,
        agent.instanceUrl, agent.region, enabled,
      );

      imported.push({ id, ...agent, enabled });
    }
  });

  txn(agents);
  return imported;
}

export function listSalesforceAgents() {
  const agents = db.prepare('SELECT * FROM salesforce_agents ORDER BY created_at DESC').all();
  return agents.map(agent => {
    const logCount = db.prepare('SELECT COUNT(*) as count FROM salesforce_agent_logs WHERE salesforce_agent_id = ?').get(agent.id).count;
    const successCount = db.prepare('SELECT COUNT(*) as count FROM salesforce_agent_logs WHERE salesforce_agent_id = ? AND success = 1').get(agent.id).count;
    return {
      ...agent,
      logCount,
      successCount,
      successRate: logCount > 0 ? Math.round((successCount / logCount) * 100) : 0,
    };
  });
}

export function getSalesforceAgent(id) {
  const agent = db.prepare('SELECT * FROM salesforce_agents WHERE id = ?').get(id);
  if (!agent) return null;
  const logCount = db.prepare('SELECT COUNT(*) as count FROM salesforce_agent_logs WHERE salesforce_agent_id = ?').get(agent.id).count;
  const successCount = db.prepare('SELECT COUNT(*) as count FROM salesforce_agent_logs WHERE salesforce_agent_id = ? AND success = 1').get(agent.id).count;
  const logs = db.prepare('SELECT * FROM salesforce_agent_logs WHERE salesforce_agent_id = ? ORDER BY created_at DESC LIMIT 50').all(agent.id);
  return {
    ...agent,
    logCount,
    successCount,
    successRate: logCount > 0 ? Math.round((successCount / logCount) * 100) : 0,
    logs,
  };
}

export function deleteSalesforceAgent(id) {
  db.prepare('DELETE FROM salesforce_agents WHERE id = ?').run(id);
}

// ─── Enable / Disable ───────────────────────────────────────────────────────

export async function enableAgent(id) {
  const agent = db.prepare('SELECT * FROM salesforce_agents WHERE id = ?').get(id);
  if (!agent) throw new Error('Salesforce agent not found');
  db.prepare("UPDATE salesforce_agents SET enabled = 1, status = 'Active', updated_at = datetime('now') WHERE id = ?").run(id);
  return getSalesforceAgent(id);
}

export async function disableAgent(id) {
  const agent = db.prepare('SELECT * FROM salesforce_agents WHERE id = ?').get(id);
  if (!agent) throw new Error('Salesforce agent not found');
  db.prepare("UPDATE salesforce_agents SET enabled = 0, status = 'Inactive', updated_at = datetime('now') WHERE id = ?").run(id);
  return getSalesforceAgent(id);
}

// ─── Invoke Agent ────────────────────────────────────────────────────────────

export async function invokeAgent(id, inputText, sessionId) {
  const agent = db.prepare('SELECT * FROM salesforce_agents WHERE id = ?').get(id);
  if (!agent) throw new Error('Salesforce agent not found');
  if (!agent.enabled) throw new Error('Agent is not enabled');

  const resolvedSessionId = sessionId || uuidv4();
  const start = Date.now();
  let success = 1;
  let outputText = '';

  try {
    // Mock response (real implementation would use Salesforce Einstein API)
    outputText = generateMockResponse(agent, inputText);
  } catch (err) {
    success = 0;
    outputText = `Error: ${err.message}`;
  }

  const duration = Date.now() - start;
  const logId = uuidv4();
  db.prepare(`
    INSERT INTO salesforce_agent_logs (id, salesforce_agent_id, session_id, input_text, output_text, success, duration_ms)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(logId, id, resolvedSessionId, inputText, outputText, success, duration);

  return {
    sessionId: resolvedSessionId,
    output: outputText,
    success: !!success,
    durationMs: duration,
  };
}

function generateMockResponse(agent, input) {
  const lowerInput = input.toLowerCase();
  const agentName = agent.name;

  if (agentName.includes('Sales Coach')) {
    if (lowerInput.includes('deal') || lowerInput.includes('opportunity')) {
      return 'Based on the deal analysis, I recommend focusing on the value proposition around ROI. The prospect has shown interest in cost reduction — emphasize the 30% efficiency gains our platform delivers. Next best action: Schedule a technical demo with the IT stakeholder who joined the last call.';
    }
    return 'I can help you with deal strategy, customer insights, and next best actions. Share details about the opportunity and I\'ll provide tailored coaching recommendations based on your CRM data.';
  }

  if (agentName.includes('Service Case')) {
    if (lowerInput.includes('case') || lowerInput.includes('issue') || lowerInput.includes('problem')) {
      return 'I found 3 relevant knowledge articles for this type of issue. Based on case history analysis, the most common resolution is to reset the API credentials and verify the webhook configuration. I\'ve drafted a response for the customer — would you like me to send it?';
    }
    return 'I can help route cases, suggest resolutions from the knowledge base, and draft customer responses. Describe the customer issue and I\'ll find the best resolution path.';
  }

  if (agentName.includes('Commerce Advisor')) {
    if (lowerInput.includes('product') || lowerInput.includes('recommend')) {
      return 'Based on the customer\'s browsing history and purchase patterns, I recommend the Enterprise Pro plan. Customers with similar profiles have a 78% conversion rate on this product. Would you like me to generate a personalized discount offer?';
    }
    return 'I can help with product recommendations, order inquiries, and personalized shopping experiences. What would you like to know about your commerce customers?';
  }

  return `[${agentName}] Thank you for your message. I'm processing your request through Salesforce Agentforce. Here's what I found: Your query "${input}" has been analyzed and I'm ready to assist. How would you like to proceed?`;
}

// ─── Sync ────────────────────────────────────────────────────────────────────

export async function syncAgent(id) {
  const agent = db.prepare('SELECT * FROM salesforce_agents WHERE id = ?').get(id);
  if (!agent) throw new Error('Salesforce agent not found');
  db.prepare("UPDATE salesforce_agents SET last_synced = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(id);
  return getSalesforceAgent(id);
}

// ─── Logs ────────────────────────────────────────────────────────────────────

export function getAgentLogs(id, limit = 50) {
  return db.prepare('SELECT * FROM salesforce_agent_logs WHERE salesforce_agent_id = ? ORDER BY created_at DESC LIMIT ?').all(id, limit);
}

export function clearAgentLogs(id) {
  db.prepare('DELETE FROM salesforce_agent_logs WHERE salesforce_agent_id = ?').run(id);
}

export function exportAgentLogs(id) {
  const agent = getSalesforceAgent(id);
  const logs = db.prepare('SELECT * FROM salesforce_agent_logs WHERE salesforce_agent_id = ? ORDER BY created_at DESC').all(id);
  return { agent, logs };
}
