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

// Get analytics for a specific API (mock data)
router.get('/:id/analytics', (req, res) => {
  try {
    const api = gatewayService.getApi(req.params.id);
    if (!api) return res.status(404).json({ error: 'API not found' });

    const now = new Date();

    // Generate realistic mock analytics
    const hourlyRequests = [];
    for (let h = 23; h >= 0; h--) {
      const hour = new Date(now.getTime() - h * 3600000);
      const baseLoad = h >= 8 && h <= 18 ? 800 : 200; // business hours
      hourlyRequests.push({
        timestamp: hour.toISOString(),
        requests: Math.floor(baseLoad + Math.random() * 400),
        errors: Math.floor(Math.random() * (baseLoad / 20)),
        avgLatencyMs: Math.floor(50 + Math.random() * 150),
        p95LatencyMs: Math.floor(150 + Math.random() * 300),
        p99LatencyMs: Math.floor(300 + Math.random() * 500),
      });
    }

    const dailyRequests = [];
    for (let d = 29; d >= 0; d--) {
      const day = new Date(now.getTime() - d * 86400000);
      const isWeekend = day.getDay() === 0 || day.getDay() === 6;
      const baseLoad = isWeekend ? 3000 : 12000;
      dailyRequests.push({
        date: day.toISOString().split('T')[0],
        requests: Math.floor(baseLoad + Math.random() * 5000),
        errors: Math.floor(Math.random() * (baseLoad / 50)),
        avgLatencyMs: Math.floor(60 + Math.random() * 100),
      });
    }

    const totalRequests = dailyRequests.reduce((s, d) => s + d.requests, 0);
    const totalErrors = dailyRequests.reduce((s, d) => s + d.errors, 0);

    const statusCodes = {
      '200': Math.floor(totalRequests * 0.85),
      '201': Math.floor(totalRequests * 0.05),
      '400': Math.floor(totalRequests * 0.04),
      '401': Math.floor(totalRequests * 0.02),
      '403': Math.floor(totalRequests * 0.01),
      '404': Math.floor(totalRequests * 0.02),
      '500': Math.floor(totalRequests * 0.01),
    };

    const topConsumers = [
      { name: 'payment-service', requests: Math.floor(totalRequests * 0.25), avgLatencyMs: 78 },
      { name: 'web-frontend', requests: Math.floor(totalRequests * 0.20), avgLatencyMs: 95 },
      { name: 'mobile-app', requests: Math.floor(totalRequests * 0.18), avgLatencyMs: 120 },
      { name: 'analytics-pipeline', requests: Math.floor(totalRequests * 0.12), avgLatencyMs: 45 },
      { name: 'partner-integration', requests: Math.floor(totalRequests * 0.08), avgLatencyMs: 180 },
      { name: 'monitoring-agent', requests: Math.floor(totalRequests * 0.05), avgLatencyMs: 30 },
    ];

    const latencyPercentiles = {
      p50: Math.floor(45 + Math.random() * 30),
      p75: Math.floor(80 + Math.random() * 50),
      p90: Math.floor(150 + Math.random() * 100),
      p95: Math.floor(250 + Math.random() * 150),
      p99: Math.floor(450 + Math.random() * 300),
    };

    res.json({
      apiId: api.id,
      apiName: api.name,
      method: api.method,
      path: api.path,
      summary: {
        totalRequests,
        totalErrors,
        errorRate: Number(((totalErrors / totalRequests) * 100).toFixed(2)),
        avgLatencyMs: Math.floor(dailyRequests.reduce((s, d) => s + d.avgLatencyMs, 0) / dailyRequests.length),
        uptime: Number((99.5 + Math.random() * 0.49).toFixed(2)),
        requestsPerSecond: Number((totalRequests / (30 * 86400)).toFixed(2)),
      },
      latencyPercentiles,
      statusCodes,
      topConsumers,
      hourlyRequests,
      dailyRequests,
    });
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
