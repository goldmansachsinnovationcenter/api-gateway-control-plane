import db from '../models/database.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Simulates discovering APIs from different gateway types.
 * In production, these would make real API calls to the gateway admin APIs.
 */

function generateMockAwsApis(gatewayId, config) {
  const parsedConfig = JSON.parse(config);
  const region = parsedConfig.region || 'us-east-1';

  const mockApis = [
    {
      name: 'Get Users',
      method: 'GET',
      path: '/api/users',
      description: 'Retrieve a list of all users',
      spec: JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'Get Users', version: '1.0.0' },
        paths: {
          '/api/users': {
            get: {
              summary: 'Retrieve a list of all users',
              parameters: [
                { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 }, description: 'Max results to return' },
                { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 }, description: 'Pagination offset' }
              ],
              responses: {
                '200': {
                  description: 'A list of users',
                  content: { 'application/json': { schema: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, email: { type: 'string' } } } } } }
                }
              },
              security: [{ apiKey: [] }]
            }
          }
        }
      }),
      security_score: 85,
      quality_score: 90
    },
    {
      name: 'Create User',
      method: 'POST',
      path: '/api/users',
      description: 'Create a new user account',
      spec: JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'Create User', version: '1.0.0' },
        paths: {
          '/api/users': {
            post: {
              summary: 'Create a new user account',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['name', 'email'],
                      properties: {
                        name: { type: 'string', description: 'Full name of the user' },
                        email: { type: 'string', format: 'email', description: 'Email address' },
                        role: { type: 'string', enum: ['admin', 'user', 'viewer'], default: 'user' }
                      }
                    }
                  }
                }
              },
              responses: {
                '201': { description: 'User created successfully' },
                '400': { description: 'Invalid input' }
              },
              security: [{ bearerAuth: [] }]
            }
          }
        }
      }),
      security_score: 92,
      quality_score: 88
    },
    {
      name: 'Get User By ID',
      method: 'GET',
      path: '/api/users/{id}',
      description: 'Retrieve a specific user by their ID',
      spec: JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'Get User By ID', version: '1.0.0' },
        paths: {
          '/api/users/{id}': {
            get: {
              summary: 'Retrieve a specific user by their ID',
              parameters: [
                { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'User ID' }
              ],
              responses: {
                '200': { description: 'User details' },
                '404': { description: 'User not found' }
              },
              security: [{ apiKey: [] }]
            }
          }
        }
      }),
      security_score: 80,
      quality_score: 85
    },
    {
      name: 'Get Orders',
      method: 'GET',
      path: '/api/orders',
      description: 'Retrieve a list of orders',
      spec: JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'Get Orders', version: '1.0.0' },
        paths: {
          '/api/orders': {
            get: {
              summary: 'Retrieve a list of orders',
              parameters: [
                { name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'completed', 'cancelled'] }, description: 'Filter by order status' },
                { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 }, description: 'Max results' }
              ],
              responses: {
                '200': { description: 'A list of orders' }
              },
              security: [{ bearerAuth: [] }]
            }
          }
        }
      }),
      security_score: 78,
      quality_score: 82
    },
    {
      name: 'Create Order',
      method: 'POST',
      path: '/api/orders',
      description: 'Place a new order',
      spec: JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'Create Order', version: '1.0.0' },
        paths: {
          '/api/orders': {
            post: {
              summary: 'Place a new order',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['product_id', 'quantity'],
                      properties: {
                        product_id: { type: 'string' },
                        quantity: { type: 'integer', minimum: 1 },
                        notes: { type: 'string' }
                      }
                    }
                  }
                }
              },
              responses: {
                '201': { description: 'Order placed successfully' },
                '400': { description: 'Invalid input' }
              },
              security: [{ bearerAuth: [] }]
            }
          }
        }
      }),
      security_score: 88,
      quality_score: 75
    },
    {
      name: 'Health Check',
      method: 'GET',
      path: '/api/health',
      description: 'Check API health status',
      spec: JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'Health Check', version: '1.0.0' },
        paths: {
          '/api/health': {
            get: {
              summary: 'Check API health status',
              responses: {
                '200': {
                  description: 'Service is healthy',
                  content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string' }, uptime: { type: 'number' } } } } }
                }
              }
            }
          }
        }
      }),
      security_score: 60,
      quality_score: 95
    }
  ];

  return mockApis;
}

function generateMockKongApis(gatewayId, config) {
  const mockApis = [
    {
      name: 'List Products',
      method: 'GET',
      path: '/v1/products',
      description: 'Get all products in the catalog',
      spec: JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'List Products', version: '1.0.0' },
        paths: {
          '/v1/products': {
            get: {
              summary: 'Get all products in the catalog',
              parameters: [
                { name: 'category', in: 'query', schema: { type: 'string' }, description: 'Filter by category' },
                { name: 'page', in: 'query', schema: { type: 'integer', default: 1 }, description: 'Page number' },
                { name: 'per_page', in: 'query', schema: { type: 'integer', default: 25 }, description: 'Items per page' }
              ],
              responses: { '200': { description: 'Product list' } },
              security: [{ apiKey: [] }]
            }
          }
        }
      }),
      security_score: 82,
      quality_score: 88
    },
    {
      name: 'Get Product',
      method: 'GET',
      path: '/v1/products/{id}',
      description: 'Get a specific product by ID',
      spec: JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'Get Product', version: '1.0.0' },
        paths: {
          '/v1/products/{id}': {
            get: {
              summary: 'Get a specific product by ID',
              parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
              responses: {
                '200': { description: 'Product details' },
                '404': { description: 'Product not found' }
              },
              security: [{ apiKey: [] }]
            }
          }
        }
      }),
      security_score: 80,
      quality_score: 90
    },
    {
      name: 'Search Products',
      method: 'GET',
      path: '/v1/products/search',
      description: 'Search products by keyword',
      spec: JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'Search Products', version: '1.0.0' },
        paths: {
          '/v1/products/search': {
            get: {
              summary: 'Search products by keyword',
              parameters: [
                { name: 'q', in: 'query', required: true, schema: { type: 'string' }, description: 'Search query' },
                { name: 'sort', in: 'query', schema: { type: 'string', enum: ['relevance', 'price_asc', 'price_desc'] } }
              ],
              responses: { '200': { description: 'Search results' } },
              security: [{ apiKey: [] }]
            }
          }
        }
      }),
      security_score: 75,
      quality_score: 85
    },
    {
      name: 'Create Payment',
      method: 'POST',
      path: '/v1/payments',
      description: 'Process a new payment',
      spec: JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'Create Payment', version: '1.0.0' },
        paths: {
          '/v1/payments': {
            post: {
              summary: 'Process a new payment',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['amount', 'currency', 'method'],
                      properties: {
                        amount: { type: 'number' },
                        currency: { type: 'string', enum: ['USD', 'EUR', 'GBP'] },
                        method: { type: 'string', enum: ['card', 'bank_transfer', 'wallet'] },
                        description: { type: 'string' }
                      }
                    }
                  }
                }
              },
              responses: {
                '201': { description: 'Payment processed' },
                '400': { description: 'Invalid payment data' }
              },
              security: [{ bearerAuth: [] }]
            }
          }
        }
      }),
      security_score: 95,
      quality_score: 92
    },
    {
      name: 'Get Payment Status',
      method: 'GET',
      path: '/v1/payments/{id}',
      description: 'Get payment status by ID',
      spec: JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'Get Payment Status', version: '1.0.0' },
        paths: {
          '/v1/payments/{id}': {
            get: {
              summary: 'Get payment status by ID',
              parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
              responses: {
                '200': { description: 'Payment details' },
                '404': { description: 'Payment not found' }
              },
              security: [{ bearerAuth: [] }]
            }
          }
        }
      }),
      security_score: 90,
      quality_score: 87
    }
  ];

  return mockApis;
}

export function registerGateway(name, type, config) {
  const id = uuidv4();
  const stmt = db.prepare('INSERT INTO gateways (id, name, type, config) VALUES (?, ?, ?, ?)');
  stmt.run(id, name, type, JSON.stringify(config));

  // Discover APIs from the gateway
  let apis = [];
  if (type === 'aws') {
    apis = generateMockAwsApis(id, JSON.stringify(config));
  } else if (type === 'kong') {
    apis = generateMockKongApis(id, JSON.stringify(config));
  }

  const insertApi = db.prepare('INSERT INTO apis (id, gateway_id, name, method, path, description, spec, security_score, quality_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const insertMany = db.transaction((apis) => {
    for (const api of apis) {
      insertApi.run(uuidv4(), id, api.name, api.method, api.path, api.description, api.spec, api.security_score, api.quality_score);
    }
  });
  insertMany(apis);

  return { id, name, type, apiCount: apis.length };
}

export function listGateways() {
  const gateways = db.prepare('SELECT * FROM gateways ORDER BY created_at DESC').all();
  return gateways.map(gw => {
    const apiCount = db.prepare('SELECT COUNT(*) as count FROM apis WHERE gateway_id = ?').get(gw.id).count;
    return { ...gw, config: JSON.parse(gw.config), apiCount };
  });
}

export function getGateway(id) {
  const gateway = db.prepare('SELECT * FROM gateways WHERE id = ?').get(id);
  if (!gateway) return null;
  const apis = db.prepare('SELECT * FROM apis WHERE gateway_id = ? ORDER BY path, method').all(id);
  return { ...gateway, config: JSON.parse(gateway.config), apis };
}

export function deleteGateway(id) {
  db.prepare('DELETE FROM gateways WHERE id = ?').run(id);
}

export function listApis(gatewayId) {
  if (gatewayId) {
    return db.prepare('SELECT * FROM apis WHERE gateway_id = ? ORDER BY path, method').all(gatewayId);
  }
  return db.prepare(`
    SELECT apis.*, gateways.name as gateway_name, gateways.type as gateway_type 
    FROM apis 
    JOIN gateways ON apis.gateway_id = gateways.id 
    ORDER BY apis.path, apis.method
  `).all();
}

export function getApi(id) {
  return db.prepare(`
    SELECT apis.*, gateways.name as gateway_name, gateways.type as gateway_type 
    FROM apis 
    JOIN gateways ON apis.gateway_id = gateways.id 
    WHERE apis.id = ?
  `).get(id);
}

export function updateApiSpec(id, spec) {
  const scores = calculateScores(spec);
  db.prepare('UPDATE apis SET spec = ?, security_score = ?, quality_score = ?, updated_at = datetime(\'now\') WHERE id = ?')
    .run(spec, scores.security, scores.quality, id);
  return getApi(id);
}

function calculateScores(specStr) {
  try {
    const spec = JSON.parse(specStr);
    let security = 50;
    let quality = 50;

    // Security scoring
    const paths = spec.paths || {};
    for (const p of Object.values(paths)) {
      for (const op of Object.values(p)) {
        if (typeof op !== 'object') continue;
        if (op.security && op.security.length > 0) security += 15;
        if (op.parameters) {
          for (const param of op.parameters) {
            if (param.schema) security += 3;
          }
        }
        if (op.requestBody?.content?.['application/json']?.schema?.required) security += 5;
      }
    }

    // Quality scoring
    for (const p of Object.values(paths)) {
      for (const op of Object.values(p)) {
        if (typeof op !== 'object') continue;
        if (op.summary) quality += 10;
        if (op.description) quality += 5;
        if (op.responses) quality += 10;
        if (op.parameters) {
          for (const param of op.parameters) {
            if (param.description) quality += 3;
          }
        }
      }
    }

    return {
      security: Math.min(100, security),
      quality: Math.min(100, quality)
    };
  } catch {
    return { security: 50, quality: 50 };
  }
}
