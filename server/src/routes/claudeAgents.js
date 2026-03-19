import { Router } from 'express';
import * as claudeAgentService from '../services/claudeAgentService.js';

const router = Router();

// Discover Claude invocations
router.post('/discover', async (req, res) => {
  try {
    const { accessKeyId, secretAccessKey, region } = req.body;
    const credentials = accessKeyId ? { accessKeyId, secretAccessKey, region } : null;
    const invocations = await claudeAgentService.discoverInvocations(credentials);
    const imported = claudeAgentService.importInvocations(invocations);
    res.json({ discovered: imported.length, invocations: imported });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get usage stats
router.get('/stats', (req, res) => {
  try {
    res.json(claudeAgentService.getUsageStats());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List all invocations
router.get('/', (req, res) => {
  try {
    res.json(claudeAgentService.listInvocations());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single invocation
router.get('/:id', (req, res) => {
  try {
    const inv = claudeAgentService.getInvocation(req.params.id);
    if (!inv) return res.status(404).json({ error: 'Invocation not found' });
    res.json(inv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Sync invocation
router.post('/:id/sync', async (req, res) => {
  try {
    const inv = await claudeAgentService.syncInvocation(req.params.id);
    res.json(inv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete invocation
router.delete('/:id', (req, res) => {
  try {
    claudeAgentService.deleteInvocation(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
