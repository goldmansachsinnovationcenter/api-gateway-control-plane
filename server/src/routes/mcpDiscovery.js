import { Router } from 'express';
import * as mcpDiscoveryService from '../services/mcpDiscoveryService.js';

const router = Router();

/**
 * POST /discover - Connect to an MCP server and discover its tools
 */
router.post('/discover', async (req, res) => {
  try {
    const { serverUrl, apiKey } = req.body;
    if (!serverUrl) {
      return res.status(400).json({ error: 'serverUrl is required' });
    }

    const result = await mcpDiscoveryService.discoverTools(serverUrl, apiKey);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /call - Call a tool on an external MCP server
 */
router.post('/call', async (req, res) => {
  try {
    const { serverUrl, apiKey, toolName, args } = req.body;
    if (!serverUrl || !toolName) {
      return res.status(400).json({ error: 'serverUrl and toolName are required' });
    }

    const result = await mcpDiscoveryService.callTool(serverUrl, apiKey, toolName, args);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /connections - Save an MCP server connection
 */
router.post('/connections', (req, res) => {
  try {
    const { name, url, apiKey, description } = req.body;
    if (!name || !url) {
      return res.status(400).json({ error: 'name and url are required' });
    }

    const connection = mcpDiscoveryService.saveConnection(name, url, apiKey, description);
    res.status(201).json(connection);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /connections - List all saved MCP server connections
 */
router.get('/connections', (req, res) => {
  try {
    const connections = mcpDiscoveryService.listConnections();
    res.json(connections);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /connections/:id - Get a specific connection
 */
router.get('/connections/:id', (req, res) => {
  try {
    const connection = mcpDiscoveryService.getConnection(req.params.id);
    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }
    res.json(connection);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /connections/:id - Delete a saved connection
 */
router.delete('/connections/:id', (req, res) => {
  try {
    mcpDiscoveryService.deleteConnection(req.params.id);
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
