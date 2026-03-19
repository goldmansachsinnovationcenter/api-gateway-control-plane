import { Router } from 'express';
import * as agentCoreService from '../services/agentCoreService.js';

const router = Router();

// ─── Runtime Discovery ──────────────────────────────────────────────────────

router.post('/discover/runtimes', async (req, res) => {
  try {
    const { gatewayId } = req.body;
    const result = await agentCoreService.discoverRuntimes(gatewayId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Gateway (MCP Server) Discovery ─────────────────────────────────────────

router.post('/discover/gateways', async (req, res) => {
  try {
    const { gatewayId } = req.body;
    const result = await agentCoreService.discoverGateways(gatewayId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Runtimes CRUD ──────────────────────────────────────────────────────────

router.get('/runtimes', (req, res) => {
  try {
    const runtimes = agentCoreService.listRuntimes();
    res.json(runtimes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/runtimes/:id', (req, res) => {
  try {
    const runtime = agentCoreService.getRuntime(req.params.id);
    if (!runtime) return res.status(404).json({ error: 'Runtime not found' });
    res.json(runtime);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/runtimes/:id/invoke', async (req, res) => {
  try {
    const { inputText, sessionId } = req.body;
    if (!inputText) return res.status(400).json({ error: 'inputText is required' });
    const result = await agentCoreService.invokeRuntime(req.params.id, inputText, sessionId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/runtimes/:id/sync', async (req, res) => {
  try {
    const runtime = await agentCoreService.syncRuntime(req.params.id);
    res.json(runtime);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/runtimes/:id/logs', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const logs = agentCoreService.getRuntimeLogs(req.params.id, limit);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/runtimes/:id/logs', (req, res) => {
  try {
    agentCoreService.clearRuntimeLogs(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/runtimes/:id/export', (req, res) => {
  try {
    const data = agentCoreService.exportRuntimeLogs(req.params.id);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/runtimes/:id', (req, res) => {
  try {
    agentCoreService.deleteRuntime(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Gateways CRUD ──────────────────────────────────────────────────────────

router.get('/gateways', (req, res) => {
  try {
    const gateways = agentCoreService.listGateways();
    res.json(gateways);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/gateways/:id', (req, res) => {
  try {
    const gw = agentCoreService.getGateway(req.params.id);
    if (!gw) return res.status(404).json({ error: 'Gateway not found' });
    res.json(gw);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/gateways/:id/sync', async (req, res) => {
  try {
    const gw = await agentCoreService.syncGateway(req.params.id);
    res.json(gw);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/gateways/:id', (req, res) => {
  try {
    agentCoreService.deleteGateway(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
