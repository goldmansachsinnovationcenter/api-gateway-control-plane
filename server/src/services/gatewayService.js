import db from '../models/database.js';
import { v4 as uuidv4 } from 'uuid';
import {
  APIGatewayClient,
  GetRestApisCommand,
  GetResourcesCommand,
  GetExportCommand,
  GetStagesCommand,
} from '@aws-sdk/client-api-gateway';

/**
 * Discovers APIs from a real AWS API Gateway using the AWS SDK.
 * Requires: accessKeyId, secretAccessKey, region, and optionally restApiId + stageName.
 * Falls back to mock data if credentials are missing or discovery fails.
 */
async function discoverRealAwsApis(gatewayId, config) {
  const parsedConfig = typeof config === 'string' ? JSON.parse(config) : config;
  const { region, accessKeyId, secretAccessKey, restApiId, stageName } = parsedConfig;

  if (!accessKeyId || !secretAccessKey) {
    console.log('No AWS credentials provided, using mock data');
    return null;
  }

  const client = new APIGatewayClient({
    region: region || 'us-east-1',
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  try {
    const apis = [];

    // If a specific REST API ID is provided, discover just that one
    // Otherwise discover all REST APIs in the account
    let restApis = [];
    if (restApiId) {
      restApis = [{ id: restApiId, name: restApiId }];
    } else {
      const listResult = await client.send(new GetRestApisCommand({ limit: 500 }));
      restApis = listResult.items || [];
    }

    for (const restApi of restApis) {
      // Get the OpenAPI export for this REST API if a stage is specified
      let exportedSpec = null;
      const resolvedStage = stageName || 'prod';

      try {
        const exportResult = await client.send(new GetExportCommand({
          restApiId: restApi.id,
          stageName: resolvedStage,
          exportType: 'oas30',
          accepts: 'application/json',
        }));
        if (exportResult.body) {
          const decoder = new TextDecoder('utf-8');
          exportedSpec = JSON.parse(decoder.decode(exportResult.body));
        }
      } catch (exportErr) {
        console.log(`Could not export spec for ${restApi.id} stage ${resolvedStage}:`, exportErr.message);
      }

      // If we got a full OpenAPI spec, extract individual endpoints from it
      if (exportedSpec && exportedSpec.paths) {
        const invokeUrl = `https://${restApi.id}.execute-api.${region || 'us-east-1'}.amazonaws.com/${resolvedStage}`;

        for (const [path, pathObj] of Object.entries(exportedSpec.paths)) {
          const httpMethods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'];
          for (const method of httpMethods) {
            if (pathObj[method]) {
              const operation = pathObj[method];
              const endpointSpec = {
                openapi: '3.0.0',
                info: {
                  title: operation.summary || operation.operationId || `${method.toUpperCase()} ${path}`,
                  version: exportedSpec.info?.version || '1.0.0',
                },
                servers: [{ url: invokeUrl }],
                paths: { [path]: { [method]: operation } },
              };

              const scores = calculateScores(JSON.stringify(endpointSpec));
              apis.push({
                name: operation.summary || operation.operationId || `${method.toUpperCase()} ${path}`,
                method: method.toUpperCase(),
                path: path,
                description: operation.description || operation.summary || `${method.toUpperCase()} ${path}`,
                spec: JSON.stringify(endpointSpec),
                security_score: scores.security,
                quality_score: scores.quality,
                invoke_url: invokeUrl,
              });
            }
          }
        }
      } else {
        // Fallback: get resources and build basic specs
        try {
          const resourcesResult = await client.send(new GetResourcesCommand({
            restApiId: restApi.id,
            limit: 500,
            embed: ['methods'],
          }));

          const resources = resourcesResult.items || [];
          for (const resource of resources) {
            if (!resource.resourceMethods) continue;
            for (const [method, methodObj] of Object.entries(resource.resourceMethods)) {
              if (method === 'OPTIONS') continue;
              const endpointSpec = {
                openapi: '3.0.0',
                info: { title: `${method} ${resource.path}`, version: '1.0.0' },
                paths: {
                  [resource.path]: {
                    [method.toLowerCase()]: {
                      summary: `${method} ${resource.path}`,
                      responses: { '200': { description: 'Success' } },
                    },
                  },
                },
              };

              const scores = calculateScores(JSON.stringify(endpointSpec));
              apis.push({
                name: `${method} ${resource.path}`,
                method: method,
                path: resource.path,
                description: `${method} ${resource.path} on ${restApi.name || restApi.id}`,
                spec: JSON.stringify(endpointSpec),
                security_score: scores.security,
                quality_score: scores.quality,
              });
            }
          }
        } catch (resErr) {
          console.log(`Could not get resources for ${restApi.id}:`, resErr.message);
        }
      }
    }

    if (apis.length === 0) {
      console.log('No APIs discovered from AWS, falling back to mock data');
      return null;
    }

    return apis;
  } catch (err) {
    console.error('AWS API Gateway discovery failed:', err.message);
    return null;
  }
}

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

// ─── Azure API Management mock APIs ─────────────────────────────────────────
function generateMockAzureApis(gatewayId, config) {
  return [
    {
      name: 'Get Customers',
      method: 'GET',
      path: '/api/v1/customers',
      description: 'Retrieve customer list from Azure CRM backend',
      spec: JSON.stringify({ openapi: '3.0.0', info: { title: 'Get Customers', version: '1.0.0' }, paths: { '/api/v1/customers': { get: { summary: 'Retrieve customer list', parameters: [{ name: 'top', in: 'query', schema: { type: 'integer', default: 50 }, description: 'Number of records to return' }, { name: 'skip', in: 'query', schema: { type: 'integer', default: 0 }, description: 'Records to skip' }], responses: { '200': { description: 'Customer list' } }, security: [{ 'Ocp-Apim-Subscription-Key': [] }] } } } }),
      security_score: 88, quality_score: 90
    },
    {
      name: 'Create Customer',
      method: 'POST',
      path: '/api/v1/customers',
      description: 'Create a new customer record',
      spec: JSON.stringify({ openapi: '3.0.0', info: { title: 'Create Customer', version: '1.0.0' }, paths: { '/api/v1/customers': { post: { summary: 'Create a new customer', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['firstName', 'lastName', 'email'], properties: { firstName: { type: 'string' }, lastName: { type: 'string' }, email: { type: 'string', format: 'email' }, company: { type: 'string' } } } } } }, responses: { '201': { description: 'Customer created' }, '400': { description: 'Validation error' } }, security: [{ 'Ocp-Apim-Subscription-Key': [] }, { OAuth2: ['write'] }] } } } }),
      security_score: 94, quality_score: 88
    },
    {
      name: 'Get Invoices',
      method: 'GET',
      path: '/api/v1/invoices',
      description: 'Retrieve invoice records with filtering',
      spec: JSON.stringify({ openapi: '3.0.0', info: { title: 'Get Invoices', version: '1.0.0' }, paths: { '/api/v1/invoices': { get: { summary: 'Retrieve invoices', parameters: [{ name: 'status', in: 'query', schema: { type: 'string', enum: ['draft', 'sent', 'paid', 'overdue'] } }, { name: 'customerId', in: 'query', schema: { type: 'string' } }], responses: { '200': { description: 'Invoice list' } }, security: [{ 'Ocp-Apim-Subscription-Key': [] }] } } } }),
      security_score: 85, quality_score: 87
    },
    {
      name: 'Submit Invoice',
      method: 'POST',
      path: '/api/v1/invoices',
      description: 'Submit a new invoice for processing',
      spec: JSON.stringify({ openapi: '3.0.0', info: { title: 'Submit Invoice', version: '1.0.0' }, paths: { '/api/v1/invoices': { post: { summary: 'Submit invoice', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['customerId', 'amount', 'dueDate'], properties: { customerId: { type: 'string' }, amount: { type: 'number' }, currency: { type: 'string', default: 'USD' }, dueDate: { type: 'string', format: 'date' }, lineItems: { type: 'array', items: { type: 'object', properties: { description: { type: 'string' }, quantity: { type: 'integer' }, unitPrice: { type: 'number' } } } } } } } } }, responses: { '201': { description: 'Invoice created' }, '400': { description: 'Validation error' } }, security: [{ OAuth2: ['write'] }] } } } }),
      security_score: 92, quality_score: 85
    },
    {
      name: 'Get Analytics',
      method: 'GET',
      path: '/api/v1/analytics/summary',
      description: 'Retrieve analytics summary dashboard data',
      spec: JSON.stringify({ openapi: '3.0.0', info: { title: 'Get Analytics', version: '1.0.0' }, paths: { '/api/v1/analytics/summary': { get: { summary: 'Analytics summary', parameters: [{ name: 'period', in: 'query', schema: { type: 'string', enum: ['day', 'week', 'month', 'quarter'] }, description: 'Time period' }], responses: { '200': { description: 'Analytics data' } }, security: [{ 'Ocp-Apim-Subscription-Key': [] }] } } } }),
      security_score: 82, quality_score: 92
    }
  ];
}

// ─── MuleSoft Anypoint mock APIs ─────────────────────────────────────────────
function generateMockMuleSoftApis(gatewayId, config) {
  return [
    {
      name: 'Get Accounts',
      method: 'GET',
      path: '/api/v2/accounts',
      description: 'Retrieve Salesforce accounts via MuleSoft integration',
      spec: JSON.stringify({ openapi: '3.0.0', info: { title: 'Get Accounts', version: '2.0.0' }, paths: { '/api/v2/accounts': { get: { summary: 'List accounts from Salesforce', parameters: [{ name: 'type', in: 'query', schema: { type: 'string', enum: ['prospect', 'customer', 'partner'] } }, { name: 'limit', in: 'query', schema: { type: 'integer', default: 100 } }], responses: { '200': { description: 'Account list' } }, security: [{ clientCredentials: [] }] } } } }),
      security_score: 90, quality_score: 88
    },
    {
      name: 'Sync Contacts',
      method: 'POST',
      path: '/api/v2/contacts/sync',
      description: 'Synchronize contacts between Salesforce and SAP',
      spec: JSON.stringify({ openapi: '3.0.0', info: { title: 'Sync Contacts', version: '2.0.0' }, paths: { '/api/v2/contacts/sync': { post: { summary: 'Sync contacts across systems', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['source', 'target'], properties: { source: { type: 'string', enum: ['salesforce', 'sap', 'hubspot'] }, target: { type: 'string', enum: ['salesforce', 'sap', 'hubspot'] }, filters: { type: 'object', properties: { modifiedSince: { type: 'string', format: 'date-time' }, status: { type: 'string' } } } } } } } }, responses: { '200': { description: 'Sync result summary' }, '409': { description: 'Sync conflict detected' } }, security: [{ clientCredentials: [] }] } } } }),
      security_score: 88, quality_score: 85
    },
    {
      name: 'Transform Data',
      method: 'POST',
      path: '/api/v2/transform',
      description: 'Transform data using DataWeave expressions',
      spec: JSON.stringify({ openapi: '3.0.0', info: { title: 'Transform Data', version: '2.0.0' }, paths: { '/api/v2/transform': { post: { summary: 'Transform data payload', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['payload', 'expression'], properties: { payload: { type: 'object', description: 'Input data' }, expression: { type: 'string', description: 'DataWeave expression' }, outputFormat: { type: 'string', enum: ['json', 'xml', 'csv'], default: 'json' } } } } } }, responses: { '200': { description: 'Transformed data' }, '400': { description: 'Invalid expression' } }, security: [{ bearerAuth: [] }] } } } }),
      security_score: 82, quality_score: 90
    },
    {
      name: 'Get Integration Status',
      method: 'GET',
      path: '/api/v2/integrations/status',
      description: 'Check integration flow health and status',
      spec: JSON.stringify({ openapi: '3.0.0', info: { title: 'Integration Status', version: '2.0.0' }, paths: { '/api/v2/integrations/status': { get: { summary: 'Get integration flow statuses', responses: { '200': { description: 'Status of all integration flows' } }, security: [{ clientCredentials: [] }] } } } }),
      security_score: 78, quality_score: 82
    },
    {
      name: 'Publish Event',
      method: 'POST',
      path: '/api/v2/events',
      description: 'Publish event to Anypoint MQ for async processing',
      spec: JSON.stringify({ openapi: '3.0.0', info: { title: 'Publish Event', version: '2.0.0' }, paths: { '/api/v2/events': { post: { summary: 'Publish event to message queue', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['eventType', 'payload'], properties: { eventType: { type: 'string', enum: ['order.created', 'order.updated', 'customer.created', 'invoice.paid'] }, payload: { type: 'object' }, correlationId: { type: 'string' } } } } } }, responses: { '202': { description: 'Event accepted' } }, security: [{ clientCredentials: [] }] } } } }),
      security_score: 86, quality_score: 88
    }
  ];
}

// ─── Google Apigee mock APIs ─────────────────────────────────────────────────
function generateMockApigeeApis(gatewayId, config) {
  return [
    {
      name: 'Geocode Address',
      method: 'GET',
      path: '/maps/v1/geocode',
      description: 'Convert address to coordinates via Google Maps proxy',
      spec: JSON.stringify({ openapi: '3.0.0', info: { title: 'Geocode Address', version: '1.0.0' }, paths: { '/maps/v1/geocode': { get: { summary: 'Geocode an address', parameters: [{ name: 'address', in: 'query', required: true, schema: { type: 'string' }, description: 'Address to geocode' }, { name: 'format', in: 'query', schema: { type: 'string', enum: ['json', 'xml'], default: 'json' } }], responses: { '200': { description: 'Geocoding result' }, '400': { description: 'Invalid address' } }, security: [{ apiKey: [] }] } } } }),
      security_score: 80, quality_score: 92
    },
    {
      name: 'Get Recommendations',
      method: 'GET',
      path: '/ml/v1/recommendations',
      description: 'Get ML-powered product recommendations',
      spec: JSON.stringify({ openapi: '3.0.0', info: { title: 'Get Recommendations', version: '1.0.0' }, paths: { '/ml/v1/recommendations': { get: { summary: 'Get product recommendations', parameters: [{ name: 'userId', in: 'query', required: true, schema: { type: 'string' } }, { name: 'category', in: 'query', schema: { type: 'string' } }, { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } }], responses: { '200': { description: 'Recommendation list' } }, security: [{ OAuth2: ['read'] }] } } } }),
      security_score: 86, quality_score: 90
    },
    {
      name: 'Send Notification',
      method: 'POST',
      path: '/notifications/v1/send',
      description: 'Send push/email/SMS notifications',
      spec: JSON.stringify({ openapi: '3.0.0', info: { title: 'Send Notification', version: '1.0.0' }, paths: { '/notifications/v1/send': { post: { summary: 'Send a notification', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['channel', 'recipient', 'message'], properties: { channel: { type: 'string', enum: ['push', 'email', 'sms'] }, recipient: { type: 'string' }, message: { type: 'string' }, templateId: { type: 'string' }, priority: { type: 'string', enum: ['low', 'normal', 'high', 'critical'], default: 'normal' } } } } } }, responses: { '202': { description: 'Notification queued' }, '400': { description: 'Invalid payload' } }, security: [{ OAuth2: ['write'] }] } } } }),
      security_score: 90, quality_score: 88
    },
    {
      name: 'Get Device Telemetry',
      method: 'GET',
      path: '/iot/v1/devices/{deviceId}/telemetry',
      description: 'Retrieve IoT device telemetry data',
      spec: JSON.stringify({ openapi: '3.0.0', info: { title: 'Device Telemetry', version: '1.0.0' }, paths: { '/iot/v1/devices/{deviceId}/telemetry': { get: { summary: 'Get device telemetry', parameters: [{ name: 'deviceId', in: 'path', required: true, schema: { type: 'string' } }, { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } }, { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } }], responses: { '200': { description: 'Telemetry data' }, '404': { description: 'Device not found' } }, security: [{ apiKey: [] }] } } } }),
      security_score: 84, quality_score: 86
    },
    {
      name: 'Process Payment',
      method: 'POST',
      path: '/payments/v1/process',
      description: 'Process payment through payment gateway proxy',
      spec: JSON.stringify({ openapi: '3.0.0', info: { title: 'Process Payment', version: '1.0.0' }, paths: { '/payments/v1/process': { post: { summary: 'Process a payment', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['amount', 'currency', 'paymentMethod'], properties: { amount: { type: 'number' }, currency: { type: 'string' }, paymentMethod: { type: 'string', enum: ['credit_card', 'debit_card', 'bank_transfer', 'digital_wallet'] }, idempotencyKey: { type: 'string' } } } } } }, responses: { '200': { description: 'Payment processed' }, '402': { description: 'Payment failed' } }, security: [{ OAuth2: ['payments:write'] }] } } } }),
      security_score: 96, quality_score: 90
    }
  ];
}

// ─── Tyk Gateway mock APIs ───────────────────────────────────────────────────
function generateMockTykApis(gatewayId, config) {
  return [
    {
      name: 'Get Inventory',
      method: 'GET',
      path: '/warehouse/v1/inventory',
      description: 'Retrieve current warehouse inventory levels',
      spec: JSON.stringify({ openapi: '3.0.0', info: { title: 'Get Inventory', version: '1.0.0' }, paths: { '/warehouse/v1/inventory': { get: { summary: 'List inventory items', parameters: [{ name: 'warehouse', in: 'query', schema: { type: 'string' }, description: 'Warehouse location code' }, { name: 'belowThreshold', in: 'query', schema: { type: 'boolean' }, description: 'Only items below reorder threshold' }], responses: { '200': { description: 'Inventory list' } }, security: [{ authToken: [] }] } } } }),
      security_score: 82, quality_score: 88
    },
    {
      name: 'Update Stock',
      method: 'PUT',
      path: '/warehouse/v1/inventory/{sku}',
      description: 'Update stock level for a specific SKU',
      spec: JSON.stringify({ openapi: '3.0.0', info: { title: 'Update Stock', version: '1.0.0' }, paths: { '/warehouse/v1/inventory/{sku}': { put: { summary: 'Update stock level', parameters: [{ name: 'sku', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['quantity', 'reason'], properties: { quantity: { type: 'integer' }, reason: { type: 'string', enum: ['received', 'sold', 'returned', 'damaged', 'adjustment'] }, notes: { type: 'string' } } } } } }, responses: { '200': { description: 'Stock updated' }, '404': { description: 'SKU not found' } }, security: [{ authToken: [] }] } } } }),
      security_score: 85, quality_score: 90
    },
    {
      name: 'Get Shipments',
      method: 'GET',
      path: '/logistics/v1/shipments',
      description: 'Track active shipments and delivery status',
      spec: JSON.stringify({ openapi: '3.0.0', info: { title: 'Get Shipments', version: '1.0.0' }, paths: { '/logistics/v1/shipments': { get: { summary: 'List shipments', parameters: [{ name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'in_transit', 'delivered', 'returned'] } }, { name: 'carrier', in: 'query', schema: { type: 'string' } }], responses: { '200': { description: 'Shipment list' } }, security: [{ authToken: [] }] } } } }),
      security_score: 80, quality_score: 85
    },
    {
      name: 'Create Shipment',
      method: 'POST',
      path: '/logistics/v1/shipments',
      description: 'Create a new shipment order',
      spec: JSON.stringify({ openapi: '3.0.0', info: { title: 'Create Shipment', version: '1.0.0' }, paths: { '/logistics/v1/shipments': { post: { summary: 'Create shipment', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['origin', 'destination', 'items'], properties: { origin: { type: 'string' }, destination: { type: 'string' }, items: { type: 'array', items: { type: 'object', properties: { sku: { type: 'string' }, quantity: { type: 'integer' } } } }, carrier: { type: 'string', enum: ['fedex', 'ups', 'dhl', 'usps'] }, priority: { type: 'string', enum: ['standard', 'express', 'overnight'] } } } } } }, responses: { '201': { description: 'Shipment created' } }, security: [{ authToken: [] }] } } } }),
      security_score: 88, quality_score: 87
    }
  ];
}

// ─── NGINX API Gateway mock APIs ─────────────────────────────────────────────
function generateMockNginxApis(gatewayId, config) {
  return [
    {
      name: 'Get Metrics',
      method: 'GET',
      path: '/monitoring/v1/metrics',
      description: 'Retrieve system performance metrics',
      spec: JSON.stringify({ openapi: '3.0.0', info: { title: 'Get Metrics', version: '1.0.0' }, paths: { '/monitoring/v1/metrics': { get: { summary: 'System metrics', parameters: [{ name: 'period', in: 'query', schema: { type: 'string', enum: ['1m', '5m', '15m', '1h', '24h'] }, description: 'Metric window' }, { name: 'service', in: 'query', schema: { type: 'string' }, description: 'Filter by service name' }], responses: { '200': { description: 'Metric data' } }, security: [{ bearerAuth: [] }] } } } }),
      security_score: 78, quality_score: 90
    },
    {
      name: 'Upload File',
      method: 'POST',
      path: '/storage/v1/upload',
      description: 'Upload file to object storage',
      spec: JSON.stringify({ openapi: '3.0.0', info: { title: 'Upload File', version: '1.0.0' }, paths: { '/storage/v1/upload': { post: { summary: 'Upload a file', requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' }, bucket: { type: 'string', default: 'default' }, path: { type: 'string' } } } } } }, responses: { '201': { description: 'File uploaded' }, '413': { description: 'File too large' } }, security: [{ bearerAuth: [] }] } } } }),
      security_score: 84, quality_score: 86
    },
    {
      name: 'Get Config',
      method: 'GET',
      path: '/admin/v1/config',
      description: 'Retrieve current NGINX configuration',
      spec: JSON.stringify({ openapi: '3.0.0', info: { title: 'Get Config', version: '1.0.0' }, paths: { '/admin/v1/config': { get: { summary: 'Get current config', responses: { '200': { description: 'NGINX configuration' } }, security: [{ bearerAuth: [] }] } } } }),
      security_score: 70, quality_score: 75
    },
    {
      name: 'Health Status',
      method: 'GET',
      path: '/admin/v1/health',
      description: 'NGINX health check and upstream status',
      spec: JSON.stringify({ openapi: '3.0.0', info: { title: 'Health Status', version: '1.0.0' }, paths: { '/admin/v1/health': { get: { summary: 'Health check', responses: { '200': { description: 'Service healthy', content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string' }, upstreams: { type: 'object' }, activeConnections: { type: 'integer' } } } } } } } } } } }),
      security_score: 65, quality_score: 88
    }
  ];
}

export async function registerGateway(name, type, config) {
  const id = uuidv4();

  // Store config but strip sensitive credentials before persisting
  const configToStore = { ...config };
  delete configToStore.accessKeyId;
  delete configToStore.secretAccessKey;
  delete configToStore.clientSecret;
  delete configToStore.authToken;
  delete configToStore.password;

  const stmt = db.prepare('INSERT INTO gateways (id, name, type, config) VALUES (?, ?, ?, ?)');
  stmt.run(id, name, type, JSON.stringify(configToStore));

  // Discover APIs from the gateway
  let apis = [];
  if (type === 'aws') {
    // Try real AWS discovery first, fall back to mock data
    const realApis = await discoverRealAwsApis(id, config);
    apis = realApis || generateMockAwsApis(id, JSON.stringify(config));
  } else if (type === 'kong') {
    apis = generateMockKongApis(id, JSON.stringify(config));
  } else if (type === 'azure') {
    apis = generateMockAzureApis(id, config);
  } else if (type === 'mulesoft') {
    apis = generateMockMuleSoftApis(id, config);
  } else if (type === 'apigee') {
    apis = generateMockApigeeApis(id, config);
  } else if (type === 'tyk') {
    apis = generateMockTykApis(id, config);
  } else if (type === 'nginx') {
    apis = generateMockNginxApis(id, config);
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
