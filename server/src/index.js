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
