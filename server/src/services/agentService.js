import db from '../models/database.js';
import { v4 as uuidv4 } from 'uuid';
import * as mcpService from './mcpService.js';

const DEFAULT_THRESHOLDS = {
  errorRatePercent: 50,
  avgLatencyMs: 5000,
  latencySpikeMs: 10000,
  errorSpikeCount: 10,
  minCallsForEvaluation: 5,
};

const DEFAULT_GUARDRAILS = {
  inputFilters: { piiDetection: false, topicRestrictions: [], maxInputLength: 10000, blockedPatterns: [] },
  outputFilters: { piiRedaction: false, contentModeration: false, maxOutputLength: 50000, sensitiveDataMasking: false },
};

const DEFAULT_BEHAVIOR = {
  maxRetries: 3,
  timeoutMs: 30000,
  fallbackBehavior: 'return_error',
  escalationRules: { onRepeatedFailure: 'log', failureThreshold: 5 },
  concurrentExecutions: 1,
};

function parseJsonField(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return {}; }
}

export function createAgent(name, description, productId, model, systemPrompt, options = {}) {
  const id = uuidv4();
  const guardrails = JSON.stringify(options.guardrails || DEFAULT_GUARDRAILS);
  const behaviorConfig = JSON.stringify(options.behaviorConfig || DEFAULT_BEHAVIOR);
  const toolPermissions = JSON.stringify(options.toolPermissions || {});
  const anomalyThresholds = JSON.stringify(options.anomalyThresholds || DEFAULT_THRESHOLDS);
  const enabled = options.enabled !== undefined ? (options.enabled ? 1 : 0) : 1;

  db.prepare(
    `INSERT INTO agents (id, name, description, product_id, model, system_prompt, enabled, guardrails, behavior_config, tool_permissions, anomaly_thresholds)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, name, description || '', productId || null, model || 'local', systemPrompt || '', enabled, guardrails, behaviorConfig, toolPermissions, anomalyThresholds);
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

function enrichAgent(agent) {
  const product = agent.product_id
    ? db.prepare('SELECT id, name, mcp_enabled FROM products WHERE id = ?').get(agent.product_id)
    : null;
  const mcpServer = agent.product_id
    ? db.prepare('SELECT * FROM mcp_servers WHERE product_id = ?').get(agent.product_id)
    : null;
  const stats = getAgentStats(agent.id);
  const unresolvedAnomalies = db.prepare('SELECT COUNT(*) as count FROM agent_anomalies WHERE agent_id = ? AND resolved = 0').get(agent.id).count;
  return {
    ...agent,
    guardrails: parseJsonField(agent.guardrails),
    behavior_config: parseJsonField(agent.behavior_config),
    tool_permissions: parseJsonField(agent.tool_permissions),
    anomaly_thresholds: parseJsonField(agent.anomaly_thresholds),
    product, mcpServer, ...stats, unresolvedAnomalies,
  };
}

export function listAgents() {
  const agents = db.prepare('SELECT * FROM agents ORDER BY created_at DESC').all();
  return agents.map(enrichAgent);
}

export function getAgent(id) {
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(id);
  if (!agent) return null;
  return enrichAgent(agent);
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
  if (updates.enabled !== undefined) { fields.push('enabled = ?'); values.push(updates.enabled ? 1 : 0); }
  if (updates.guardrails !== undefined) { fields.push('guardrails = ?'); values.push(JSON.stringify(updates.guardrails)); }
  if (updates.behavior_config !== undefined) { fields.push('behavior_config = ?'); values.push(JSON.stringify(updates.behavior_config)); }
  if (updates.tool_permissions !== undefined) { fields.push('tool_permissions = ?'); values.push(JSON.stringify(updates.tool_permissions)); }
  if (updates.anomaly_thresholds !== undefined) { fields.push('anomaly_thresholds = ?'); values.push(JSON.stringify(updates.anomaly_thresholds)); }

  if (fields.length === 0) return getAgent(id);

  fields.push("updated_at = datetime('now')");
  values.push(id);
  db.prepare(`UPDATE agents SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getAgent(id);
}

export function enableAgent(id) {
  db.prepare("UPDATE agents SET enabled = 1, status = 'idle', updated_at = datetime('now') WHERE id = ?").run(id);
  return getAgent(id);
}

export function disableAgent(id) {
  db.prepare("UPDATE agents SET enabled = 0, status = 'disabled', updated_at = datetime('now') WHERE id = ?").run(id);
  return getAgent(id);
}

export function deleteAgent(id) {
  db.prepare('DELETE FROM agent_anomalies WHERE agent_id = ?').run(id);
  db.prepare('DELETE FROM agents WHERE id = ?').run(id);
}

export function getAgentLogs(agentId, limit = 50) {
  return db.prepare(
    'SELECT * FROM agent_logs WHERE agent_id = ? ORDER BY created_at DESC LIMIT ?'
  ).all(agentId, limit);
}

// Guardrail enforcement helpers
function applyInputGuardrails(guardrails, toolName, args) {
  const filters = guardrails.inputFilters || {};
  const violations = [];
  const inputStr = JSON.stringify(args);
  if (filters.maxInputLength && inputStr.length > filters.maxInputLength) {
    violations.push({ type: 'input_too_long', message: `Input exceeds max length of ${filters.maxInputLength} chars` });
  }
  if (filters.piiDetection) {
    const piiPatterns = [
      { name: 'SSN', pattern: /\b\d{3}-\d{2}-\d{4}\b/ },
      { name: 'Credit Card', pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/ },
      { name: 'Email', pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/ },
      { name: 'Phone', pattern: /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/ },
    ];
    for (const { name, pattern } of piiPatterns) {
      if (pattern.test(inputStr)) {
        violations.push({ type: 'pii_detected', message: `Potential ${name} detected in input` });
      }
    }
  }
  if (filters.blockedPatterns && filters.blockedPatterns.length > 0) {
    for (const bp of filters.blockedPatterns) {
      try { if (new RegExp(bp, 'i').test(inputStr)) violations.push({ type: 'blocked_pattern', message: `Input matches blocked pattern: ${bp}` }); } catch (e) { /* skip */ }
    }
  }
  if (filters.topicRestrictions && filters.topicRestrictions.length > 0) {
    for (const topic of filters.topicRestrictions) {
      if (inputStr.toLowerCase().includes(topic.toLowerCase())) violations.push({ type: 'topic_restricted', message: `Input contains restricted topic: ${topic}` });
    }
  }
  return violations;
}

function applyOutputGuardrails(guardrails, result) {
  const filters = guardrails.outputFilters || {};
  const resultStr = JSON.stringify(result);
  let processed = result;
  if (filters.maxOutputLength && resultStr.length > filters.maxOutputLength) {
    processed = { _truncated: true, message: `Output exceeded max length of ${filters.maxOutputLength} chars`, preview: resultStr.substring(0, 500) };
  }
  if (filters.piiRedaction && typeof processed === 'object') {
    try { processed = JSON.parse(JSON.stringify(processed).replace(/\b\d{3}-\d{2}-\d{4}\b/g, '***-**-****').replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '****-****-****-****')); } catch { /* keep */ }
  }
  if (filters.sensitiveDataMasking && typeof processed === 'object') {
    const sensitiveKeys = ['password', 'secret', 'token', 'apiKey', 'api_key', 'authorization', 'credential'];
    const mask = (obj) => {
      if (typeof obj !== 'object' || obj === null) return obj;
      const m = Array.isArray(obj) ? [...obj] : { ...obj };
      for (const k of Object.keys(m)) { if (sensitiveKeys.some(sk => k.toLowerCase().includes(sk))) m[k] = '********'; else if (typeof m[k] === 'object') m[k] = mask(m[k]); }
      return m;
    };
    processed = mask(processed);
  }
  return processed;
}

function checkToolPermission(toolPermissions, toolName) {
  if (!toolPermissions || Object.keys(toolPermissions).length === 0) return { allowed: true };
  const perm = toolPermissions[toolName];
  if (!perm) return { allowed: true };
  if (perm.blocked) return { allowed: false, reason: `Tool '${toolName}' is blocked by permissions` };
  return { allowed: true, permission: perm.level || 'full' };
}

export function executeAgentTool(agentId, toolName, args) {
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId);
  if (!agent) throw new Error('Agent not found');
  if (!agent.enabled) throw new Error('Agent is disabled. Enable it before executing tools.');
  if (!agent.product_id) throw new Error('Agent has no linked product');

  const guardrails = parseJsonField(agent.guardrails);
  const behaviorConfig = parseJsonField(agent.behavior_config);
  const toolPerms = parseJsonField(agent.tool_permissions);

  const permCheck = checkToolPermission(toolPerms, toolName);
  if (!permCheck.allowed) throw new Error(permCheck.reason);

  const inputViolations = applyInputGuardrails(guardrails, toolName, args);
  if (inputViolations.length > 0) {
    const logId = uuidv4();
    const result = { guardrailViolations: inputViolations, blocked: true };
    db.prepare('INSERT INTO agent_logs (id, agent_id, tool_name, args, result, success, duration_ms) VALUES (?, ?, ?, ?, ?, ?, ?)').run(logId, agentId, toolName, JSON.stringify(args || {}), JSON.stringify(result), 0, 0);
    return { logId, tool: toolName, args, result, success: false, durationMs: 0, guardrailViolations: inputViolations };
  }

  db.prepare("UPDATE agents SET status = 'running', updated_at = datetime('now') WHERE id = ?").run(agentId);

  const start = Date.now();
  let success = 1;
  let result;
  let retries = 0;
  const maxRetries = behaviorConfig.maxRetries || 0;

  while (retries <= maxRetries) {
    try {
      const tools = mcpService.generateToolsForProduct(agent.product_id);
      const tool = tools.find(t => t.name === toolName);
      if (!tool) throw new Error(`Tool '${toolName}' not found`);
      result = mcpService.executeToolCall(tool, args || {});
      result = applyOutputGuardrails(guardrails, result);
      break;
    } catch (err) {
      retries++;
      if (retries > maxRetries) {
        success = 0;
        const fallback = behaviorConfig.fallbackBehavior || 'return_error';
        if (fallback === 'use_default') result = { _fallback: true, message: 'Tool execution failed, returning default response' };
        else if (fallback === 'skip') result = { _skipped: true, message: 'Tool execution skipped after failure' };
        else result = { error: err.message };
      }
    }
  }

  const durationMs = Date.now() - start;
  const logId = uuidv4();
  db.prepare('INSERT INTO agent_logs (id, agent_id, tool_name, args, result, success, duration_ms) VALUES (?, ?, ?, ?, ?, ?, ?)').run(logId, agentId, toolName, JSON.stringify(args || {}), JSON.stringify(result), success, durationMs);
  db.prepare("UPDATE agents SET status = 'idle', updated_at = datetime('now') WHERE id = ?").run(agentId);

  checkAndRecordAnomalies(agentId);

  return { logId, tool: toolName, args, result, success: !!success, durationMs };
}

export function runAgentAllTools(agentId) {
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId);
  if (!agent) throw new Error('Agent not found');
  if (!agent.enabled) throw new Error('Agent is disabled. Enable it before executing tools.');
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
  checkAndRecordAnomalies(agentId);

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
    `INSERT INTO agents (id, name, description, product_id, model, system_prompt, enabled, guardrails, behavior_config, tool_permissions, anomaly_thresholds)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(newId, `${agent.name} (Copy)`, agent.description, agent.product_id, agent.model, agent.system_prompt,
    agent.enabled, agent.guardrails || '{}', agent.behavior_config || '{}', agent.tool_permissions || '{}', agent.anomaly_thresholds || '{}');
  return getAgent(newId);
}

export function exportAgentLogs(agentId, format = 'json') {
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId);
  if (!agent) throw new Error('Agent not found');
  const logs = db.prepare('SELECT * FROM agent_logs WHERE agent_id = ? ORDER BY created_at DESC').all(agentId);
  return { agent: { id: agent.id, name: agent.name }, logs, exportedAt: new Date().toISOString() };
}

// --- Anomaly Detection ---

export function checkAndRecordAnomalies(agentId) {
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId);
  if (!agent) return [];
  const thresholds = { ...DEFAULT_THRESHOLDS, ...parseJsonField(agent.anomaly_thresholds) };
  const stats = getAgentStats(agentId);
  const anomalies = [];
  if (stats.logCount < thresholds.minCallsForEvaluation) return [];

  const errorRate = 100 - stats.successRate;
  if (errorRate > thresholds.errorRatePercent) {
    anomalies.push({ type: 'high_error_rate', severity: errorRate > 80 ? 'critical' : 'high', metricValue: errorRate, thresholdValue: thresholds.errorRatePercent, details: `Error rate ${errorRate}% exceeds threshold ${thresholds.errorRatePercent}%` });
  }
  if (stats.avgResponseMs > thresholds.avgLatencyMs) {
    anomalies.push({ type: 'high_avg_latency', severity: stats.avgResponseMs > thresholds.avgLatencyMs * 2 ? 'high' : 'medium', metricValue: stats.avgResponseMs, thresholdValue: thresholds.avgLatencyMs, details: `Avg latency ${stats.avgResponseMs}ms exceeds threshold ${thresholds.avgLatencyMs}ms` });
  }
  const recentLogs = db.prepare('SELECT duration_ms FROM agent_logs WHERE agent_id = ? ORDER BY created_at DESC LIMIT 10').all(agentId);
  const spikeLog = recentLogs.find(l => l.duration_ms > thresholds.latencySpikeMs);
  if (spikeLog) {
    anomalies.push({ type: 'latency_spike', severity: 'medium', metricValue: spikeLog.duration_ms, thresholdValue: thresholds.latencySpikeMs, details: `Latency spike: ${spikeLog.duration_ms}ms exceeds ${thresholds.latencySpikeMs}ms` });
  }
  const recentSuccess = db.prepare('SELECT success FROM agent_logs WHERE agent_id = ? ORDER BY created_at DESC LIMIT ?').all(agentId, thresholds.errorSpikeCount);
  const consecutiveErrors = recentSuccess.filter(l => l.success === 0).length;
  if (consecutiveErrors >= thresholds.errorSpikeCount) {
    anomalies.push({ type: 'error_spike', severity: 'critical', metricValue: consecutiveErrors, thresholdValue: thresholds.errorSpikeCount, details: `${consecutiveErrors} consecutive errors (threshold: ${thresholds.errorSpikeCount})` });
  }

  for (const anomaly of anomalies) {
    const existing = db.prepare('SELECT id FROM agent_anomalies WHERE agent_id = ? AND anomaly_type = ? AND resolved = 0').get(agentId, anomaly.type);
    if (existing) continue;
    const autoAction = anomaly.severity === 'critical' ? 'auto_disabled' : 'none';
    const anomalyId = uuidv4();
    db.prepare('INSERT INTO agent_anomalies (id, agent_id, anomaly_type, severity, details, metric_value, threshold_value, auto_action) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(anomalyId, agentId, anomaly.type, anomaly.severity, anomaly.details, anomaly.metricValue, anomaly.thresholdValue, autoAction);
    if (autoAction === 'auto_disabled') {
      db.prepare("UPDATE agents SET enabled = 0, status = 'disabled', updated_at = datetime('now') WHERE id = ?").run(agentId);
    }
  }
  return anomalies;
}

export function getAgentAnomalies(agentId, includeResolved = false) {
  if (includeResolved) return db.prepare('SELECT * FROM agent_anomalies WHERE agent_id = ? ORDER BY created_at DESC').all(agentId);
  return db.prepare('SELECT * FROM agent_anomalies WHERE agent_id = ? AND resolved = 0 ORDER BY created_at DESC').all(agentId);
}

export function resolveAnomaly(anomalyId) {
  db.prepare("UPDATE agent_anomalies SET resolved = 1, resolved_at = datetime('now') WHERE id = ?").run(anomalyId);
  return db.prepare('SELECT * FROM agent_anomalies WHERE id = ?').get(anomalyId);
}

export function resolveAllAnomalies(agentId) {
  db.prepare("UPDATE agent_anomalies SET resolved = 1, resolved_at = datetime('now') WHERE agent_id = ? AND resolved = 0").run(agentId);
}

// --- Agent Governance Dashboard ---

export function getAgentGovernanceSummary() {
  const agents = db.prepare('SELECT * FROM agents ORDER BY created_at DESC').all();
  const summary = { totalAgents: agents.length, enabledAgents: agents.filter(a => a.enabled).length, disabledAgents: agents.filter(a => !a.enabled).length, agentsWithAnomalies: 0, totalUnresolvedAnomalies: 0, criticalAnomalies: 0, agentHealthStatuses: [] };

  for (const agent of agents) {
    const stats = getAgentStats(agent.id);
    const unresolvedAnomalies = db.prepare('SELECT * FROM agent_anomalies WHERE agent_id = ? AND resolved = 0').all(agent.id);
    const criticalCount = unresolvedAnomalies.filter(a => a.severity === 'critical').length;
    if (unresolvedAnomalies.length > 0) summary.agentsWithAnomalies++;
    summary.totalUnresolvedAnomalies += unresolvedAnomalies.length;
    summary.criticalAnomalies += criticalCount;

    let healthStatus = 'healthy';
    if (!agent.enabled) healthStatus = 'disabled';
    else if (criticalCount > 0) healthStatus = 'critical';
    else if (unresolvedAnomalies.length > 0) healthStatus = 'warning';
    else if (stats.successRate < 80 && stats.logCount >= 5) healthStatus = 'degraded';

    const gr = parseJsonField(agent.guardrails);
    const hasGuardrails = gr.inputFilters?.piiDetection || (gr.inputFilters?.topicRestrictions?.length > 0) || gr.outputFilters?.contentModeration || gr.outputFilters?.piiRedaction;

    summary.agentHealthStatuses.push({
      id: agent.id, name: agent.name, model: agent.model, enabled: !!agent.enabled, status: agent.status, healthStatus, ...stats,
      anomalyCount: unresolvedAnomalies.length, criticalAnomalyCount: criticalCount, anomalies: unresolvedAnomalies,
      hasGuardrails: !!hasGuardrails, hasToolPermissions: Object.keys(parseJsonField(agent.tool_permissions)).length > 0,
    });
  }
  return summary;
}
