import { Router } from 'express';
import * as productService from '../services/productService.js';
import * as mcpService from '../services/mcpService.js';

const router = Router();

// List all products
router.get('/', (req, res) => {
  try {
    const products = productService.listProducts();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get a specific product
router.get('/:id', (req, res) => {
  try {
    const product = productService.getProduct(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a product
router.post('/', (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const product = productService.createProduct(name, description);
    res.status(201).json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a product
router.delete('/:id', (req, res) => {
  try {
    productService.deleteProduct(req.params.id);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Assign API to product
router.post('/:id/apis', (req, res) => {
  try {
    const { apiId } = req.body;
    if (!apiId) return res.status(400).json({ error: 'apiId is required' });
    const result = productService.assignApiToProduct(req.params.id, apiId);
    if (!result) return res.status(409).json({ error: 'API already assigned to this product' });
    const product = productService.getProduct(req.params.id);
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Unassign API from product
router.delete('/:id/apis/:apiId', (req, res) => {
  try {
    productService.unassignApiFromProduct(req.params.id, req.params.apiId);
    const product = productService.getProduct(req.params.id);
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get available APIs (not yet assigned to this product)
router.get('/:id/available-apis', (req, res) => {
  try {
    const apis = productService.getAvailableApis(req.params.id);
    res.json(apis);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle MCP for a product
router.post('/:id/mcp/toggle', (req, res) => {
  try {
    const { enabled } = req.body;
    const result = productService.toggleMcp(req.params.id, enabled);
    const product = productService.getProduct(req.params.id);
    res.json({ product, mcpServer: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get MCP tools for a product
router.get('/:id/mcp/tools', (req, res) => {
  try {
    const tools = mcpService.generateToolsForProduct(req.params.id);
    res.json(tools);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Test MCP tool execution
router.post('/:id/mcp/test', (req, res) => {
  try {
    const { toolName, args } = req.body;
    const tools = mcpService.generateToolsForProduct(req.params.id);
    const tool = tools.find(t => t.name === toolName);
    if (!tool) return res.status(404).json({ error: `Tool '${toolName}' not found` });

    const result = mcpService.executeToolCall(tool, args || {});
    res.json({
      tool: toolName,
      input: args,
      output: result
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
