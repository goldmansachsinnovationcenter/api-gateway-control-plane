import { Router } from 'express';
import * as gatewayService from '../services/gatewayService.js';

const router = Router();

// List all APIs (optionally filtered by gateway)
router.get('/', (req, res) => {
  try {
    const { gateway_id } = req.query;
    const apis = gatewayService.listApis(gateway_id);
    res.json(apis);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get a specific API
router.get('/:id', (req, res) => {
  try {
    const api = gatewayService.getApi(req.params.id);
    if (!api) return res.status(404).json({ error: 'API not found' });
    // Parse the spec for the response
    res.json({
      ...api,
      spec: api.spec ? JSON.parse(api.spec) : null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update API spec
router.put('/:id/spec', (req, res) => {
  try {
    const { spec } = req.body;
    if (!spec) return res.status(400).json({ error: 'Spec is required' });
    const specStr = typeof spec === 'string' ? spec : JSON.stringify(spec);
    const updated = gatewayService.updateApiSpec(req.params.id, specStr);
    if (!updated) return res.status(404).json({ error: 'API not found' });
    res.json({
      ...updated,
      spec: updated.spec ? JSON.parse(updated.spec) : null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
