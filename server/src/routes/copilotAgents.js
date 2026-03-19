import { Router } from 'express';
import * as copilotAgentService from '../services/copilotAgentService.js';

const router = Router();

// Discover Azure Copilot agents
router.post('/discover', async (req, res) => {
  try {
    const { endpointUrl, accessToken, tenantId } = req.body;
    const agents = await copilotAgentService.discoverAgents(endpointUrl, accessToken, tenantId);
    const imported = copilotAgentService.importAgents(agents);
    res.json({ discovered: imported.length, agents: imported });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List all Azure agents
router.get('/', (req, res) => {
  try {
    res.json(copilotAgentService.listAzureAgents());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single Azure agent
router.get('/:id', (req, res) => {
  try {
    const agent = copilotAgentService.getAzureAgent(req.params.id);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    res.json(agent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Enable agent
router.post('/:id/enable', async (req, res) => {
  try {
    const agent = await copilotAgentService.enableAgent(req.params.id);
    res.json(agent);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Disable agent
router.post('/:id/disable', async (req, res) => {
  try {
    const agent = await copilotAgentService.disableAgent(req.params.id);
    res.json(agent);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Invoke agent
router.post('/:id/invoke', async (req, res) => {
  try {
    const { inputText, sessionId } = req.body;
    if (!inputText) return res.status(400).json({ error: 'inputText is required' });
    const result = await copilotAgentService.invokeAgent(req.params.id, inputText, sessionId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Sync agent status
router.post('/:id/sync', async (req, res) => {
  try {
    const agent = await copilotAgentService.syncAgent(req.params.id);
    res.json(agent);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get agent logs
router.get('/:id/logs', (req, res) => {
  try {
    const logs = copilotAgentService.getAgentLogs(req.params.id);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export agent logs
router.get('/:id/export', (req, res) => {
  try {
    const data = copilotAgentService.exportAgentLogs(req.params.id);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Clear agent logs
router.delete('/:id/logs', (req, res) => {
  try {
    copilotAgentService.clearAgentLogs(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete agent
router.delete('/:id', (req, res) => {
  try {
    copilotAgentService.deleteAzureAgent(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
