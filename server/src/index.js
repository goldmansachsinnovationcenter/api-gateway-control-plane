import express from 'express';
import cors from 'cors';
import gatewayRoutes from './routes/gateways.js';
import apiRoutes from './routes/apis.js';
import productRoutes from './routes/products.js';
import mcpRoutes from './routes/mcp.js';
import agentRoutes from './routes/agents.js';
import bedrockAgentRoutes from './routes/bedrockAgents.js';
import agentCoreRoutes from './routes/agentCore.js';
import planRoutes from './routes/plans.js';
import governanceRoutes from './routes/governance.js';
import agentHubRoutes from './routes/agentHub.js';
import salesforceAgentRoutes from './routes/salesforceAgents.js';
import copilotAgentRoutes from './routes/copilotAgents.js';
import mcpDiscoveryRoutes from './routes/mcpDiscovery.js';
import devinAgentRoutes from './routes/devinAgents.js';
import claudeAgentRoutes from './routes/claudeAgents.js';
import settingsRoutes from './routes/settings.js';
import db from './models/database.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/gateways', gatewayRoutes);
app.use('/api/apis', apiRoutes);
app.use('/api/products', productRoutes);
app.use('/mcp', mcpRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/cloud-agents', bedrockAgentRoutes);
app.use('/api/agentcore', agentCoreRoutes);
app.use('/api', planRoutes);
app.use('/api/governance', governanceRoutes);
app.use('/api/agent-hub', agentHubRoutes);
app.use('/api/salesforce-agents', salesforceAgentRoutes);
app.use('/api/copilot-agents', copilotAgentRoutes);
app.use('/api/mcp-discovery', mcpDiscoveryRoutes);
app.use('/api/devin-agents', devinAgentRoutes);
app.use('/api/claude-agents', claudeAgentRoutes);
app.use('/api/settings', settingsRoutes);

// Dashboard summary
app.get('/api/dashboard', (req, res) => {
  try {
    const count = (table) => { try { return db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get().c; } catch { return 0; } };
    const recentItems = (table, limit = 5) => { try { return db.prepare(`SELECT * FROM ${table} ORDER BY created_at DESC LIMIT ?`).all(limit); } catch { return []; } };

    const gateways = count('gateways');
    const apis = count('apis');
    const products = count('products');
    const agents = count('agents');
    const cloudAgents = count('cloud_agents');
    const users = count('users');
    const policies = count('governance_policies');
    const violations = count('policy_violations');
    const apiKeys = count('api_keys');
    const plans = count('plans');
    const webhooks = count('webhooks');

    // Active/enabled counts
    let activeAgents = 0;
    let enabledAgents = 0;
    try { activeAgents = db.prepare("SELECT COUNT(*) as c FROM agents WHERE status = 'active'").get().c; } catch {}
    try { enabledAgents = db.prepare("SELECT COUNT(*) as c FROM agents WHERE enabled = 1").get().c; } catch {}

    // Gateway type breakdown
    let gatewayTypes = [];
    try { gatewayTypes = db.prepare("SELECT type, COUNT(*) as count FROM gateways GROUP BY type").all(); } catch {}

    // Recent activity
    const recentGateways = recentItems('gateways', 3);
    const recentApis = recentItems('apis', 5);
    const recentAudit = recentItems('audit_settings_log', 5);

    // Agent anomalies
    let openAnomalies = 0;
    try { openAnomalies = db.prepare("SELECT COUNT(*) as c FROM agent_anomalies WHERE resolved = 0").get().c; } catch {}

    // API health scores
    let avgSecurityScore = 0;
    let avgQualityScore = 0;
    try {
      const scores = db.prepare("SELECT AVG(security_score) as sec, AVG(quality_score) as qual FROM apis WHERE security_score IS NOT NULL").get();
      avgSecurityScore = Math.round((scores.sec || 0) * 10) / 10;
      avgQualityScore = Math.round((scores.qual || 0) * 10) / 10;
    } catch {}

    res.json({
      counts: { gateways, apis, products, agents, cloudAgents, users, policies, violations, apiKeys, plans, webhooks },
      agentStats: { total: agents, active: activeAgents, enabled: enabledAgents, anomalies: openAnomalies },
      gatewayTypes,
      apiHealth: { avgSecurityScore, avgQualityScore },
      recent: { gateways: recentGateways, apis: recentApis, audit: recentAudit },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`API Gateway Control Plane server running on port ${PORT}`);
});

export default app;
