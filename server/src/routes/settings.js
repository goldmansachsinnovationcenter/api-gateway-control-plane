import { Router } from 'express';
import * as settingsService from '../services/settingsService.js';

const router = Router();

// ==================== USERS ====================

router.get('/users', (req, res) => {
  try {
    const users = settingsService.listUsers();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/users/stats', (req, res) => {
  try {
    const stats = settingsService.getUserStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/users/:id', (req, res) => {
  try {
    const user = settingsService.getUser(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/users', (req, res) => {
  try {
    const { email, name, role } = req.body;
    if (!email || !name) return res.status(400).json({ error: 'Email and name are required' });
    const existing = settingsService.getUserByEmail(email);
    if (existing) return res.status(409).json({ error: 'User with this email already exists' });
    const user = settingsService.createUser({ email, name, role });
    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/users/:id', (req, res) => {
  try {
    const user = settingsService.updateUser(req.params.id, req.body);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/users/:id', (req, res) => {
  try {
    const user = settingsService.deleteUser(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== API KEYS ====================

router.get('/api-keys', (req, res) => {
  try {
    const keys = settingsService.listApiKeys();
    res.json(keys);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api-keys', (req, res) => {
  try {
    const { name, userId, scopes, rateLimit, expiresAt } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const key = settingsService.createApiKey({ name, userId, scopes, rateLimit, expiresAt });
    res.status(201).json(key);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api-keys/:id/revoke', (req, res) => {
  try {
    const key = settingsService.revokeApiKey(req.params.id);
    res.json(key);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/api-keys/:id', (req, res) => {
  try {
    settingsService.deleteApiKey(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== APP SETTINGS ====================

router.get('/app', (req, res) => {
  try {
    const settings = settingsService.getAllSettings();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/app/:category', (req, res) => {
  try {
    const settings = settingsService.getSettingsByCategory(req.params.category);
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/app', (req, res) => {
  try {
    const { updates, updatedBy } = req.body;
    if (!updates || !Array.isArray(updates)) return res.status(400).json({ error: 'Updates array is required' });
    const results = settingsService.updateSettingsBatch(updates, updatedBy);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/app/setting/:key', (req, res) => {
  try {
    const { value, updatedBy } = req.body;
    if (value === undefined) return res.status(400).json({ error: 'Value is required' });
    const setting = settingsService.updateSetting(req.params.key, value, updatedBy);
    if (!setting) return res.status(404).json({ error: 'Setting not found' });
    res.json(setting);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== WEBHOOKS ====================

router.get('/webhooks', (req, res) => {
  try {
    const webhooks = settingsService.listWebhooks();
    res.json(webhooks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/webhooks', (req, res) => {
  try {
    const { name, url, events, secret } = req.body;
    if (!name || !url) return res.status(400).json({ error: 'Name and URL are required' });
    const webhook = settingsService.createWebhook({ name, url, events, secret });
    res.status(201).json(webhook);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/webhooks/:id', (req, res) => {
  try {
    const webhook = settingsService.updateWebhook(req.params.id, req.body);
    res.json(webhook);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/webhooks/:id/test', (req, res) => {
  try {
    const result = settingsService.testWebhook(req.params.id);
    if (!result) return res.status(404).json({ error: 'Webhook not found' });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/webhooks/:id', (req, res) => {
  try {
    settingsService.deleteWebhook(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== AUDIT LOG ====================

router.get('/audit-log', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const category = req.query.category;
    const logs = settingsService.getSettingsAuditLog(limit, offset, category);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== SYSTEM INFO ====================

router.get('/system', (req, res) => {
  try {
    const info = settingsService.getSystemInfo();
    res.json(info);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
