import db from '../models/database.js';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

// ==================== USERS ====================

export function listUsers() {
  return db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
}

export function getUser(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

export function getUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

export function createUser({ email, name, role = 'viewer' }) {
  const id = uuidv4();
  db.prepare(`INSERT INTO users (id, email, name, role, status) VALUES (?, ?, ?, ?, 'active')`).run(id, email, name, role);
  logSettingsAction(null, null, 'user.created', 'users', { userId: id, email, name, role });
  return getUser(id);
}

export function updateUser(id, updates) {
  const fields = [];
  const values = [];
  const allowed = ['name', 'email', 'role', 'status', 'avatar', 'mfa_enabled', 'notification_preferences'];
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(typeof updates[key] === 'object' ? JSON.stringify(updates[key]) : updates[key]);
    }
  }
  if (fields.length === 0) return getUser(id);
  fields.push("updated_at = datetime('now')");
  values.push(id);
  db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  logSettingsAction(null, null, 'user.updated', 'users', { userId: id, fields: Object.keys(updates) });
  return getUser(id);
}

export function deleteUser(id) {
  const user = getUser(id);
  if (!user) return null;
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  logSettingsAction(null, null, 'user.deleted', 'users', { userId: id, email: user.email });
  return user;
}

export function getUserStats() {
  const total = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const active = db.prepare("SELECT COUNT(*) as count FROM users WHERE status = 'active'").get().count;
  const admins = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get().count;
  const mfaEnabled = db.prepare("SELECT COUNT(*) as count FROM users WHERE mfa_enabled = 1").get().count;
  return { total, active, inactive: total - active, admins, mfaEnabled };
}

// ==================== API KEYS ====================

function generateApiKey() {
  const prefix = 'gsic_' + crypto.randomBytes(4).toString('hex');
  const secret = crypto.randomBytes(32).toString('hex');
  const fullKey = `${prefix}_${secret}`;
  const hash = crypto.createHash('sha256').update(fullKey).digest('hex');
  return { fullKey, prefix, hash };
}

export function listApiKeys() {
  const keys = db.prepare(`
    SELECT ak.*, u.name as user_name, u.email as user_email 
    FROM api_keys ak LEFT JOIN users u ON ak.user_id = u.id 
    ORDER BY ak.created_at DESC
  `).all();
  return keys.map(k => ({ ...k, scopes: JSON.parse(k.scopes || '[]') }));
}

export function createApiKey({ name, userId, scopes = ['read'], rateLimit = 1000, expiresAt }) {
  const { fullKey, prefix, hash } = generateApiKey();
  const id = uuidv4();
  db.prepare(`INSERT INTO api_keys (id, name, key_prefix, key_hash, user_id, scopes, rate_limit, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, name, prefix, hash, userId || null, JSON.stringify(scopes), rateLimit, expiresAt || null
  );
  logSettingsAction(userId, null, 'apikey.created', 'api_keys', { keyId: id, name, prefix });
  return { id, name, key: fullKey, prefix, scopes, rateLimit, expiresAt, createdAt: new Date().toISOString() };
}

export function revokeApiKey(id) {
  db.prepare("UPDATE api_keys SET status = 'revoked' WHERE id = ?").run(id);
  logSettingsAction(null, null, 'apikey.revoked', 'api_keys', { keyId: id });
  return db.prepare('SELECT * FROM api_keys WHERE id = ?').get(id);
}

export function deleteApiKey(id) {
  const key = db.prepare('SELECT * FROM api_keys WHERE id = ?').get(id);
  db.prepare('DELETE FROM api_keys WHERE id = ?').run(id);
  logSettingsAction(null, null, 'apikey.deleted', 'api_keys', { keyId: id });
  return key;
}

// ==================== APP SETTINGS ====================

export function getAllSettings() {
  const rows = db.prepare('SELECT * FROM app_settings ORDER BY category, key').all();
  const grouped = {};
  for (const row of rows) {
    if (!grouped[row.category]) grouped[row.category] = [];
    grouped[row.category].push(row);
  }
  return grouped;
}

export function getSettingsByCategory(category) {
  return db.prepare('SELECT * FROM app_settings WHERE category = ? ORDER BY key').all(category);
}

export function getSetting(key) {
  return db.prepare('SELECT * FROM app_settings WHERE key = ?').get(key);
}

export function updateSetting(key, value, updatedBy) {
  const existing = getSetting(key);
  if (!existing) {
    return null;
  }
  db.prepare("UPDATE app_settings SET value = ?, updated_at = datetime('now'), updated_by = ? WHERE key = ?").run(
    typeof value === 'object' ? JSON.stringify(value) : String(value), updatedBy || null, key
  );
  logSettingsAction(null, updatedBy, 'setting.updated', existing.category, { key, oldValue: existing.value, newValue: value });
  return getSetting(key);
}

export function updateSettingsBatch(updates, updatedBy) {
  const stmt = db.prepare("UPDATE app_settings SET value = ?, updated_at = datetime('now'), updated_by = ? WHERE key = ?");
  const results = [];
  const transaction = db.transaction(() => {
    for (const { key, value } of updates) {
      stmt.run(typeof value === 'object' ? JSON.stringify(value) : String(value), updatedBy || null, key);
      results.push({ key, value });
    }
  });
  transaction();
  logSettingsAction(null, updatedBy, 'settings.batch_updated', 'multiple', { count: updates.length, keys: updates.map(u => u.key) });
  return results;
}

// ==================== WEBHOOKS ====================

export function listWebhooks() {
  return db.prepare('SELECT * FROM webhooks ORDER BY created_at DESC').all().map(w => ({
    ...w,
    events: JSON.parse(w.events || '[]'),
  }));
}

export function createWebhook({ name, url, events = [], secret }) {
  const id = uuidv4();
  const webhookSecret = secret || crypto.randomBytes(20).toString('hex');
  db.prepare('INSERT INTO webhooks (id, name, url, events, secret) VALUES (?, ?, ?, ?, ?)').run(
    id, name, url, JSON.stringify(events), webhookSecret
  );
  logSettingsAction(null, null, 'webhook.created', 'webhooks', { webhookId: id, name, url });
  const wh = db.prepare('SELECT * FROM webhooks WHERE id = ?').get(id);
  return { ...wh, events: JSON.parse(wh.events || '[]') };
}

export function updateWebhook(id, updates) {
  const fields = [];
  const values = [];
  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
  if (updates.url !== undefined) { fields.push('url = ?'); values.push(updates.url); }
  if (updates.events !== undefined) { fields.push('events = ?'); values.push(JSON.stringify(updates.events)); }
  if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }
  if (fields.length === 0) return db.prepare('SELECT * FROM webhooks WHERE id = ?').get(id);
  fields.push("updated_at = datetime('now')");
  values.push(id);
  db.prepare(`UPDATE webhooks SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  logSettingsAction(null, null, 'webhook.updated', 'webhooks', { webhookId: id });
  const wh = db.prepare('SELECT * FROM webhooks WHERE id = ?').get(id);
  return { ...wh, events: JSON.parse(wh.events || '[]') };
}

export function deleteWebhook(id) {
  const wh = db.prepare('SELECT * FROM webhooks WHERE id = ?').get(id);
  db.prepare('DELETE FROM webhooks WHERE id = ?').run(id);
  logSettingsAction(null, null, 'webhook.deleted', 'webhooks', { webhookId: id });
  return wh;
}

export function testWebhook(id) {
  const wh = db.prepare('SELECT * FROM webhooks WHERE id = ?').get(id);
  if (!wh) return null;
  // Simulate webhook delivery
  db.prepare("UPDATE webhooks SET last_triggered = datetime('now') WHERE id = ?").run(id);
  return { success: true, webhookId: id, statusCode: 200, responseTime: Math.floor(Math.random() * 200) + 50 };
}

// ==================== AUDIT LOG ====================

export function logSettingsAction(userId, userName, action, category, details) {
  const id = uuidv4();
  db.prepare('INSERT INTO audit_settings_log (id, user_id, user_name, action, category, details) VALUES (?, ?, ?, ?, ?, ?)').run(
    id, userId || null, userName || 'system', action, category || null, JSON.stringify(details || {})
  );
}

export function getSettingsAuditLog(limit = 50, offset = 0, category) {
  if (category) {
    return db.prepare('SELECT * FROM audit_settings_log WHERE category = ? ORDER BY created_at DESC LIMIT ? OFFSET ?').all(category, limit, offset)
      .map(l => ({ ...l, details: JSON.parse(l.details || '{}') }));
  }
  return db.prepare('SELECT * FROM audit_settings_log ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset)
    .map(l => ({ ...l, details: JSON.parse(l.details || '{}') }));
}

// ==================== SYSTEM INFO ====================

export function getSystemInfo() {
  const tables = ['gateways', 'apis', 'products', 'agents', 'agent_logs', 'users', 'api_keys', 'app_settings', 'webhooks'];
  const counts = {};
  for (const table of tables) {
    try {
      counts[table] = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get().count;
    } catch {
      counts[table] = 0;
    }
  }

  const dbSizeResult = db.prepare("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()").get();

  return {
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    nodeVersion: process.version,
    platform: process.platform,
    memoryUsage: process.memoryUsage(),
    databaseSize: dbSizeResult ? dbSizeResult.size : 0,
    tableCounts: counts,
  };
}
