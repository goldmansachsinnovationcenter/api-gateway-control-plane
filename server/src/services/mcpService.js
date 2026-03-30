import db from '../models/database.js';

/**
 * MCP Tool Generation Service
 * Converts API specs into MCP-compatible tool definitions
 * and manages MCP server endpoints for products
 */

export function generateToolsForProduct(productId) {
  const apis = db.prepare(`
    SELECT apis.*, gateways.name as gateway_name, gateways.type as gateway_type,
           gateways.config as gateway_config
    FROM apis 
    JOIN product_apis ON apis.id = product_apis.api_id 
    JOIN gateways ON apis.gateway_id = gateways.id
    WHERE product_apis.product_id = ?
  `).all(productId);

  return apis.map(api => specToMcpTool(api));
}

function specToMcpTool(api) {
  const spec = JSON.parse(api.spec || '{}');
  const paths = spec.paths || {};
  const toolName = generateToolName(api.method, api.path);

  let inputSchema = { type: 'object', properties: {}, required: [] };
  let description = api.description || api.name;

  for (const [pathKey, pathObj] of Object.entries(paths)) {
    const method = api.method.toLowerCase();
    const operation = pathObj[method];
    if (!operation) continue;

    description = operation.summary || operation.description || description;

    // Extract parameters
    if (operation.parameters) {
      for (const param of operation.parameters) {
        const paramSchema = param.schema || { type: 'string' };
        inputSchema.properties[param.name] = {
          ...paramSchema,
          description: param.description || param.name
        };
        if (param.required) {
          inputSchema.required.push(param.name);
        }
      }
    }

    // Extract request body
    if (operation.requestBody?.content?.['application/json']?.schema) {
      const bodySchema = operation.requestBody.content['application/json'].schema;
      if (bodySchema.properties) {
        for (const [propName, propSchema] of Object.entries(bodySchema.properties)) {
          inputSchema.properties[propName] = {
            ...propSchema,
            description: propSchema.description || propName
          };
        }
      }
      if (bodySchema.required) {
        inputSchema.required.push(...bodySchema.required);
      }
    }
  }

  // Determine annotations
  const isReadOnly = ['GET', 'HEAD', 'OPTIONS'].includes(api.method.toUpperCase());
  const isDestructive = ['DELETE'].includes(api.method.toUpperCase());

  return {
    name: toolName,
    description,
    inputSchema,
    annotations: {
      readOnlyHint: isReadOnly,
      destructiveHint: isDestructive,
      idempotentHint: ['GET', 'PUT', 'DELETE'].includes(api.method.toUpperCase()),
      openWorldHint: true
    },
    _meta: {
      apiId: api.id,
      gatewayName: api.gateway_name,
      gatewayType: api.gateway_type,
      method: api.method,
      path: api.path
    }
  };
}

function generateToolName(method, path) {
  const cleanPath = path
    .replace(/^\//, '')
    .replace(/\{([^}]+)\}/g, 'by_$1')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/_$/, '');
  return `${method.toLowerCase()}_${cleanPath}`;
}

export function getMcpServerInfo(productId) {
  return db.prepare('SELECT * FROM mcp_servers WHERE product_id = ?').get(productId);
}

export function validateMcpApiKey(productId, apiKey) {
  const server = db.prepare('SELECT * FROM mcp_servers WHERE product_id = ? AND api_key = ?')
    .get(productId, apiKey);
  return !!server;
}

/**
 * Simulate executing a tool call by proxying through the gateway
 * In production, this would make real HTTP calls through the registered gateway
 */
export function executeToolCall(tool, args) {
  const { method, path, gatewayType } = tool._meta;

  // Simulate gateway proxy response
  const mockResponses = {
    GET: {
      status: 200,
      data: {
        message: `Successfully retrieved data from ${path}`,
        params: args,
        timestamp: new Date().toISOString(),
        source: `${gatewayType} gateway`
      }
    },
    POST: {
      status: 201,
      data: {
        message: `Successfully created resource at ${path}`,
        id: `mock-${Date.now()}`,
        input: args,
        timestamp: new Date().toISOString(),
        source: `${gatewayType} gateway`
      }
    },
    PUT: {
      status: 200,
      data: {
        message: `Successfully updated resource at ${path}`,
        input: args,
        timestamp: new Date().toISOString(),
        source: `${gatewayType} gateway`
      }
    },
    DELETE: {
      status: 204,
      data: {
        message: `Successfully deleted resource at ${path}`,
        timestamp: new Date().toISOString(),
        source: `${gatewayType} gateway`
      }
    }
  };

  return mockResponses[method.toUpperCase()] || mockResponses.GET;
}
