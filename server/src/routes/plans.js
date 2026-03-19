import { Router } from 'express';
import * as planService from '../services/planService.js';

const router = Router();

// ─── Plans CRUD (nested under products) ─────────────────────────────────────

// List plans for a product
router.get('/products/:productId/plans', (req, res) => {
  try {
    const plans = planService.listPlansForProduct(req.params.productId);
    res.json(plans);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get a specific plan
router.get('/plans/:id', (req, res) => {
  try {
    const plan = planService.getPlan(req.params.id);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    res.json(plan);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a plan for a product
router.post('/products/:productId/plans', (req, res) => {
  try {
    const { name, description, rateLimitPerMinute, rateLimitPerHour, rateLimitPerDay, quotaPerMonth, throttleBurstLimit } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const plan = planService.createPlan(req.params.productId, {
      name, description, rateLimitPerMinute, rateLimitPerHour, rateLimitPerDay, quotaPerMonth, throttleBurstLimit
    });
    res.status(201).json(plan);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update a plan
router.put('/plans/:id', (req, res) => {
  try {
    const plan = planService.updatePlan(req.params.id, req.body);
    res.json(plan);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a plan
router.delete('/plans/:id', (req, res) => {
  try {
    planService.deletePlan(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Subscriptions ──────────────────────────────────────────────────────────

// List subscriptions for a plan
router.get('/plans/:planId/subscriptions', (req, res) => {
  try {
    const subs = planService.listSubscriptionsForPlan(req.params.planId);
    res.json(subs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List all subscriptions for a product
router.get('/products/:productId/subscriptions', (req, res) => {
  try {
    const subs = planService.listSubscriptionsForProduct(req.params.productId);
    res.json(subs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create subscription (subscribe an app to a plan)
router.post('/plans/:planId/subscriptions', (req, res) => {
  try {
    const { applicationName } = req.body;
    if (!applicationName) return res.status(400).json({ error: 'applicationName is required' });
    const sub = planService.createSubscription(req.params.planId, applicationName);
    res.status(201).json(sub);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get subscription details
router.get('/subscriptions/:id', (req, res) => {
  try {
    const sub = planService.getSubscription(req.params.id);
    if (!sub) return res.status(404).json({ error: 'Subscription not found' });
    res.json(sub);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update subscription status (activate/deactivate)
router.put('/subscriptions/:id/status', (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'suspended', 'revoked'].includes(status)) {
      return res.status(400).json({ error: 'Status must be active, suspended, or revoked' });
    }
    const sub = planService.updateSubscriptionStatus(req.params.id, status);
    res.json(sub);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete subscription
router.delete('/subscriptions/:id', (req, res) => {
  try {
    planService.deleteSubscription(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Usage Stats ────────────────────────────────────────────────────────────

// Get product usage summary
router.get('/products/:productId/usage', (req, res) => {
  try {
    const usage = planService.getProductUsageSummary(req.params.productId);
    res.json(usage);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
