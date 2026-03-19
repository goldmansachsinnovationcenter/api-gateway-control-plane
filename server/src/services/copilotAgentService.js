import db from '../models/database.js';
import { v4 as uuidv4 } from 'uuid';

// ─── Discovery ──────────────────────────────────────────────────────────────

/**
 * Discover Microsoft Copilot / Azure AI agents.
 * With real credentials (endpoint + Azure AD token), calls Azure AI Agent Service API.
 * Otherwise returns mock demo agents.
 */
export async function discoverAgents(endpointUrl, accessToken, tenantId) {
  if (endpointUrl && accessToken) {
    try {
      const response = await fetch(
        `${endpointUrl}/agents?api-version=2025-05-01`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        console.log('Azure AI API returned error, using mock data');
        return discoverMockAgents(endpointUrl, tenantId);
      }

      const data = await response.json();
      const agents = (data.value || data.data || []).map(agent => ({
        azureAgentId: agent.id,
        name: agent.name || agent.displayName || 'Unnamed Agent',
        description: agent.description || '',
        status: agent.status || 'Active',
        agentType: agent.agentType || 'CopilotAgent',
        model: agent.model || agent.deploymentName || 'gpt-4o',
        instruction: agent.instructions || agent.systemMessage || '',
        endpointUrl,
        tenantId: tenantId || '',
        resourceGroup: agent.resourceGroup || '',
        region: extractRegion(endpointUrl),
      }));

      if (agents.length === 0) {
        return discoverMockAgents(endpointUrl, tenantId);
      }
      return agents;
    } catch (err) {
      console.error('Azure agent discovery failed:', err.message);
      return discoverMockAgents(endpointUrl, tenantId);
    }
  }

  return discoverMockAgents(
    endpointUrl || 'https://demo.services.ai.azure.com',
    tenantId || 'demo-tenant-id'
  );
}

function extractRegion(endpointUrl) {
  if (!endpointUrl) return 'eastus';
  const match = endpointUrl.match(/(eastus|westus|westeurope|northeurope|eastasia|southeastasia|centralus|westus2)/i);
  return match ? match[1].toLowerCase() : 'eastus';
}

function discoverMockAgents(endpointUrl, tenantId) {
  const region = extractRegion(endpointUrl);
  return [
    {
      azureAgentId: 'COPILOT-AGENT-001',
      name: 'IT Helpdesk Copilot',
      description: 'Assists employees with IT support requests, password resets, software installations, and troubleshooting common technical issues using organizational knowledge.',
      status: 'Active',
      agentType: 'CopilotAgent',
      model: 'gpt-4o',
      instruction: 'You are an IT helpdesk assistant for the organization. Help employees with technical issues, guide them through troubleshooting steps, and escalate complex issues to the IT team.',
      endpointUrl: endpointUrl || 'https://demo.services.ai.azure.com',
      tenantId: tenantId || 'demo-tenant-id',
      resourceGroup: 'rg-ai-agents',
      region,
    },
    {
      azureAgentId: 'COPILOT-AGENT-002',
      name: 'HR Policy Copilot',
      description: 'Answers employee questions about company policies, benefits, leave management, and HR processes using the company handbook and policy documents.',
      status: 'Active',
      agentType: 'CopilotAgent',
      model: 'gpt-4o-mini',
      instruction: 'You are an HR policy assistant. Answer questions about company policies, benefits, leave procedures, and HR processes. Always reference the relevant policy document and section.',
      endpointUrl: endpointUrl || 'https://demo.services.ai.azure.com',
      tenantId: tenantId || 'demo-tenant-id',
      resourceGroup: 'rg-ai-agents',
      region,
    },
    {
      azureAgentId: 'COPILOT-AGENT-003',
      name: 'Document Analysis Copilot',
      description: 'Analyzes documents, extracts key information, generates summaries, and answers questions about uploaded files using Azure AI Document Intelligence.',
      status: 'Inactive',
      agentType: 'CopilotAgent',
      model: 'gpt-4o',
      instruction: 'You are a document analysis assistant. Analyze uploaded documents, extract key data points, summarize content, and answer specific questions about the document contents.',
      endpointUrl: endpointUrl || 'https://demo.services.ai.azure.com',
      tenantId: tenantId || 'demo-tenant-id',
      resourceGroup: 'rg-ai-agents',
      region,
    },
  ];
}

// ─── CRUD Operations ────────────────────────────────────────────────────────

export function importAgents(agents) {
  const imported = [];
  const upsert = db.prepare(`
    INSERT INTO azure_agents (id, azure_agent_id, name, description, status, agent_type, model, instruction, endpoint_url, tenant_id, resource_group, region, enabled, last_synced)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name, description=excluded.description, status=excluded.status,
      agent_type=excluded.agent_type, model=excluded.model, instruction=excluded.instruction,
      endpoint_url=excluded.endpoint_url, tenant_id=excluded.tenant_id,
      resource_group=excluded.resource_group,
      last_synced=datetime('now'), updated_at=datetime('now')
  `);

  const txn = db.transaction((agents) => {
    for (const agent of agents) {
      const existing = db.prepare('SELECT id FROM azure_agents WHERE azure_agent_id = ?').get(agent.azureAgentId);
      const id = existing?.id || uuidv4();
      const enabled = agent.status === 'Active' ? 1 : 0;

      upsert.run(
        id, agent.azureAgentId, agent.name, agent.description, agent.status,
        agent.agentType, agent.model, agent.instruction, agent.endpointUrl,
        agent.tenantId, agent.resourceGroup, agent.region, enabled,
      );

      imported.push({ id, ...agent, enabled });
    }
  });

  txn(agents);
  return imported;
}

export function listAzureAgents() {
  const agents = db.prepare('SELECT * FROM azure_agents ORDER BY created_at DESC').all();
  return agents.map(agent => {
    const logCount = db.prepare('SELECT COUNT(*) as count FROM azure_agent_logs WHERE azure_agent_id = ?').get(agent.id).count;
    const successCount = db.prepare('SELECT COUNT(*) as count FROM azure_agent_logs WHERE azure_agent_id = ? AND success = 1').get(agent.id).count;
    return {
      ...agent,
      logCount,
      successCount,
      successRate: logCount > 0 ? Math.round((successCount / logCount) * 100) : 0,
    };
  });
}

export function getAzureAgent(id) {
  const agent = db.prepare('SELECT * FROM azure_agents WHERE id = ?').get(id);
  if (!agent) return null;
  const logCount = db.prepare('SELECT COUNT(*) as count FROM azure_agent_logs WHERE azure_agent_id = ?').get(agent.id).count;
  const successCount = db.prepare('SELECT COUNT(*) as count FROM azure_agent_logs WHERE azure_agent_id = ? AND success = 1').get(agent.id).count;
  const logs = db.prepare('SELECT * FROM azure_agent_logs WHERE azure_agent_id = ? ORDER BY created_at DESC LIMIT 50').all(agent.id);
  return {
    ...agent,
    logCount,
    successCount,
    successRate: logCount > 0 ? Math.round((successCount / logCount) * 100) : 0,
    logs,
  };
}

export function deleteAzureAgent(id) {
  db.prepare('DELETE FROM azure_agents WHERE id = ?').run(id);
}

// ─── Enable / Disable ───────────────────────────────────────────────────────

export async function enableAgent(id) {
  const agent = db.prepare('SELECT * FROM azure_agents WHERE id = ?').get(id);
  if (!agent) throw new Error('Azure agent not found');
  db.prepare("UPDATE azure_agents SET enabled = 1, status = 'Active', updated_at = datetime('now') WHERE id = ?").run(id);
  return getAzureAgent(id);
}

export async function disableAgent(id) {
  const agent = db.prepare('SELECT * FROM azure_agents WHERE id = ?').get(id);
  if (!agent) throw new Error('Azure agent not found');
  db.prepare("UPDATE azure_agents SET enabled = 0, status = 'Inactive', updated_at = datetime('now') WHERE id = ?").run(id);
  return getAzureAgent(id);
}

// ─── Invoke Agent ────────────────────────────────────────────────────────────

export async function invokeAgent(id, inputText, sessionId) {
  const agent = db.prepare('SELECT * FROM azure_agents WHERE id = ?').get(id);
  if (!agent) throw new Error('Azure agent not found');
  if (!agent.enabled) throw new Error('Agent is not enabled');

  const resolvedSessionId = sessionId || uuidv4();
  const start = Date.now();
  let success = 1;
  let outputText = '';

  try {
    // Mock response (real implementation would use Azure AI Agent Service API)
    outputText = generateMockResponse(agent, inputText);
  } catch (err) {
    success = 0;
    outputText = `Error: ${err.message}`;
  }

  const duration = Date.now() - start;
  const logId = uuidv4();
  db.prepare(`
    INSERT INTO azure_agent_logs (id, azure_agent_id, session_id, input_text, output_text, success, duration_ms)
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

  if (agentName.includes('IT Helpdesk')) {
    if (lowerInput.includes('password') || lowerInput.includes('reset')) {
      return 'I can help you with the password reset. Please follow these steps:\n1. Go to https://passwordreset.microsoftonline.com\n2. Enter your work email address\n3. Complete the MFA verification\n4. Set your new password (min 12 characters, must include uppercase, number, and special character)\n\nIf you\'re locked out completely, I\'ll escalate this to the IT admin team for immediate action.';
    }
    if (lowerInput.includes('install') || lowerInput.includes('software')) {
      return 'For software installation requests:\n1. Check the Company Portal app for approved software\n2. If the software isn\'t listed, submit a request via the IT Service Desk portal\n3. Standard software is auto-approved; specialized tools require manager approval (typically 1-2 business days)\n\nWhich software are you looking to install?';
    }
    return 'I\'m your IT Helpdesk Copilot. I can help with:\n• Password resets and account access\n• Software installation requests\n• VPN and network connectivity\n• Hardware issues and replacements\n• Email and Teams configuration\n\nWhat issue are you experiencing?';
  }

  if (agentName.includes('HR Policy')) {
    if (lowerInput.includes('leave') || lowerInput.includes('vacation') || lowerInput.includes('pto')) {
      return 'Per the Employee Handbook (Section 4.2 - Leave Policy):\n• Annual PTO: 20 days for 0-5 years tenure, 25 days for 5+ years\n• Sick leave: 10 days per year (no rollover)\n• Personal days: 3 days per year\n• To request leave: Submit via Workday → Time Off → Request Time Off\n• Approval required from direct manager for leaves > 3 consecutive days\n\nWould you like to know about any specific type of leave?';
    }
    return 'I\'m your HR Policy Copilot. I can answer questions about:\n• Leave and PTO policies\n• Benefits and insurance\n• Performance reviews\n• Compensation and payroll\n• Remote work policies\n• Company events and perks\n\nWhat would you like to know?';
  }

  if (agentName.includes('Document Analysis')) {
    if (lowerInput.includes('summary') || lowerInput.includes('summarize')) {
      return 'I can analyze and summarize documents for you. To get started:\n1. Upload your document (supported formats: PDF, DOCX, XLSX, PPTX, images)\n2. I\'ll extract the key information using Azure AI Document Intelligence\n3. You\'ll receive a structured summary with key findings\n\nFor this demo, I\'ve analyzed a sample contract and found:\n• Contract value: $2.4M over 3 years\n• Key terms: Auto-renewal, 90-day termination notice\n• Risk areas: 2 clauses flagged for legal review\n\nWould you like more details on any section?';
    }
    return 'I\'m your Document Analysis Copilot. I can:\n• Summarize documents and extract key information\n• Answer questions about document contents\n• Compare multiple documents\n• Extract tables and structured data\n• Identify key clauses in contracts\n\nUpload a document or ask about a previously analyzed file.';
  }

  return `[${agentName}] I've processed your request through Microsoft Copilot. Here's my analysis of "${input}": Based on the available data and organizational context, I recommend reviewing the relevant documentation and following up with the appropriate team. How can I assist further?`;
}

// ─── Sync ────────────────────────────────────────────────────────────────────

export async function syncAgent(id) {
  const agent = db.prepare('SELECT * FROM azure_agents WHERE id = ?').get(id);
  if (!agent) throw new Error('Azure agent not found');
  db.prepare("UPDATE azure_agents SET last_synced = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(id);
  return getAzureAgent(id);
}

// ─── Logs ────────────────────────────────────────────────────────────────────

export function getAgentLogs(id, limit = 50) {
  return db.prepare('SELECT * FROM azure_agent_logs WHERE azure_agent_id = ? ORDER BY created_at DESC LIMIT ?').all(id, limit);
}

export function clearAgentLogs(id) {
  db.prepare('DELETE FROM azure_agent_logs WHERE azure_agent_id = ?').run(id);
}

export function exportAgentLogs(id) {
  const agent = getAzureAgent(id);
  const logs = db.prepare('SELECT * FROM azure_agent_logs WHERE azure_agent_id = ? ORDER BY created_at DESC').all(id);
  return { agent, logs };
}
