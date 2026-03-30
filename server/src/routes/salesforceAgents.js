import { Router } from 'express';
import * as salesforceAgentService from '../services/salesforceAgentService.js';

const router = Router();

// Discover Salesforce agents
router.post('/discover', async (req, res) => {
  try {
    const { instanceUrl, accessToken } = req.body;
    const agents = await salesforceAgentService.discoverAgents(instanceUrl, accessToken);
    const imported = salesforceAgentService.importAgents(agents);
    res.json({ discovered: imported.length, agents: imported });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List all Salesforce agents
router.get('/', (req, res) => {
  try {
    res.json(salesforceAgentService.listSalesforceAgents());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single Salesforce agent
router.get('/:id', (req, res) => {
  try {
    const agent = salesforceAgentService.getSalesforceAgent(req.params.id);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    res.json(agent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Enable agent
router.post('/:id/enable', async (req, res) => {
  try {
    const agent = await salesforceAgentService.enableAgent(req.params.id);
    res.json(agent);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Disable agent
router.post('/:id/disable', async (req, res) => {
  try {
    const agent = await salesforceAgentService.disableAgent(req.params.id);
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
    const result = await salesforceAgentService.invokeAgent(req.params.id, inputText, sessionId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Sync agent status
router.post('/:id/sync', async (req, res) => {
  try {
    const agent = await salesforceAgentService.syncAgent(req.params.id);
    res.json(agent);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get agent logs
router.get('/:id/logs', (req, res) => {
  try {
    const logs = salesforceAgentService.getAgentLogs(req.params.id);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export agent logs
router.get('/:id/export', (req, res) => {
  try {
    const data = salesforceAgentService.exportAgentLogs(req.params.id);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Clear agent logs
router.delete('/:id/logs', (req, res) => {
  try {
    salesforceAgentService.clearAgentLogs(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete agent
router.delete('/:id', (req, res) => {
  try {
    salesforceAgentService.deleteSalesforceAgent(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
