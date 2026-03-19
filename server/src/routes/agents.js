import { Router } from 'express';
import * as agentService from '../services/agentService.js';

const router = Router();

// List all agents
router.get('/', (req, res) => {
  try {
    const agents = agentService.listAgents();
    res.json(agents);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get a specific agent
router.get('/:id', (req, res) => {
  try {
    const agent = agentService.getAgent(req.params.id);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    res.json(agent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create an agent
router.post('/', (req, res) => {
  try {
    const { name, description, productId, model, systemPrompt } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const agent = agentService.createAgent(name, description, productId, model, systemPrompt);
    res.status(201).json(agent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update an agent
router.put('/:id', (req, res) => {
  try {
    const agent = agentService.updateAgent(req.params.id, req.body);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    res.json(agent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete an agent
router.delete('/:id', (req, res) => {
  try {
    agentService.deleteAgent(req.params.id);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get agent logs
router.get('/:id/logs', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const logs = agentService.getAgentLogs(req.params.id, limit);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Clear agent logs
router.delete('/:id/logs', (req, res) => {
  try {
    agentService.clearAgentLogs(req.params.id);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Execute a specific tool
router.post('/:id/execute', (req, res) => {
  try {
    const { toolName, args } = req.body;
    if (!toolName) return res.status(400).json({ error: 'toolName is required' });
    const result = agentService.executeAgentTool(req.params.id, toolName, args || {});
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Run all tools
router.post('/:id/run-all', (req, res) => {
  try {
    const results = agentService.runAgentAllTools(req.params.id);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Clone an agent
router.post('/:id/clone', (req, res) => {
  try {
    const agent = agentService.cloneAgent(req.params.id);
    res.status(201).json(agent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export agent logs
router.get('/:id/export', (req, res) => {
  try {
    const data = agentService.exportAgentLogs(req.params.id);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
