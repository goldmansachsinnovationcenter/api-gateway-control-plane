import { Router } from 'express';
import * as gatewayService from '../services/gatewayService.js';

const router = Router();

// List all gateways
router.get('/', (req, res) => {
  try {
    const gateways = gatewayService.listGateways();
    res.json(gateways);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get a specific gateway with its APIs
router.get('/:id', (req, res) => {
  try {
    const gateway = gatewayService.getGateway(req.params.id);
    if (!gateway) return res.status(404).json({ error: 'Gateway not found' });
    res.json(gateway);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Register a new gateway
router.post('/', (req, res) => {
  try {
    const { name, type, config } = req.body;
    if (!name || !type) {
      return res.status(400).json({ error: 'Name and type are required' });
    }
    if (!['aws', 'kong', 'custom'].includes(type)) {
      return res.status(400).json({ error: 'Type must be aws, kong, or custom' });
    }
    const result = gatewayService.registerGateway(name, type, config || {});
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a gateway
router.delete('/:id', (req, res) => {
  try {
    gatewayService.deleteGateway(req.params.id);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
