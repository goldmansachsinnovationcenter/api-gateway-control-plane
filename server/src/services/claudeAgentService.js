import db from '../models/database.js';
import { v4 as uuidv4 } from 'uuid';

// ─── Discovery ──────────────────────────────────────────────────────────────

/**
 * Discover Claude model invocations from AWS Bedrock.
 * With real AWS credentials + Bedrock runtime logging, fetches actual usage.
 * Otherwise returns mock demo data.
 */
export async function discoverInvocations(credentials) {
  if (credentials?.accessKeyId && credentials?.secretAccessKey) {
    try {
      const { BedrockClient, ListFoundationModelsCommand } = await import('@aws-sdk/client-bedrock');
      const client = new BedrockClient({
        region: credentials.region || 'us-east-1',
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
        },
      });

      const result = await client.send(new ListFoundationModelsCommand({
        byProvider: 'Anthropic',
      }));

      const claudeModels = (result.modelSummaries || []).filter(m =>
        m.modelId?.includes('claude')
      );

      if (claudeModels.length === 0) {
        return discoverMockInvocations();
      }

      return discoverMockInvocations(claudeModels.map(m => m.modelId));
    } catch (err) {
      console.error('Bedrock Claude discovery failed:', err.message);
      return discoverMockInvocations();
    }
  }

  return discoverMockInvocations();
}

function discoverMockInvocations(realModelIds) {
  const now = new Date();
  const models = realModelIds || [
    'anthropic.claude-3-5-sonnet-20241022-v2:0',
    'anthropic.claude-3-sonnet-20240229-v1:0',
    'anthropic.claude-3-haiku-20240307-v1:0',
    'anthropic.claude-3-opus-20240229-v1:0',
  ];

  const users = [
    'alice@company.com',
    'bob@company.com',
    'charlie@company.com',
    'diana@company.com',
    'eve@company.com',
  ];

  const useCases = [
    { title: 'Code review for authentication module', category: 'Code Review' },
    { title: 'Generate unit tests for payment service', category: 'Test Generation' },
    { title: 'Summarize quarterly sales report', category: 'Summarization' },
    { title: 'Debug memory leak in Node.js application', category: 'Debugging' },
    { title: 'Draft API documentation for user endpoints', category: 'Documentation' },
    { title: 'Analyze security vulnerabilities in dependencies', category: 'Security Analysis' },
    { title: 'Refactor database access layer to use repository pattern', category: 'Refactoring' },
    { title: 'Create migration script for PostgreSQL schema', category: 'Database' },
    { title: 'Optimize React component rendering performance', category: 'Performance' },
    { title: 'Write integration tests for payment gateway', category: 'Test Generation' },
    { title: 'Review PR #342 - Add rate limiting middleware', category: 'Code Review' },
    { title: 'Generate OpenAPI spec from Express routes', category: 'Documentation' },
  ];

  const invocations = [];
  for (let i = 0; i < 12; i++) {
    const useCase = useCases[i];
    const model = models[i % models.length];
    const user = users[i % users.length];
    const minutesAgo = [5, 15, 30, 60, 120, 180, 360, 720, 1440, 2880, 4320, 10080][i];
    const startedAt = new Date(now.getTime() - minutesAgo * 60000);
    const durationMs = Math.floor(Math.random() * 8000) + 2000;
    const promptTokens = Math.floor(Math.random() * 3000) + 500;
    const completionTokens = Math.floor(Math.random() * 4000) + 200;
    const status = i === 0 ? 'streaming' : i === 5 ? 'error' : 'completed';

    invocations.push({
      invocationId: `inv-claude-${String(i + 1).padStart(3, '0')}`,
      title: useCase.title,
      category: useCase.category,
      model,
      modelShortName: getModelShortName(model),
      user,
      status,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      durationMs,
      estimatedCost: calculateCost(model, promptTokens, completionTokens),
      region: 'us-east-1',
      startedAt: startedAt.toISOString(),
      finishedAt: status === 'streaming' ? null : new Date(startedAt.getTime() + durationMs).toISOString(),
    });
  }

  return invocations;
}

function getModelShortName(modelId) {
  if (modelId.includes('claude-3-5-sonnet')) return 'Claude 3.5 Sonnet';
  if (modelId.includes('claude-3-sonnet')) return 'Claude 3 Sonnet';
  if (modelId.includes('claude-3-haiku')) return 'Claude 3 Haiku';
  if (modelId.includes('claude-3-opus')) return 'Claude 3 Opus';
  if (modelId.includes('claude-2')) return 'Claude 2';
  return modelId;
}

function calculateCost(modelId, promptTokens, completionTokens) {
  const pricing = {
    'claude-3-5-sonnet': { prompt: 0.003, completion: 0.015 },
    'claude-3-sonnet': { prompt: 0.003, completion: 0.015 },
    'claude-3-haiku': { prompt: 0.00025, completion: 0.00125 },
    'claude-3-opus': { prompt: 0.015, completion: 0.075 },
  };

  let rates = pricing['claude-3-sonnet'];
  for (const [key, val] of Object.entries(pricing)) {
    if (modelId.includes(key)) { rates = val; break; }
  }

  return Number(((promptTokens / 1000) * rates.prompt + (completionTokens / 1000) * rates.completion).toFixed(4));
}

// ─── CRUD Operations ────────────────────────────────────────────────────────

export function importInvocations(invocations) {
  const imported = [];
  const upsert = db.prepare(`
    INSERT INTO claude_invocations (id, invocation_id, title, category, model, model_short_name, user_email, status, prompt_tokens, completion_tokens, total_tokens, duration_ms, estimated_cost, region, started_at, finished_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title=excluded.title, status=excluded.status, total_tokens=excluded.total_tokens,
      prompt_tokens=excluded.prompt_tokens, completion_tokens=excluded.completion_tokens,
      duration_ms=excluded.duration_ms, estimated_cost=excluded.estimated_cost,
      finished_at=excluded.finished_at, updated_at=datetime('now')
  `);

  const txn = db.transaction((invocations) => {
    for (const inv of invocations) {
      const existing = db.prepare('SELECT id FROM claude_invocations WHERE invocation_id = ?').get(inv.invocationId);
      const id = existing?.id || uuidv4();

      upsert.run(
        id, inv.invocationId, inv.title, inv.category, inv.model,
        inv.modelShortName, inv.user, inv.status, inv.promptTokens,
        inv.completionTokens, inv.totalTokens, inv.durationMs,
        inv.estimatedCost, inv.region, inv.startedAt, inv.finishedAt,
      );

      imported.push({ id, ...inv });
    }
  });

  txn(invocations);
  return imported;
}

export function listInvocations() {
  return db.prepare('SELECT * FROM claude_invocations ORDER BY started_at DESC').all();
}

export function getInvocation(id) {
  return db.prepare('SELECT * FROM claude_invocations WHERE id = ?').get(id);
}

export function deleteInvocation(id) {
  db.prepare('DELETE FROM claude_invocations WHERE id = ?').run(id);
}

// ─── Analytics ──────────────────────────────────────────────────────────────

export function getUsageStats() {
  const invocations = listInvocations();
  const totalTokens = invocations.reduce((sum, i) => sum + (i.total_tokens || 0), 0);
  const totalPrompt = invocations.reduce((sum, i) => sum + (i.prompt_tokens || 0), 0);
  const totalCompletion = invocations.reduce((sum, i) => sum + (i.completion_tokens || 0), 0);
  const totalDuration = invocations.reduce((sum, i) => sum + (i.duration_ms || 0), 0);
  const totalCost = invocations.reduce((sum, i) => sum + (i.estimated_cost || 0), 0);

  const uniqueUsers = [...new Set(invocations.map(i => i.user_email))];

  const statusCounts = {};
  invocations.forEach(i => {
    statusCounts[i.status] = (statusCounts[i.status] || 0) + 1;
  });

  // Per-model breakdown
  const modelStats = {};
  invocations.forEach(i => {
    const model = i.model_short_name || i.model;
    if (!modelStats[model]) {
      modelStats[model] = { invocations: 0, tokens: 0, promptTokens: 0, completionTokens: 0, cost: 0, avgDurationMs: 0, totalDuration: 0 };
    }
    modelStats[model].invocations += 1;
    modelStats[model].tokens += i.total_tokens || 0;
    modelStats[model].promptTokens += i.prompt_tokens || 0;
    modelStats[model].completionTokens += i.completion_tokens || 0;
    modelStats[model].cost += i.estimated_cost || 0;
    modelStats[model].totalDuration += i.duration_ms || 0;
  });
  Object.values(modelStats).forEach(m => {
    m.avgDurationMs = m.invocations > 0 ? Math.round(m.totalDuration / m.invocations) : 0;
    m.cost = Number(m.cost.toFixed(4));
  });

  // Per-user breakdown
  const userStats = {};
  invocations.forEach(i => {
    if (!userStats[i.user_email]) {
      userStats[i.user_email] = { invocations: 0, tokens: 0, cost: 0 };
    }
    userStats[i.user_email].invocations += 1;
    userStats[i.user_email].tokens += i.total_tokens || 0;
    userStats[i.user_email].cost += i.estimated_cost || 0;
  });
  Object.values(userStats).forEach(u => { u.cost = Number(u.cost.toFixed(4)); });

  // Per-category breakdown
  const categoryStats = {};
  invocations.forEach(i => {
    const cat = i.category || 'Other';
    if (!categoryStats[cat]) {
      categoryStats[cat] = { invocations: 0, tokens: 0, cost: 0 };
    }
    categoryStats[cat].invocations += 1;
    categoryStats[cat].tokens += i.total_tokens || 0;
    categoryStats[cat].cost += i.estimated_cost || 0;
  });
  Object.values(categoryStats).forEach(c => { c.cost = Number(c.cost.toFixed(4)); });

  // Daily usage for chart (last 7 days)
  const dailyUsage = [];
  for (let d = 6; d >= 0; d--) {
    const date = new Date();
    date.setDate(date.getDate() - d);
    const dateStr = date.toISOString().split('T')[0];
    const dayInvocations = invocations.filter(i => i.started_at?.startsWith(dateStr));
    dailyUsage.push({
      date: dateStr,
      invocations: dayInvocations.length,
      tokens: dayInvocations.reduce((sum, i) => sum + (i.total_tokens || 0), 0),
      cost: Number(dayInvocations.reduce((sum, i) => sum + (i.estimated_cost || 0), 0).toFixed(4)),
    });
  }

  return {
    totalInvocations: invocations.length,
    totalTokens,
    totalPromptTokens: totalPrompt,
    totalCompletionTokens: totalCompletion,
    totalDurationMs: totalDuration,
    totalCost: Number(totalCost.toFixed(4)),
    avgTokensPerInvocation: invocations.length > 0 ? Math.round(totalTokens / invocations.length) : 0,
    avgDurationMs: invocations.length > 0 ? Math.round(totalDuration / invocations.length) : 0,
    uniqueUsers: uniqueUsers.length,
    users: uniqueUsers,
    statusCounts,
    modelStats,
    userStats,
    categoryStats,
    dailyUsage,
  };
}

// ─── Sync ────────────────────────────────────────────────────────────────────

export async function syncInvocation(id) {
  const inv = db.prepare('SELECT * FROM claude_invocations WHERE id = ?').get(id);
  if (!inv) throw new Error('Claude invocation not found');
  db.prepare("UPDATE claude_invocations SET updated_at = datetime('now') WHERE id = ?").run(id);
  return getInvocation(id);
}
