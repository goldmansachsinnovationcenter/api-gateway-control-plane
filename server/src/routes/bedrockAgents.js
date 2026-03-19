import { Router } from 'express';
import * as bedrockAgentService from '../services/bedrockAgentService.js';

const router = Router();

// Discover and import Bedrock agents from an AWS gateway
router.post('/discover', async (req, res) => {
  try {
    const { gatewayId, credentials } = req.body;
    if (!gatewayId) return res.status(400).json({ error: 'gatewayId is required' });

    const agents = await bedrockAgentService.discoverAgents(gatewayId, credentials);
    const imported = bedrockAgentService.importAgents(gatewayId, agents);
    res.json({ discovered: agents.length, imported });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List all cloud agents
router.get('/', (req, res) => {
  try {
    const agents = bedrockAgentService.listCloudAgents();
    res.json(agents);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get a specific cloud agent
router.get('/:id', (req, res) => {
  try {
    const agent = bedrockAgentService.getCloudAgent(req.params.id);
    if (!agent) return res.status(404).json({ error: 'Cloud agent not found' });
    res.json(agent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Enable a cloud agent
router.post('/:id/enable', async (req, res) => {
  try {
    const { credentials } = req.body || {};
    const agent = await bedrockAgentService.enableAgent(req.params.id, credentials);
    res.json(agent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Disable a cloud agent
router.post('/:id/disable', async (req, res) => {
  try {
    const { credentials } = req.body || {};
    const agent = await bedrockAgentService.disableAgent(req.params.id, credentials);
    res.json(agent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Invoke a cloud agent
router.post('/:id/invoke', async (req, res) => {
  try {
    const { inputText, sessionId, credentials } = req.body;
    if (!inputText) return res.status(400).json({ error: 'inputText is required' });
    const result = await bedrockAgentService.invokeAgent(req.params.id, inputText, sessionId, credentials);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Sync agent status from AWS
router.post('/:id/sync', async (req, res) => {
  try {
    const { credentials } = req.body || {};
    const agent = await bedrockAgentService.syncAgent(req.params.id, credentials);
    res.json(agent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get agent logs
router.get('/:id/logs', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const logs = bedrockAgentService.getCloudAgentLogs(req.params.id, limit);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Clear agent logs
router.delete('/:id/logs', (req, res) => {
  try {
    bedrockAgentService.clearCloudAgentLogs(req.params.id);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export agent logs
router.get('/:id/export', (req, res) => {
  try {
    const data = bedrockAgentService.exportCloudAgentLogs(req.params.id);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a cloud agent (from local DB only)
router.delete('/:id', (req, res) => {
  try {
    bedrockAgentService.deleteCloudAgent(req.params.id);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
