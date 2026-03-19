import { Router } from 'express';
import * as devinAgentService from '../services/devinAgentService.js';

const router = Router();

// Discover Devin sessions
router.post('/discover', async (req, res) => {
  try {
    const { apiKey } = req.body;
    const sessions = await devinAgentService.discoverSessions(apiKey);
    const imported = devinAgentService.importSessions(sessions);
    res.json({ discovered: imported.length, sessions: imported });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List all sessions
router.get('/', (req, res) => {
  try {
    res.json(devinAgentService.listSessions());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get usage stats / analytics
router.get('/stats', (req, res) => {
  try {
    res.json(devinAgentService.getUsageStats());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single session
router.get('/:id', (req, res) => {
  try {
    const session = devinAgentService.getSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Sync session
router.post('/:id/sync', async (req, res) => {
  try {
    const session = await devinAgentService.syncSession(req.params.id);
    res.json(session);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete session
router.delete('/:id', (req, res) => {
  try {
    devinAgentService.deleteSession(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
