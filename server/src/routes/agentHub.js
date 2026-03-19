import { Router } from 'express';
import * as agentService from '../services/agentService.js';
import * as bedrockAgentService from '../services/bedrockAgentService.js';
import * as agentCoreService from '../services/agentCoreService.js';
import * as salesforceAgentService from '../services/salesforceAgentService.js';
import * as copilotAgentService from '../services/copilotAgentService.js';
import * as devinAgentService from '../services/devinAgentService.js';

const router = Router();

/**
 * GET /api/agent-hub
 * Aggregates all agent types (local, Bedrock, AgentCore, Salesforce, Copilot) into a unified view.
 */
router.get('/', (req, res) => {
  try {
    // Local agents
    const localAgents = agentService.listAgents().map(agent => ({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      type: 'local',
      provider: 'Local',
      status: agent.status || 'idle',
      model: agent.model || 'local',
      region: null,
      linkedProduct: agent.product?.name || null,
      linkedProductId: agent.product_id,
      enabled: true,
      totalCalls: agent.logCount || 0,
      successRate: agent.successRate || 0,
      avgResponseMs: agent.avgResponseMs || 0,
      lastActive: agent.lastActive || null,
      createdAt: agent.created_at,
      updatedAt: agent.updated_at,
      details: {
        systemPrompt: agent.system_prompt,
        mcpEnabled: agent.mcpServer ? true : false,
        toolCount: agent.mcpServer ? (agent.product?.mcp_enabled ? 'Available' : 'Disabled') : 'N/A',
      },
    }));

    // Bedrock agents
    const cloudAgents = bedrockAgentService.listCloudAgents().map(agent => ({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      type: 'bedrock',
      provider: 'AWS Bedrock',
      status: agent.status || 'UNKNOWN',
      model: agent.foundation_model || 'N/A',
      region: agent.region,
      linkedProduct: null,
      linkedProductId: null,
      enabled: !!agent.enabled,
      totalCalls: agent.logCount || 0,
      successRate: agent.successRate || 0,
      avgResponseMs: 0,
      lastActive: agent.updated_at,
      createdAt: agent.created_at,
      updatedAt: agent.updated_at,
      details: {
        awsAgentId: agent.aws_agent_id,
        agentArn: agent.agent_arn,
        aliasId: agent.alias_id,
        instruction: agent.instruction,
        idleSessionTtl: agent.idle_session_ttl,
        gateway: agent.gateway?.name || null,
      },
    }));

    // AgentCore runtimes
    const runtimes = agentCoreService.listRuntimes().map(rt => ({
      id: rt.id,
      name: rt.name,
      description: rt.description,
      type: 'agentcore',
      provider: 'AWS AgentCore',
      status: rt.status || 'UNKNOWN',
      model: 'AgentCore Runtime',
      region: rt.region,
      linkedProduct: null,
      linkedProductId: null,
      enabled: rt.status === 'READY',
      totalCalls: rt.logCount || 0,
      successRate: rt.successRate || 0,
      avgResponseMs: 0,
      lastActive: rt.updated_at,
      createdAt: rt.created_at,
      updatedAt: rt.updated_at,
      details: {
        runtimeId: rt.runtime_id,
        runtimeArn: rt.runtime_arn,
        version: rt.version,
        gateway: rt.gateway?.name || null,
      },
    }));

    // Salesforce agents
    const sfAgents = salesforceAgentService.listSalesforceAgents().map(agent => ({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      type: 'salesforce',
      provider: 'Salesforce',
      status: agent.status || 'Active',
      model: agent.model || 'Einstein GPT',
      region: agent.region || null,
      linkedProduct: null,
      linkedProductId: null,
      enabled: !!agent.enabled,
      totalCalls: agent.logCount || 0,
      successRate: agent.successRate || 0,
      avgResponseMs: 0,
      lastActive: agent.updated_at,
      createdAt: agent.created_at,
      updatedAt: agent.updated_at,
      details: {
        sfAgentId: agent.sf_agent_id,
        agentType: agent.agent_type,
        channel: agent.channel,
        instanceUrl: agent.instance_url,
        instruction: agent.instruction,
      },
    }));

    // Azure Copilot agents
    const azureAgents = copilotAgentService.listAzureAgents().map(agent => ({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      type: 'copilot',
      provider: 'Microsoft Copilot',
      status: agent.status || 'Active',
      model: agent.model || 'gpt-4o',
      region: agent.region || null,
      linkedProduct: null,
      linkedProductId: null,
      enabled: !!agent.enabled,
      totalCalls: agent.logCount || 0,
      successRate: agent.successRate || 0,
      avgResponseMs: 0,
      lastActive: agent.updated_at,
      createdAt: agent.created_at,
      updatedAt: agent.updated_at,
      details: {
        azureAgentId: agent.azure_agent_id,
        agentType: agent.agent_type,
        endpointUrl: agent.endpoint_url,
        tenantId: agent.tenant_id,
        resourceGroup: agent.resource_group,
        instruction: agent.instruction,
      },
    }));

    // Devin agents
    const devinSessions = devinAgentService.listSessions().map(session => ({
      id: session.id,
      name: session.title,
      description: `Session by ${session.created_by || 'unknown'} — ${session.token_usage?.toLocaleString() || 0} tokens`,
      type: 'devin',
      provider: 'Devin AI',
      status: session.status || 'finished',
      model: session.model || 'devin-1.0',
      region: null,
      linkedProduct: null,
      linkedProductId: null,
      enabled: session.status === 'running',
      totalCalls: 1,
      successRate: session.status === 'finished' ? 100 : session.status === 'blocked' ? 0 : 50,
      avgResponseMs: (session.duration_seconds || 0) * 1000,
      lastActive: session.finished_at || session.started_at,
      createdAt: session.created_at,
      updatedAt: session.updated_at,
      details: {
        devinSessionId: session.devin_session_id,
        createdBy: session.created_by,
        tokenUsage: session.token_usage,
        promptTokens: session.prompt_tokens,
        completionTokens: session.completion_tokens,
        durationSeconds: session.duration_seconds,
        sessionUrl: session.session_url,
      },
    }));

    const allAgents = [...localAgents, ...cloudAgents, ...runtimes, ...sfAgents, ...azureAgents, ...devinSessions];

    // Summary stats
    const summary = {
      total: allAgents.length,
      local: localAgents.length,
      bedrock: cloudAgents.length,
      agentcore: runtimes.length,
      salesforce: sfAgents.length,
      copilot: azureAgents.length,
      devin: devinSessions.length,
      active: allAgents.filter(a => a.enabled).length,
      inactive: allAgents.filter(a => !a.enabled).length,
      totalCalls: allAgents.reduce((sum, a) => sum + a.totalCalls, 0),
      avgSuccessRate: allAgents.length > 0
        ? Math.round(allAgents.reduce((sum, a) => sum + a.successRate, 0) / allAgents.length)
        : 0,
      providers: {
        local: localAgents.length,
        bedrock: cloudAgents.length,
        agentcore: runtimes.length,
        salesforce: sfAgents.length,
        copilot: azureAgents.length,
        devin: devinSessions.length,
      },
    };

    res.json({ agents: allAgents, summary });
  } catch (err) {
    console.error('Agent Hub error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
