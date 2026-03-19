import { Router } from 'express';
import * as mcpService from '../services/mcpService.js';

const router = Router();

/**
 * MCP Protocol endpoint (JSON-RPC style)
 * This simulates a real MCP server endpoint that agents can connect to
 */
router.post('/:productId', (req, res) => {
  try {
    const { productId } = req.params;
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');

    // Validate API key
    if (!mcpService.validateMcpApiKey(productId, apiKey)) {
      return res.status(401).json({
        jsonrpc: '2.0',
        error: { code: -32001, message: 'Unauthorized: Invalid API key' },
        id: req.body.id
      });
    }

    const { method, params, id } = req.body;

    switch (method) {
      case 'initialize': {
        res.json({
          jsonrpc: '2.0',
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: { listChanged: false }
            },
            serverInfo: {
              name: `api-control-plane-${productId}`,
              version: '1.0.0'
            }
          },
          id
        });
        break;
      }

      case 'tools/list': {
        const tools = mcpService.generateToolsForProduct(productId);
        res.json({
          jsonrpc: '2.0',
          result: {
            tools: tools.map(t => ({
              name: t.name,
              description: t.description,
              inputSchema: t.inputSchema,
              annotations: t.annotations
            }))
          },
          id
        });
        break;
      }

      case 'tools/call': {
        const { name, arguments: args } = params || {};
        const tools = mcpService.generateToolsForProduct(productId);
        const tool = tools.find(t => t.name === name);

        if (!tool) {
          res.json({
            jsonrpc: '2.0',
            error: { code: -32602, message: `Tool '${name}' not found` },
            id
          });
          return;
        }

        const result = mcpService.executeToolCall(tool, args || {});
        res.json({
          jsonrpc: '2.0',
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result.data, null, 2)
              }
            ],
            isError: false
          },
          id
        });
        break;
      }

      default:
        res.json({
          jsonrpc: '2.0',
          error: { code: -32601, message: `Method '${method}' not found` },
          id
        });
    }
  } catch (err) {
    res.status(500).json({
      jsonrpc: '2.0',
      error: { code: -32603, message: err.message },
      id: req.body?.id
    });
  }
});

// SSE endpoint for MCP server (for streaming)
router.get('/:productId/sse', (req, res) => {
  const { productId } = req.params;
  const apiKey = req.query.apiKey;

  if (!mcpService.validateMcpApiKey(productId, apiKey)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  // Send initial server info
  const serverInfo = {
    protocolVersion: '2024-11-05',
    capabilities: { tools: { listChanged: false } },
    serverInfo: { name: `api-control-plane-${productId}`, version: '1.0.0' }
  };
  res.write(`data: ${JSON.stringify(serverInfo)}\n\n`);

  // Keep alive
  const keepAlive = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 30000);

  req.on('close', () => {
    clearInterval(keepAlive);
  });
});

export default router;
