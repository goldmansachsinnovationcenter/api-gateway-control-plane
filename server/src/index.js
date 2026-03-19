import express from 'express';
import cors from 'cors';
import gatewayRoutes from './routes/gateways.js';
import apiRoutes from './routes/apis.js';
import productRoutes from './routes/products.js';
import mcpRoutes from './routes/mcp.js';

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
