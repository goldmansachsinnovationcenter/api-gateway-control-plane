import { randomUUID } from 'crypto';
import db from '../models/database.js';

// ─── Compliance Policies ─────────────────────────────────────────────────────

export function createPolicy({ name, description, ruleType, ruleConfig, severity, enabled }) {
  const id = randomUUID();
  db.prepare(`
    INSERT INTO compliance_policies (id, name, description, rule_type, rule_config, severity, enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, description || null, ruleType, JSON.stringify(ruleConfig || {}), severity || 'medium', enabled !== false ? 1 : 0);
  logAudit('compliance_policy', id, 'created', 'system', { name, ruleType, severity });
  return getPolicy(id);
}

export function getPolicy(id) {
  const policy = db.prepare('SELECT * FROM compliance_policies WHERE id = ?').get(id);
  if (!policy) return null;
  policy.rule_config = JSON.parse(policy.rule_config || '{}');
  const violationCount = db.prepare('SELECT COUNT(*) as count FROM policy_violations WHERE policy_id = ? AND status = ?').get(id, 'open').count;
  return { ...policy, violationCount };
}

export function listPolicies() {
  const policies = db.prepare('SELECT * FROM compliance_policies ORDER BY created_at DESC').all();
  return policies.map(p => {
    p.rule_config = JSON.parse(p.rule_config || '{}');
    const violationCount = db.prepare('SELECT COUNT(*) as count FROM policy_violations WHERE policy_id = ? AND status = ?').get(p.id, 'open').count;
    return { ...p, violationCount };
  });
}

export function updatePolicy(id, updates) {
  const old = getPolicy(id);
  const fields = [];
  const values = [];
  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
  if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description); }
  if (updates.ruleType !== undefined) { fields.push('rule_type = ?'); values.push(updates.ruleType); }
  if (updates.ruleConfig !== undefined) { fields.push('rule_config = ?'); values.push(JSON.stringify(updates.ruleConfig)); }
  if (updates.severity !== undefined) { fields.push('severity = ?'); values.push(updates.severity); }
  if (updates.enabled !== undefined) { fields.push('enabled = ?'); values.push(updates.enabled ? 1 : 0); }
  if (fields.length === 0) return getPolicy(id);
  fields.push("updated_at = datetime('now')");
  values.push(id);
  db.prepare(`UPDATE compliance_policies SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  logAudit('compliance_policy', id, 'updated', 'system', { old: old?.name, changes: updates });
  return getPolicy(id);
}

export function deletePolicy(id) {
  logAudit('compliance_policy', id, 'deleted', 'system', {});
  db.prepare('DELETE FROM compliance_policies WHERE id = ?').run(id);
}

export function evaluatePolicies() {
  const policies = db.prepare('SELECT * FROM compliance_policies WHERE enabled = 1').all();
  const apis = db.prepare(`
    SELECT a.*, g.name as gateway_name, g.type as gateway_type 
    FROM apis a JOIN gateways g ON a.gateway_id = g.id
  `).all();
  let totalViolations = 0;

  for (const policy of policies) {
    const config = JSON.parse(policy.rule_config || '{}');
    for (const api of apis) {
      const violation = checkPolicyViolation(policy, config, api);
      if (violation) {
        const existing = db.prepare(
          'SELECT id FROM policy_violations WHERE policy_id = ? AND api_id = ? AND status = ?'
        ).get(policy.id, api.id, 'open');
        if (!existing) {
          const vid = randomUUID();
          db.prepare(`
            INSERT INTO policy_violations (id, policy_id, api_id, violation_details, status)
            VALUES (?, ?, ?, ?, 'open')
          `).run(vid, policy.id, api.id, JSON.stringify(violation));
          totalViolations++;
        }
      }
    }
  }
  return { evaluated: policies.length, apisChecked: apis.length, newViolations: totalViolations };
}

function checkPolicyViolation(policy, config, api) {
  switch (policy.rule_type) {
    case 'min_security_score':
      if (api.security_score < (config.threshold || 70)) {
        return { message: `Security score ${api.security_score}% is below minimum ${config.threshold || 70}%`, actual: api.security_score, threshold: config.threshold || 70 };
      }
      break;
    case 'min_quality_score':
      if (api.quality_score < (config.threshold || 70)) {
        return { message: `Quality score ${api.quality_score}% is below minimum ${config.threshold || 70}%`, actual: api.quality_score, threshold: config.threshold || 70 };
      }
      break;
    case 'require_auth':
      if (api.security_score < 60) {
        return { message: 'API likely does not require authentication (low security score)', actual: api.security_score };
      }
      break;
    case 'require_description':
      if (!api.description || api.description.trim().length < 10) {
        return { message: 'API is missing a meaningful description', actual: api.description || '' };
      }
      break;
    case 'require_https':
      if (api.security_score < 50) {
        return { message: 'API may not enforce HTTPS (very low security score)', actual: api.security_score };
      }
      break;
    case 'naming_convention': {
      const pattern = config.pattern || '^[a-z][a-zA-Z0-9]*$';
      const re = new RegExp(pattern);
      const pathSegments = api.path.split('/').filter(s => s && !s.startsWith('{'));
      const violations = pathSegments.filter(s => !re.test(s));
      if (violations.length > 0) {
        return { message: `Path segments violate naming convention: ${violations.join(', ')}`, segments: violations, pattern };
      }
      break;
    }
    case 'max_path_depth': {
      const depth = api.path.split('/').filter(Boolean).length;
      if (depth > (config.maxDepth || 5)) {
        return { message: `Path depth ${depth} exceeds maximum ${config.maxDepth || 5}`, actual: depth, max: config.maxDepth || 5 };
      }
      break;
    }
    default:
      break;
  }
  return null;
}

export function listViolations(policyId, status) {
  let query = `
    SELECT v.*, p.name as policy_name, p.severity, p.rule_type,
           a.name as api_name, a.method, a.path, a.gateway_id
    FROM policy_violations v
    JOIN compliance_policies p ON v.policy_id = p.id
    JOIN apis a ON v.api_id = a.id
  `;
  const params = [];
  const conditions = [];
  if (policyId) { conditions.push('v.policy_id = ?'); params.push(policyId); }
  if (status) { conditions.push('v.status = ?'); params.push(status); }
  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY v.created_at DESC';
  return db.prepare(query).all(params).map(v => {
    v.violation_details = JSON.parse(v.violation_details || '{}');
    return v;
  });
}

export function resolveViolation(id) {
  db.prepare("UPDATE policy_violations SET status = 'resolved', resolved_at = datetime('now') WHERE id = ?").run(id);
  logAudit('policy_violation', id, 'resolved', 'system', {});
}

export function dismissViolation(id) {
  db.prepare("UPDATE policy_violations SET status = 'dismissed', resolved_at = datetime('now') WHERE id = ?").run(id);
  logAudit('policy_violation', id, 'dismissed', 'system', {});
}

// ─── API Lifecycle ───────────────────────────────────────────────────────────

export function setApiLifecycle(apiId, { version, status, deprecationDate, sunsetDate, successorApiId, notes }) {
  const existing = db.prepare('SELECT id FROM api_lifecycle WHERE api_id = ?').get(apiId);
  if (existing) {
    db.prepare(`
      UPDATE api_lifecycle SET version = ?, status = ?, deprecation_date = ?, sunset_date = ?,
        successor_api_id = ?, notes = ?, updated_at = datetime('now')
      WHERE api_id = ?
    `).run(version || null, status || 'active', deprecationDate || null, sunsetDate || null, successorApiId || null, notes || null, apiId);
    logAudit('api_lifecycle', apiId, 'updated', 'system', { version, status });
    return getApiLifecycle(apiId);
  }
  const id = randomUUID();
  db.prepare(`
    INSERT INTO api_lifecycle (id, api_id, version, status, deprecation_date, sunset_date, successor_api_id, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, apiId, version || '1.0.0', status || 'active', deprecationDate || null, sunsetDate || null, successorApiId || null, notes || null);
  logAudit('api_lifecycle', apiId, 'created', 'system', { version, status });
  return getApiLifecycle(apiId);
}

export function getApiLifecycle(apiId) {
  return db.prepare(`
    SELECT l.*, a.name as api_name, a.method, a.path
    FROM api_lifecycle l
    JOIN apis a ON l.api_id = a.id
    WHERE l.api_id = ?
  `).get(apiId) || null;
}

export function listApiLifecycles() {
  return db.prepare(`
    SELECT l.*, a.name as api_name, a.method, a.path, a.security_score, a.quality_score,
           g.name as gateway_name
    FROM api_lifecycle l
    JOIN apis a ON l.api_id = a.id
    JOIN gateways g ON a.gateway_id = g.id
    ORDER BY 
      CASE l.status WHEN 'sunset' THEN 0 WHEN 'deprecated' THEN 1 WHEN 'active' THEN 2 WHEN 'retired' THEN 3 END,
      l.updated_at DESC
  `).all();
}

export function deleteApiLifecycle(apiId) {
  db.prepare('DELETE FROM api_lifecycle WHERE api_id = ?').run(apiId);
}

// ─── Audit Log ───────────────────────────────────────────────────────────────

export function logAudit(entityType, entityId, action, actor, changes) {
  const id = randomUUID();
  db.prepare(`
    INSERT INTO governance_audit_log (id, entity_type, entity_id, action, actor, changes)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, entityType, entityId, action, actor || 'system', JSON.stringify(changes || {}));
}

export function listAuditLogs({ entityType, entityId, action, limit, offset } = {}) {
  let query = 'SELECT * FROM governance_audit_log';
  const params = [];
  const conditions = [];
  if (entityType) { conditions.push('entity_type = ?'); params.push(entityType); }
  if (entityId) { conditions.push('entity_id = ?'); params.push(entityId); }
  if (action) { conditions.push('action = ?'); params.push(action); }
  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY created_at DESC';
  if (limit) { query += ' LIMIT ?'; params.push(limit); }
  if (offset) { query += ' OFFSET ?'; params.push(offset); }

  const logs = db.prepare(query).all(...params);
  return logs.map(l => {
    l.changes = JSON.parse(l.changes || '{}');
    return l;
  });
}

export function getAuditLogStats() {
  const total = db.prepare('SELECT COUNT(*) as count FROM governance_audit_log').get().count;
  const today = db.prepare("SELECT COUNT(*) as count FROM governance_audit_log WHERE created_at >= datetime('now', 'start of day')").get().count;
  const thisWeek = db.prepare("SELECT COUNT(*) as count FROM governance_audit_log WHERE created_at >= datetime('now', '-7 days')").get().count;
  const byType = db.prepare('SELECT entity_type, COUNT(*) as count FROM governance_audit_log GROUP BY entity_type ORDER BY count DESC').all();
  const byAction = db.prepare('SELECT action, COUNT(*) as count FROM governance_audit_log GROUP BY action ORDER BY count DESC').all();
  const recent = db.prepare('SELECT * FROM governance_audit_log ORDER BY created_at DESC LIMIT 5').all().map(l => {
    l.changes = JSON.parse(l.changes || '{}');
    return l;
  });
  return { total, today, thisWeek, byType, byAction, recent };
}

// ─── Data Classification ─────────────────────────────────────────────────────

export function setDataClassification(apiId, { classification, piiFlag, financialFlag, notes }) {
  const existing = db.prepare('SELECT id FROM data_classifications WHERE api_id = ?').get(apiId);
  if (existing) {
    db.prepare(`
      UPDATE data_classifications SET classification = ?, pii_flag = ?, financial_flag = ?, notes = ?, updated_at = datetime('now')
      WHERE api_id = ?
    `).run(classification, piiFlag ? 1 : 0, financialFlag ? 1 : 0, notes || null, apiId);
    logAudit('data_classification', apiId, 'updated', 'system', { classification, piiFlag, financialFlag });
    return getDataClassification(apiId);
  }
  const id = randomUUID();
  db.prepare(`
    INSERT INTO data_classifications (id, api_id, classification, pii_flag, financial_flag, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, apiId, classification || 'internal', piiFlag ? 1 : 0, financialFlag ? 1 : 0, notes || null);
  logAudit('data_classification', apiId, 'created', 'system', { classification, piiFlag, financialFlag });
  return getDataClassification(apiId);
}

export function getDataClassification(apiId) {
  return db.prepare(`
    SELECT d.*, a.name as api_name, a.method, a.path
    FROM data_classifications d
    JOIN apis a ON d.api_id = a.id
    WHERE d.api_id = ?
  `).get(apiId) || null;
}

export function listDataClassifications() {
  return db.prepare(`
    SELECT d.*, a.name as api_name, a.method, a.path, a.security_score, a.quality_score,
           g.name as gateway_name
    FROM data_classifications d
    JOIN apis a ON d.api_id = a.id
    JOIN gateways g ON a.gateway_id = g.id
    ORDER BY 
      CASE d.classification WHEN 'restricted' THEN 0 WHEN 'confidential' THEN 1 WHEN 'internal' THEN 2 WHEN 'public' THEN 3 END
  `).all();
}

// ─── Risk Assessment ─────────────────────────────────────────────────────────

export function getRiskAssessment() {
  const apis = db.prepare(`
    SELECT a.*, g.name as gateway_name, g.type as gateway_type
    FROM apis a JOIN gateways g ON a.gateway_id = g.id
  `).all();

  const totalApis = apis.length;
  if (totalApis === 0) return { totalApis: 0, overallRisk: 'low', riskScore: 0, categories: [], apiRisks: [], trendData: [] };

  const avgSecurity = Math.round(apis.reduce((s, a) => s + a.security_score, 0) / totalApis);
  const avgQuality = Math.round(apis.reduce((s, a) => s + a.quality_score, 0) / totalApis);
  const overallScore = Math.round((avgSecurity + avgQuality) / 2);
  const overallRisk = overallScore >= 80 ? 'low' : overallScore >= 60 ? 'medium' : 'high';

  const openViolations = db.prepare("SELECT COUNT(*) as count FROM policy_violations WHERE status = 'open'").get().count;
  const deprecatedApis = db.prepare("SELECT COUNT(*) as count FROM api_lifecycle WHERE status IN ('deprecated', 'sunset')").get()?.count || 0;
  const unclassifiedApis = totalApis - (db.prepare('SELECT COUNT(DISTINCT api_id) as count FROM data_classifications').get()?.count || 0);

  const categories = [
    { name: 'Security', score: avgSecurity, risk: avgSecurity >= 80 ? 'low' : avgSecurity >= 60 ? 'medium' : 'high', details: `Average security score across ${totalApis} APIs` },
    { name: 'Quality', score: avgQuality, risk: avgQuality >= 80 ? 'low' : avgQuality >= 60 ? 'medium' : 'high', details: `Average quality score across ${totalApis} APIs` },
    { name: 'Compliance', score: openViolations === 0 ? 100 : Math.max(0, 100 - openViolations * 10), risk: openViolations === 0 ? 'low' : openViolations <= 3 ? 'medium' : 'high', details: `${openViolations} open policy violations` },
    { name: 'Lifecycle', score: deprecatedApis === 0 ? 100 : Math.max(0, 100 - deprecatedApis * 15), risk: deprecatedApis === 0 ? 'low' : deprecatedApis <= 2 ? 'medium' : 'high', details: `${deprecatedApis} deprecated/sunset APIs` },
    { name: 'Classification', score: unclassifiedApis === 0 ? 100 : Math.round((1 - unclassifiedApis / totalApis) * 100), risk: unclassifiedApis === 0 ? 'low' : unclassifiedApis <= 2 ? 'medium' : 'high', details: `${unclassifiedApis} unclassified APIs` },
  ];

  const apiRisks = apis.map(api => {
    const overall = Math.round((api.security_score + api.quality_score) / 2);
    const risk = overall >= 80 ? 'low' : overall >= 60 ? 'medium' : 'high';
    const factors = [];
    if (api.security_score < 70) factors.push('Low security score');
    if (api.quality_score < 70) factors.push('Low quality score');
    const lifecycleRow = db.prepare('SELECT status FROM api_lifecycle WHERE api_id = ?').get(api.id);
    if (lifecycleRow && ['deprecated', 'sunset'].includes(lifecycleRow.status)) factors.push('Deprecated/sunset');
    const violationCount = db.prepare("SELECT COUNT(*) as count FROM policy_violations WHERE api_id = ? AND status = 'open'").get(api.id).count;
    if (violationCount > 0) factors.push(`${violationCount} policy violation(s)`);
    return { ...api, overall, risk, factors };
  }).sort((a, b) => a.overall - b.overall);

  return { totalApis, overallRisk, riskScore: overallScore, avgSecurity, avgQuality, openViolations, deprecatedApis, unclassifiedApis, categories, apiRisks };
}

// ─── Remediation Suggestions ─────────────────────────────────────────────────

export function getRemediations(apiId) {
  const api = db.prepare(`
    SELECT a.*, g.name as gateway_name FROM apis a JOIN gateways g ON a.gateway_id = g.id WHERE a.id = ?
  `).get(apiId);
  if (!api) return [];

  const suggestions = [];

  if (api.security_score < 70) {
    suggestions.push({ category: 'security', severity: 'high', title: 'Add Authentication', description: 'This API has a low security score. Add authentication (API Key, OAuth2, or JWT) to protect the endpoint.', action: 'Add securitySchemes to the OpenAPI spec and reference them in the endpoint security field.' });
  }
  if (api.security_score < 80) {
    suggestions.push({ category: 'security', severity: 'medium', title: 'Enable Rate Limiting', description: 'Add rate limiting to prevent abuse and ensure fair usage.', action: 'Configure rate limiting through your API gateway or add the API to a product with a rate-limited plan.' });
  }
  if (api.security_score < 50) {
    suggestions.push({ category: 'security', severity: 'high', title: 'Enforce HTTPS', description: 'Ensure all API traffic is encrypted using HTTPS.', action: 'Configure your API gateway to redirect HTTP to HTTPS and reject non-TLS connections.' });
  }
  if (api.quality_score < 60) {
    suggestions.push({ category: 'quality', severity: 'high', title: 'Add API Description', description: 'This API lacks a meaningful description. Add comprehensive documentation.', action: 'Update the OpenAPI spec with detailed description, summary, and tags for each operation.' });
  }
  if (api.quality_score < 70) {
    suggestions.push({ category: 'quality', severity: 'medium', title: 'Add Request/Response Examples', description: 'Include example requests and responses for better developer experience.', action: 'Add examples to requestBody and responses in the OpenAPI spec.' });
  }
  if (api.quality_score < 80) {
    suggestions.push({ category: 'quality', severity: 'medium', title: 'Document Error Responses', description: 'Add documentation for error responses (4xx, 5xx).', action: 'Add responses for 400, 401, 403, 404, 500 status codes with schema and examples.' });
  }
  if (api.quality_score < 50) {
    suggestions.push({ category: 'quality', severity: 'high', title: 'Complete Schema Definitions', description: 'API schema is incomplete. Define all request/response schemas.', action: 'Add JSON Schema definitions for all request bodies and response payloads in the components/schemas section.' });
  }

  const classification = db.prepare('SELECT * FROM data_classifications WHERE api_id = ?').get(apiId);
  if (!classification) {
    suggestions.push({ category: 'governance', severity: 'low', title: 'Classify Data Sensitivity', description: 'This API has not been classified for data sensitivity.', action: 'Set the data classification (public, internal, confidential, or restricted) and mark PII/financial data flags.' });
  }

  const lifecycle = db.prepare('SELECT * FROM api_lifecycle WHERE api_id = ?').get(apiId);
  if (!lifecycle) {
    suggestions.push({ category: 'governance', severity: 'low', title: 'Set API Lifecycle Status', description: 'This API has no lifecycle tracking configured.', action: 'Set a version number and lifecycle status (active, deprecated, sunset, retired).' });
  }

  return suggestions;
}

// ─── Dependency Mapping ──────────────────────────────────────────────────────

export function getApiDependencies(apiId) {
  const products = db.prepare(`
    SELECT p.id, p.name, p.mcp_enabled, 'product' as type
    FROM products p
    JOIN product_apis pa ON p.id = pa.product_id
    WHERE pa.api_id = ?
  `).all(apiId);

  const agents = db.prepare(`
    SELECT a.id, a.name, a.status, 'agent' as type
    FROM agents a
    JOIN products p ON a.product_id = p.id
    JOIN product_apis pa ON p.id = pa.product_id
    WHERE pa.api_id = ?
  `).all(apiId);

  return { products, agents, totalDependents: products.length + agents.length };
}

export function getAllDependencies() {
  const apis = db.prepare(`
    SELECT a.id, a.name, a.method, a.path, a.security_score, a.quality_score, g.name as gateway_name
    FROM apis a JOIN gateways g ON a.gateway_id = g.id
  `).all();

  return apis.map(api => {
    const deps = getApiDependencies(api.id);
    return { ...api, ...deps };
  }).filter(a => a.totalDependents > 0);
}

// ─── Governance Reports ──────────────────────────────────────────────────────

export function generateReport(type) {
  switch (type) {
    case 'executive_summary':
      return generateExecutiveSummary();
    case 'compliance':
      return generateComplianceReport();
    case 'risk':
      return generateRiskReport();
    case 'lifecycle':
      return generateLifecycleReport();
    case 'full':
      return generateFullReport();
    default:
      return generateExecutiveSummary();
  }
}

function generateExecutiveSummary() {
  const risk = getRiskAssessment();
  const policies = listPolicies();
  const violations = listViolations(null, 'open');
  const lifecycles = listApiLifecycles();
  const classifications = listDataClassifications();

  return {
    type: 'executive_summary',
    generatedAt: new Date().toISOString(),
    title: 'API Governance Executive Summary',
    overview: {
      totalApis: risk.totalApis,
      overallRiskLevel: risk.overallRisk,
      riskScore: risk.riskScore,
      avgSecurity: risk.avgSecurity,
      avgQuality: risk.avgQuality,
    },
    compliance: {
      totalPolicies: policies.length,
      enabledPolicies: policies.filter(p => p.enabled).length,
      openViolations: violations.length,
      criticalViolations: violations.filter(v => v.severity === 'critical').length,
      highViolations: violations.filter(v => v.severity === 'high').length,
    },
    lifecycle: {
      tracked: lifecycles.length,
      active: lifecycles.filter(l => l.status === 'active').length,
      deprecated: lifecycles.filter(l => l.status === 'deprecated').length,
      sunset: lifecycles.filter(l => l.status === 'sunset').length,
      retired: lifecycles.filter(l => l.status === 'retired').length,
    },
    classification: {
      classified: classifications.length,
      unclassified: risk.totalApis - classifications.length,
      withPii: classifications.filter(c => c.pii_flag).length,
      withFinancial: classifications.filter(c => c.financial_flag).length,
    },
    riskCategories: risk.categories,
  };
}

function generateComplianceReport() {
  const policies = listPolicies();
  const allViolations = listViolations();
  const openViolations = allViolations.filter(v => v.status === 'open');
  const resolvedViolations = allViolations.filter(v => v.status === 'resolved');
  const dismissedViolations = allViolations.filter(v => v.status === 'dismissed');

  return {
    type: 'compliance',
    generatedAt: new Date().toISOString(),
    title: 'Compliance Report',
    policies: policies.map(p => ({
      ...p,
      violations: allViolations.filter(v => v.policy_id === p.id),
    })),
    summary: {
      totalPolicies: policies.length,
      enabled: policies.filter(p => p.enabled).length,
      disabled: policies.filter(p => !p.enabled).length,
      totalViolations: allViolations.length,
      open: openViolations.length,
      resolved: resolvedViolations.length,
      dismissed: dismissedViolations.length,
      bySeverity: {
        critical: openViolations.filter(v => v.severity === 'critical').length,
        high: openViolations.filter(v => v.severity === 'high').length,
        medium: openViolations.filter(v => v.severity === 'medium').length,
        low: openViolations.filter(v => v.severity === 'low').length,
      },
    },
  };
}

function generateRiskReport() {
  const risk = getRiskAssessment();
  return {
    type: 'risk',
    generatedAt: new Date().toISOString(),
    title: 'Risk Assessment Report',
    ...risk,
  };
}

function generateLifecycleReport() {
  const lifecycles = listApiLifecycles();
  const apisWithoutLifecycle = db.prepare(`
    SELECT a.id, a.name, a.method, a.path, g.name as gateway_name
    FROM apis a
    JOIN gateways g ON a.gateway_id = g.id
    LEFT JOIN api_lifecycle l ON a.id = l.api_id
    WHERE l.id IS NULL
  `).all();

  return {
    type: 'lifecycle',
    generatedAt: new Date().toISOString(),
    title: 'API Lifecycle Report',
    lifecycles,
    untracked: apisWithoutLifecycle,
    summary: {
      total: lifecycles.length,
      active: lifecycles.filter(l => l.status === 'active').length,
      deprecated: lifecycles.filter(l => l.status === 'deprecated').length,
      sunset: lifecycles.filter(l => l.status === 'sunset').length,
      retired: lifecycles.filter(l => l.status === 'retired').length,
      untracked: apisWithoutLifecycle.length,
    },
  };
}

function generateFullReport() {
  return {
    type: 'full',
    generatedAt: new Date().toISOString(),
    title: 'Full Governance Report',
    executiveSummary: generateExecutiveSummary(),
    compliance: generateComplianceReport(),
    risk: generateRiskReport(),
    lifecycle: generateLifecycleReport(),
    classifications: listDataClassifications(),
    dependencies: getAllDependencies(),
    auditLog: listAuditLogs({ limit: 50 }),
  };
}

// ─── Standards ───────────────────────────────────────────────────────────────

export function listStandards() {
  return db.prepare('SELECT * FROM api_standards ORDER BY category, name').all().map(s => {
    s.rule = JSON.parse(s.rule || '{}');
    return s;
  });
}

export function createStandard({ name, description, category, rule, severity, enabled }) {
  const id = randomUUID();
  db.prepare(`
    INSERT INTO api_standards (id, name, description, category, rule, severity, enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, description || null, category || 'general', JSON.stringify(rule || {}), severity || 'medium', enabled !== false ? 1 : 0);
  logAudit('api_standard', id, 'created', 'system', { name, category });
  return getStandard(id);
}

export function getStandard(id) {
  const s = db.prepare('SELECT * FROM api_standards WHERE id = ?').get(id);
  if (!s) return null;
  s.rule = JSON.parse(s.rule || '{}');
  return s;
}

export function updateStandard(id, updates) {
  const fields = [];
  const values = [];
  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
  if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description); }
  if (updates.category !== undefined) { fields.push('category = ?'); values.push(updates.category); }
  if (updates.rule !== undefined) { fields.push('rule = ?'); values.push(JSON.stringify(updates.rule)); }
  if (updates.severity !== undefined) { fields.push('severity = ?'); values.push(updates.severity); }
  if (updates.enabled !== undefined) { fields.push('enabled = ?'); values.push(updates.enabled ? 1 : 0); }
  if (fields.length === 0) return getStandard(id);
  fields.push("updated_at = datetime('now')");
  values.push(id);
  db.prepare(`UPDATE api_standards SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getStandard(id);
}

export function deleteStandard(id) {
  db.prepare('DELETE FROM api_standards WHERE id = ?').run(id);
}
