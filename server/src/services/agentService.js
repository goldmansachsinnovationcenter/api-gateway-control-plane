import db from '../models/database.js';
import { v4 as uuidv4 } from 'uuid';
import * as mcpService from './mcpService.js';

export function createAgent(name, description, productId, model, systemPrompt) {
  const id = uuidv4();
  db.prepare(
    'INSERT INTO agents (id, name, description, product_id, model, system_prompt) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, name, description || '', productId || null, model || 'local', systemPrompt || '');
  return getAgent(id);
}

function getAgentStats(agentId) {
  const logCount = db.prepare('SELECT COUNT(*) as count FROM agent_logs WHERE agent_id = ?').get(agentId).count;
  const successCount = db.prepare('SELECT COUNT(*) as count FROM agent_logs WHERE agent_id = ? AND success = 1').get(agentId).count;
  const avgDuration = db.prepare('SELECT AVG(duration_ms) as avg FROM agent_logs WHERE agent_id = ?').get(agentId).avg;
  const lastExec = db.prepare('SELECT created_at FROM agent_logs WHERE agent_id = ? ORDER BY created_at DESC LIMIT 1').get(agentId);
  return {
    logCount,
    successCount,
    successRate: logCount > 0 ? Math.round((successCount / logCount) * 100) : 0,
    avgResponseMs: avgDuration ? Math.round(avgDuration) : 0,
    lastActive: lastExec?.created_at || null,
  };
}

export function listAgents() {
  const agents = db.prepare('SELECT * FROM agents ORDER BY created_at DESC').all();
  return agents.map(agent => {
    const product = agent.product_id
      ? db.prepare('SELECT id, name, mcp_enabled FROM products WHERE id = ?').get(agent.product_id)
      : null;
    const stats = getAgentStats(agent.id);
    const mcpServer = agent.product_id
      ? db.prepare('SELECT * FROM mcp_servers WHERE product_id = ?').get(agent.product_id)
      : null;
    return { ...agent, product, ...stats, mcpServer };
  });
}

export function getAgent(id) {
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(id);
  if (!agent) return null;
  const product = agent.product_id
    ? db.prepare('SELECT id, name, mcp_enabled FROM products WHERE id = ?').get(agent.product_id)
    : null;
  const mcpServer = agent.product_id
    ? db.prepare('SELECT * FROM mcp_servers WHERE product_id = ?').get(agent.product_id)
    : null;
  const stats = getAgentStats(id);
  return { ...agent, product, mcpServer, ...stats };
}

export function updateAgent(id, updates) {
  const fields = [];
  const values = [];
  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
  if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description); }
  if (updates.product_id !== undefined) { fields.push('product_id = ?'); values.push(updates.product_id); }
  if (updates.model !== undefined) { fields.push('model = ?'); values.push(updates.model); }
  if (updates.system_prompt !== undefined) { fields.push('system_prompt = ?'); values.push(updates.system_prompt); }
  if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }

  if (fields.length === 0) return getAgent(id);

  fields.push("updated_at = datetime('now')");
  values.push(id);
  db.prepare(`UPDATE agents SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getAgent(id);
}

export function deleteAgent(id) {
  db.prepare('DELETE FROM agents WHERE id = ?').run(id);
}

export function getAgentLogs(agentId, limit = 50) {
  return db.prepare(
    'SELECT * FROM agent_logs WHERE agent_id = ? ORDER BY created_at DESC LIMIT ?'
  ).all(agentId, limit);
}

export function executeAgentTool(agentId, toolName, args) {
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId);
  if (!agent) throw new Error('Agent not found');
  if (!agent.product_id) throw new Error('Agent has no linked product');

  // Update agent status
  db.prepare("UPDATE agents SET status = 'running', updated_at = datetime('now') WHERE id = ?").run(agentId);

  const start = Date.now();
  let success = 1;
  let result;

  try {
    const tools = mcpService.generateToolsForProduct(agent.product_id);
    const tool = tools.find(t => t.name === toolName);
    if (!tool) throw new Error(`Tool '${toolName}' not found`);

    result = mcpService.executeToolCall(tool, args || {});
  } catch (err) {
    success = 0;
    result = { error: err.message };
  }

  const durationMs = Date.now() - start;

  // Log the execution
  const logId = uuidv4();
  db.prepare(
    'INSERT INTO agent_logs (id, agent_id, tool_name, args, result, success, duration_ms) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(logId, agentId, toolName, JSON.stringify(args || {}), JSON.stringify(result), success, durationMs);

  // Reset agent status
  db.prepare("UPDATE agents SET status = 'idle', updated_at = datetime('now') WHERE id = ?").run(agentId);

  return {
    logId,
    tool: toolName,
    args,
    result,
    success: !!success,
    durationMs,
  };
}

export function runAgentAllTools(agentId) {
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId);
  if (!agent) throw new Error('Agent not found');
  if (!agent.product_id) throw new Error('Agent has no linked product');

  const tools = mcpService.generateToolsForProduct(agent.product_id);
  const results = [];

  db.prepare("UPDATE agents SET status = 'running', updated_at = datetime('now') WHERE id = ?").run(agentId);

  for (const tool of tools) {
    const sampleArgs = buildSampleArgs(tool.inputSchema);
    const start = Date.now();
    let success = 1;
    let result;

    try {
      result = mcpService.executeToolCall(tool, sampleArgs);
    } catch (err) {
      success = 0;
      result = { error: err.message };
    }

    const durationMs = Date.now() - start;
    const logId = uuidv4();
    db.prepare(
      'INSERT INTO agent_logs (id, agent_id, tool_name, args, result, success, duration_ms) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(logId, agentId, tool.name, JSON.stringify(sampleArgs), JSON.stringify(result), success, durationMs);

    results.push({ logId, tool: tool.name, args: sampleArgs, result, success: !!success, durationMs });
  }

  db.prepare("UPDATE agents SET status = 'idle', updated_at = datetime('now') WHERE id = ?").run(agentId);

  return results;
}

function buildSampleArgs(schema) {
  const args = {};
  if (!schema?.properties) return args;
  for (const [name, prop] of Object.entries(schema.properties)) {
    const isRequired = schema.required?.includes(name);
    if (!isRequired) continue;
    if (prop.enum) {
      args[name] = prop.enum[0];
    } else if (prop.type === 'string') {
      args[name] = prop.format === 'email' ? 'demo@example.com' : `sample-${name}`;
    } else if (prop.type === 'integer' || prop.type === 'number') {
      args[name] = prop.minimum || 1;
    } else if (prop.type === 'boolean') {
      args[name] = true;
    } else {
      args[name] = `sample-${name}`;
    }
  }
  return args;
}

export function clearAgentLogs(agentId) {
  db.prepare('DELETE FROM agent_logs WHERE agent_id = ?').run(agentId);
}

export function cloneAgent(id) {
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(id);
  if (!agent) throw new Error('Agent not found');
  const newId = uuidv4();
  db.prepare(
    'INSERT INTO agents (id, name, description, product_id, model, system_prompt) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(newId, `${agent.name} (Copy)`, agent.description, agent.product_id, agent.model, agent.system_prompt);
  return getAgent(newId);
}

export function exportAgentLogs(agentId, format = 'json') {
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId);
  if (!agent) throw new Error('Agent not found');
  const logs = db.prepare('SELECT * FROM agent_logs WHERE agent_id = ? ORDER BY created_at DESC').all(agentId);
  return { agent: { id: agent.id, name: agent.name }, logs, exportedAt: new Date().toISOString() };
}
