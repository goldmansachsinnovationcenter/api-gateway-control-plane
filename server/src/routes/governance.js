import { Router } from 'express';
import * as gov from '../services/governanceService.js';

const router = Router();

// ─── Compliance Policies ─────────────────────────────────────────────────────

router.get('/policies', (req, res) => {
  try {
    res.json(gov.listPolicies());
  } catch (err) {
    console.error('Error listing policies:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/policies', (req, res) => {
  try {
    const policy = gov.createPolicy(req.body);
    res.status(201).json(policy);
  } catch (err) {
    console.error('Error creating policy:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/policies/:id', (req, res) => {
  try {
    const policy = gov.getPolicy(req.params.id);
    if (!policy) return res.status(404).json({ error: 'Policy not found' });
    res.json(policy);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/policies/:id', (req, res) => {
  try {
    const policy = gov.updatePolicy(req.params.id, req.body);
    res.json(policy);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/policies/:id', (req, res) => {
  try {
    gov.deletePolicy(req.params.id);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/policies/evaluate', (req, res) => {
  try {
    const result = gov.evaluatePolicies();
    res.json(result);
  } catch (err) {
    console.error('Error evaluating policies:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Violations ──────────────────────────────────────────────────────────────

router.get('/violations', (req, res) => {
  try {
    const { policyId, status } = req.query;
    res.json(gov.listViolations(policyId, status));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/violations/:id/resolve', (req, res) => {
  try {
    gov.resolveViolation(req.params.id);
    res.json({ status: 'resolved' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/violations/:id/dismiss', (req, res) => {
  try {
    gov.dismissViolation(req.params.id);
    res.json({ status: 'dismissed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── API Lifecycle ───────────────────────────────────────────────────────────

router.get('/lifecycle', (req, res) => {
  try {
    res.json(gov.listApiLifecycles());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/lifecycle/:apiId', (req, res) => {
  try {
    const lifecycle = gov.getApiLifecycle(req.params.apiId);
    res.json(lifecycle);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/lifecycle/:apiId', (req, res) => {
  try {
    const lifecycle = gov.setApiLifecycle(req.params.apiId, req.body);
    res.json(lifecycle);
  } catch (err) {
    console.error('Error setting lifecycle:', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/lifecycle/:apiId', (req, res) => {
  try {
    gov.deleteApiLifecycle(req.params.apiId);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Audit Log ───────────────────────────────────────────────────────────────

router.get('/audit-log', (req, res) => {
  try {
    const { entityType, entityId, action, limit, offset } = req.query;
    const logs = gov.listAuditLogs({
      entityType, entityId, action,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/audit-log/stats', (req, res) => {
  try {
    res.json(gov.getAuditLogStats());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Data Classification ─────────────────────────────────────────────────────

router.get('/classifications', (req, res) => {
  try {
    res.json(gov.listDataClassifications());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/classifications/:apiId', (req, res) => {
  try {
    res.json(gov.getDataClassification(req.params.apiId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/classifications/:apiId', (req, res) => {
  try {
    const classification = gov.setDataClassification(req.params.apiId, req.body);
    res.json(classification);
  } catch (err) {
    console.error('Error setting classification:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Risk Assessment ─────────────────────────────────────────────────────────

router.get('/risk', (req, res) => {
  try {
    res.json(gov.getRiskAssessment());
  } catch (err) {
    console.error('Error getting risk assessment:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Remediation ─────────────────────────────────────────────────────────────

router.get('/remediations/:apiId', (req, res) => {
  try {
    res.json(gov.getRemediations(req.params.apiId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Dependencies ────────────────────────────────────────────────────────────

router.get('/dependencies', (req, res) => {
  try {
    res.json(gov.getAllDependencies());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/dependencies/:apiId', (req, res) => {
  try {
    res.json(gov.getApiDependencies(req.params.apiId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Reports ─────────────────────────────────────────────────────────────────

router.get('/reports/:type', (req, res) => {
  try {
    const report = gov.generateReport(req.params.type);
    res.json(report);
  } catch (err) {
    console.error('Error generating report:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Standards ───────────────────────────────────────────────────────────────

router.get('/standards', (req, res) => {
  try {
    res.json(gov.listStandards());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/standards', (req, res) => {
  try {
    const standard = gov.createStandard(req.body);
    res.status(201).json(standard);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/standards/:id', (req, res) => {
  try {
    const standard = gov.updateStandard(req.params.id, req.body);
    res.json(standard);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/standards/:id', (req, res) => {
  try {
    gov.deleteStandard(req.params.id);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
