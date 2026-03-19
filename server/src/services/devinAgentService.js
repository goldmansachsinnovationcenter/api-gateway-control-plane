import db from '../models/database.js';
import { v4 as uuidv4 } from 'uuid';

// ─── Discovery ──────────────────────────────────────────────────────────────

/**
 * Discover Devin sessions / agents.
 * With a real API key, calls the Devin API (api.devin.ai).
 * Otherwise returns mock demo data.
 */
export async function discoverSessions(apiKey) {
  if (apiKey) {
    try {
      const response = await fetch('https://api.devin.ai/v1/sessions', {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.log('Devin API returned error, using mock data');
        return discoverMockSessions();
      }

      const data = await response.json();
      const sessions = (data.sessions || data.data || []).map(session => ({
        devinSessionId: session.session_id || session.id,
        title: session.title || session.prompt?.substring(0, 80) || 'Untitled Session',
        status: session.status || 'finished',
        createdBy: session.created_by || session.user_email || 'unknown',
        tokenUsage: session.token_usage || session.total_tokens || 0,
        promptTokens: session.prompt_tokens || 0,
        completionTokens: session.completion_tokens || 0,
        model: session.model || 'devin-1.0',
        duration: session.duration_seconds || 0,
        createdAt: session.created_at || new Date().toISOString(),
        finishedAt: session.finished_at || null,
        url: session.url || `https://app.devin.ai/sessions/${session.session_id || session.id}`,
      }));

      if (sessions.length === 0) {
        return discoverMockSessions();
      }
      return sessions;
    } catch (err) {
      console.error('Devin session discovery failed:', err.message);
      return discoverMockSessions();
    }
  }

  return discoverMockSessions();
}

function discoverMockSessions() {
  const now = new Date();
  const hourAgo = new Date(now - 3600000);
  const dayAgo = new Date(now - 86400000);
  const twoDaysAgo = new Date(now - 172800000);
  const weekAgo = new Date(now - 604800000);

  return [
    {
      devinSessionId: 'sess-devin-001',
      title: 'Implement user authentication with JWT',
      status: 'finished',
      createdBy: 'developer@company.com',
      tokenUsage: 145230,
      promptTokens: 52100,
      completionTokens: 93130,
      model: 'devin-1.0',
      duration: 1845,
      createdAt: hourAgo.toISOString(),
      finishedAt: now.toISOString(),
      url: 'https://app.devin.ai/sessions/sess-devin-001',
    },
    {
      devinSessionId: 'sess-devin-002',
      title: 'Fix CI pipeline failing on TypeScript strict mode',
      status: 'finished',
      createdBy: 'lead@company.com',
      tokenUsage: 89450,
      promptTokens: 31200,
      completionTokens: 58250,
      model: 'devin-1.0',
      duration: 1230,
      createdAt: dayAgo.toISOString(),
      finishedAt: new Date(dayAgo.getTime() + 1230000).toISOString(),
      url: 'https://app.devin.ai/sessions/sess-devin-002',
    },
    {
      devinSessionId: 'sess-devin-003',
      title: 'Add dark mode support to the dashboard',
      status: 'running',
      createdBy: 'designer@company.com',
      tokenUsage: 67800,
      promptTokens: 24500,
      completionTokens: 43300,
      model: 'devin-1.0',
      duration: 920,
      createdAt: new Date(now - 920000).toISOString(),
      finishedAt: null,
      url: 'https://app.devin.ai/sessions/sess-devin-003',
    },
    {
      devinSessionId: 'sess-devin-004',
      title: 'Refactor database queries for PostgreSQL optimization',
      status: 'finished',
      createdBy: 'developer@company.com',
      tokenUsage: 203100,
      promptTokens: 72400,
      completionTokens: 130700,
      model: 'devin-1.0',
      duration: 2560,
      createdAt: twoDaysAgo.toISOString(),
      finishedAt: new Date(twoDaysAgo.getTime() + 2560000).toISOString(),
      url: 'https://app.devin.ai/sessions/sess-devin-004',
    },
    {
      devinSessionId: 'sess-devin-005',
      title: 'Create REST API endpoints for inventory management',
      status: 'finished',
      createdBy: 'pm@company.com',
      tokenUsage: 178900,
      promptTokens: 63200,
      completionTokens: 115700,
      model: 'devin-1.0',
      duration: 2100,
      createdAt: weekAgo.toISOString(),
      finishedAt: new Date(weekAgo.getTime() + 2100000).toISOString(),
      url: 'https://app.devin.ai/sessions/sess-devin-005',
    },
    {
      devinSessionId: 'sess-devin-006',
      title: 'Set up monitoring and alerting with Prometheus',
      status: 'blocked',
      createdBy: 'devops@company.com',
      tokenUsage: 34500,
      promptTokens: 12800,
      completionTokens: 21700,
      model: 'devin-1.0',
      duration: 450,
      createdAt: dayAgo.toISOString(),
      finishedAt: null,
      url: 'https://app.devin.ai/sessions/sess-devin-006',
    },
  ];
}

// ─── CRUD Operations ────────────────────────────────────────────────────────

export function importSessions(sessions) {
  const imported = [];
  const upsert = db.prepare(`
    INSERT INTO devin_sessions (id, devin_session_id, title, status, created_by, token_usage, prompt_tokens, completion_tokens, model, duration_seconds, session_url, started_at, finished_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title=excluded.title, status=excluded.status, token_usage=excluded.token_usage,
      prompt_tokens=excluded.prompt_tokens, completion_tokens=excluded.completion_tokens,
      duration_seconds=excluded.duration_seconds, finished_at=excluded.finished_at,
      updated_at=datetime('now')
  `);

  const txn = db.transaction((sessions) => {
    for (const session of sessions) {
      const existing = db.prepare('SELECT id FROM devin_sessions WHERE devin_session_id = ?').get(session.devinSessionId);
      const id = existing?.id || uuidv4();

      upsert.run(
        id, session.devinSessionId, session.title, session.status,
        session.createdBy, session.tokenUsage, session.promptTokens,
        session.completionTokens, session.model, session.duration,
        session.url, session.createdAt, session.finishedAt,
      );

      imported.push({ id, ...session });
    }
  });

  txn(sessions);
  return imported;
}

export function listSessions() {
  return db.prepare('SELECT * FROM devin_sessions ORDER BY started_at DESC').all();
}

export function getSession(id) {
  return db.prepare('SELECT * FROM devin_sessions WHERE id = ?').get(id);
}

export function deleteSession(id) {
  db.prepare('DELETE FROM devin_sessions WHERE id = ?').run(id);
}

// ─── Analytics ──────────────────────────────────────────────────────────────

export function getUsageStats() {
  const sessions = listSessions();
  const totalTokens = sessions.reduce((sum, s) => sum + (s.token_usage || 0), 0);
  const totalPrompt = sessions.reduce((sum, s) => sum + (s.prompt_tokens || 0), 0);
  const totalCompletion = sessions.reduce((sum, s) => sum + (s.completion_tokens || 0), 0);
  const totalDuration = sessions.reduce((sum, s) => sum + (s.duration_seconds || 0), 0);

  const uniqueUsers = [...new Set(sessions.map(s => s.created_by))];

  const statusCounts = {};
  sessions.forEach(s => {
    statusCounts[s.status] = (statusCounts[s.status] || 0) + 1;
  });

  const userStats = {};
  sessions.forEach(s => {
    if (!userStats[s.created_by]) {
      userStats[s.created_by] = { sessions: 0, tokens: 0, duration: 0 };
    }
    userStats[s.created_by].sessions += 1;
    userStats[s.created_by].tokens += s.token_usage || 0;
    userStats[s.created_by].duration += s.duration_seconds || 0;
  });

  // Daily usage for chart (last 7 days)
  const dailyUsage = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const daySessions = sessions.filter(s => s.started_at?.startsWith(dateStr));
    dailyUsage.push({
      date: dateStr,
      sessions: daySessions.length,
      tokens: daySessions.reduce((sum, s) => sum + (s.token_usage || 0), 0),
    });
  }

  return {
    totalSessions: sessions.length,
    totalTokens,
    totalPromptTokens: totalPrompt,
    totalCompletionTokens: totalCompletion,
    totalDurationSeconds: totalDuration,
    avgTokensPerSession: sessions.length > 0 ? Math.round(totalTokens / sessions.length) : 0,
    avgDurationSeconds: sessions.length > 0 ? Math.round(totalDuration / sessions.length) : 0,
    uniqueUsers: uniqueUsers.length,
    users: uniqueUsers,
    statusCounts,
    userStats,
    dailyUsage,
  };
}

// ─── Sync ────────────────────────────────────────────────────────────────────

export async function syncSession(id) {
  const session = db.prepare('SELECT * FROM devin_sessions WHERE id = ?').get(id);
  if (!session) throw new Error('Devin session not found');
  db.prepare("UPDATE devin_sessions SET updated_at = datetime('now') WHERE id = ?").run(id);
  return getSession(id);
}
