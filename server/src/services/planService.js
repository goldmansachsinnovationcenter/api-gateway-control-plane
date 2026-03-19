import { randomUUID } from 'crypto';
import db from '../models/database.js';

// ─── Plans CRUD ─────────────────────────────────────────────────────────────

export function createPlan(productId, { name, description, rateLimitPerMinute, rateLimitPerHour, rateLimitPerDay, quotaPerMonth, throttleBurstLimit }) {
  const id = randomUUID();
  db.prepare(`
    INSERT INTO plans (id, product_id, name, description, rate_limit_per_minute, rate_limit_per_hour, rate_limit_per_day, quota_per_month, throttle_burst_limit)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, productId, name, description || null, rateLimitPerMinute || 0, rateLimitPerHour || 0, rateLimitPerDay || 0, quotaPerMonth || 0, throttleBurstLimit || 0);
  return getPlan(id);
}

export function getPlan(id) {
  const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(id);
  if (!plan) return null;
  const subscriptions = db.prepare('SELECT * FROM subscriptions WHERE plan_id = ? ORDER BY created_at DESC').all(id);
  return { ...plan, subscriptions, subscriberCount: subscriptions.length };
}

export function listPlansForProduct(productId) {
  const plans = db.prepare('SELECT * FROM plans WHERE product_id = ? ORDER BY created_at DESC').all(productId);
  return plans.map(p => {
    const subscriberCount = db.prepare('SELECT COUNT(*) as count FROM subscriptions WHERE plan_id = ?').get(p.id).count;
    return { ...p, subscriberCount };
  });
}

export function updatePlan(id, updates) {
  const fields = [];
  const values = [];
  const allowed = ['name', 'description', 'rate_limit_per_minute', 'rate_limit_per_hour', 'rate_limit_per_day', 'quota_per_month', 'throttle_burst_limit'];
  for (const [key, val] of Object.entries(updates)) {
    const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    if (allowed.includes(dbKey)) {
      fields.push(`${dbKey} = ?`);
      values.push(val);
    }
  }
  if (fields.length === 0) return getPlan(id);
  fields.push("updated_at = datetime('now')");
  values.push(id);
  db.prepare(`UPDATE plans SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getPlan(id);
}

export function deletePlan(id) {
  db.prepare('DELETE FROM plans WHERE id = ?').run(id);
}

// ─── Subscriptions CRUD ─────────────────────────────────────────────────────

export function createSubscription(planId, applicationName) {
  const id = randomUUID();
  const apiKey = `sk-${randomUUID().replace(/-/g, '')}`;
  db.prepare(`
    INSERT INTO subscriptions (id, plan_id, application_name, api_key)
    VALUES (?, ?, ?, ?)
  `).run(id, planId, applicationName, apiKey);
  return getSubscription(id);
}

export function getSubscription(id) {
  const sub = db.prepare(`
    SELECT s.*, p.name as plan_name, p.product_id,
           p.rate_limit_per_minute, p.rate_limit_per_hour, p.rate_limit_per_day,
           p.quota_per_month, p.throttle_burst_limit
    FROM subscriptions s
    JOIN plans p ON s.plan_id = p.id
    WHERE s.id = ?
  `).get(id);
  if (!sub) return null;
  const usage = getSubscriptionUsage(id);
  return { ...sub, usage };
}

export function listSubscriptionsForPlan(planId) {
  const subs = db.prepare('SELECT * FROM subscriptions WHERE plan_id = ? ORDER BY created_at DESC').all(planId);
  return subs.map(s => {
    const usage = getSubscriptionUsage(s.id);
    return { ...s, usage };
  });
}

export function listSubscriptionsForProduct(productId) {
  const subs = db.prepare(`
    SELECT s.*, p.name as plan_name, p.product_id,
           p.rate_limit_per_minute, p.rate_limit_per_hour, p.rate_limit_per_day,
           p.quota_per_month, p.throttle_burst_limit
    FROM subscriptions s
    JOIN plans p ON s.plan_id = p.id
    WHERE p.product_id = ?
    ORDER BY s.created_at DESC
  `).all(productId);
  return subs.map(s => {
    const usage = getSubscriptionUsage(s.id);
    return { ...s, usage };
  });
}

export function updateSubscriptionStatus(id, status) {
  db.prepare("UPDATE subscriptions SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, id);
  return getSubscription(id);
}

export function deleteSubscription(id) {
  db.prepare('DELETE FROM subscriptions WHERE id = ?').run(id);
}

// ─── Rate Limit Checking ────────────────────────────────────────────────────

function getWindowKey(type) {
  const now = new Date();
  switch (type) {
    case 'minute':
      return `min:${now.getUTCFullYear()}-${String(now.getUTCMonth()+1).padStart(2,'0')}-${String(now.getUTCDate()).padStart(2,'0')}T${String(now.getUTCHours()).padStart(2,'0')}:${String(now.getUTCMinutes()).padStart(2,'0')}`;
    case 'hour':
      return `hr:${now.getUTCFullYear()}-${String(now.getUTCMonth()+1).padStart(2,'0')}-${String(now.getUTCDate()).padStart(2,'0')}T${String(now.getUTCHours()).padStart(2,'0')}`;
    case 'day':
      return `day:${now.getUTCFullYear()}-${String(now.getUTCMonth()+1).padStart(2,'0')}-${String(now.getUTCDate()).padStart(2,'0')}`;
    case 'month':
      return `mon:${now.getUTCFullYear()}-${String(now.getUTCMonth()+1).padStart(2,'0')}`;
    default:
      return `unknown:${now.toISOString()}`;
  }
}

/**
 * Find a subscription by API key and check rate limits.
 * Returns { allowed, subscription, plan, retryAfter, limitType } 
 */
export function checkRateLimit(apiKey) {
  const sub = db.prepare(`
    SELECT s.*, p.name as plan_name, p.product_id,
           p.rate_limit_per_minute, p.rate_limit_per_hour, p.rate_limit_per_day,
           p.quota_per_month, p.throttle_burst_limit
    FROM subscriptions s
    JOIN plans p ON s.plan_id = p.id
    WHERE s.api_key = ? AND s.status = 'active'
  `).get(apiKey);

  if (!sub) {
    return { allowed: null }; // Not a subscription key, fall through to legacy auth
  }

  // Check each window
  const checks = [
    { type: 'minute', limit: sub.rate_limit_per_minute, retryAfter: 60 },
    { type: 'hour', limit: sub.rate_limit_per_hour, retryAfter: 3600 },
    { type: 'day', limit: sub.rate_limit_per_day, retryAfter: 86400 },
    { type: 'month', limit: sub.quota_per_month, retryAfter: 86400 },
  ];

  for (const check of checks) {
    if (check.limit <= 0) continue; // 0 = unlimited

    const windowKey = getWindowKey(check.type);
    const row = db.prepare(
      'SELECT request_count FROM rate_limit_logs WHERE subscription_id = ? AND window_key = ?'
    ).get(sub.id, windowKey);

    const current = row ? row.request_count : 0;
    if (current >= check.limit) {
      return {
        allowed: false,
        subscription: sub,
        limitType: check.type,
        limit: check.limit,
        current,
        retryAfter: check.retryAfter,
      };
    }
  }

  return { allowed: true, subscription: sub };
}

/**
 * Record a request for rate limiting tracking
 */
export function recordRequest(subscriptionId) {
  const windows = ['minute', 'hour', 'day', 'month'];
  const now = new Date().toISOString();

  for (const type of windows) {
    const windowKey = getWindowKey(type);
    const existing = db.prepare(
      'SELECT id, request_count FROM rate_limit_logs WHERE subscription_id = ? AND window_key = ?'
    ).get(subscriptionId, windowKey);

    if (existing) {
      db.prepare('UPDATE rate_limit_logs SET request_count = request_count + 1 WHERE id = ?').run(existing.id);
    } else {
      db.prepare(
        'INSERT INTO rate_limit_logs (id, subscription_id, window_key, request_count, window_start) VALUES (?, ?, ?, 1, ?)'
      ).run(randomUUID(), subscriptionId, windowKey, now);
    }
  }
}

// ─── Usage Stats ─────────────────────────────────────────────────────────────

export function getSubscriptionUsage(subscriptionId) {
  const minuteKey = getWindowKey('minute');
  const hourKey = getWindowKey('hour');
  const dayKey = getWindowKey('day');
  const monthKey = getWindowKey('month');

  const getCount = (key) => {
    const row = db.prepare('SELECT request_count FROM rate_limit_logs WHERE subscription_id = ? AND window_key = ?').get(subscriptionId, key);
    return row ? row.request_count : 0;
  };

  return {
    currentMinute: getCount(minuteKey),
    currentHour: getCount(hourKey),
    currentDay: getCount(dayKey),
    currentMonth: getCount(monthKey),
  };
}

export function getProductUsageSummary(productId) {
  const subs = listSubscriptionsForProduct(productId);
  const totalRequests = subs.reduce((acc, s) => acc + (s.usage?.currentMonth || 0), 0);
  return {
    totalSubscriptions: subs.length,
    activeSubscriptions: subs.filter(s => s.status === 'active').length,
    totalRequestsThisMonth: totalRequests,
    subscriptions: subs,
  };
}

// ─── Cleanup old rate limit logs ─────────────────────────────────────────────

export function cleanupOldLogs() {
  // Remove logs older than 60 days
  db.prepare("DELETE FROM rate_limit_logs WHERE created_at < datetime('now', '-60 days')").run();
}
