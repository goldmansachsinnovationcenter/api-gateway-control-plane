#!/usr/bin/env node

/**
 * MCP Auto Agent
 * 
 * Non-interactive demo agent that automatically:
 * 1. Sets up a gateway + product if none exist
 * 2. Connects to the MCP server
 * 3. Discovers and executes ALL available tools
 * 4. Prints a summary report
 * 
 * Usage:
 *   node src/auto-agent.js
 *   npm run auto
 */

import http from 'http';

const BASE_URL = process.env.MCP_BASE_URL || 'http://localhost:3001';

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

async function mcpCall(productId, apiKey, method, params = {}) {
  const res = await request(`/mcp/${productId}`, {
    method: 'POST',
    headers: { 'x-api-key': apiKey },
    body: { jsonrpc: '2.0', method, params, id: Date.now() },
  });
  return res.data;
}

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

function log(color, msg) {
  console.log(`${C[color]}${msg}${C.reset}`);
}

async function ensureSetup() {
  // Check for existing MCP-enabled products
  const productsRes = await request('/api/products');
  const products = productsRes.data || [];
  const mcpProducts = products.filter(p => p.mcp_enabled === 1 && p.mcpServer);

  if (mcpProducts.length > 0) {
    return mcpProducts[0];
  }

  log('yellow', '\n  No MCP-enabled products found. Setting up demo...\n');

  // Register gateway
  log('dim', '  Registering AWS API Gateway...');
  const gwRes = await request('/api/gateways', {
    method: 'POST',
    body: {
      name: 'Auto-Agent Demo Gateway',
      type: 'aws',
      config: { region: 'us-east-1', accountId: 'demo' },
    },
  });
  const gateway = gwRes.data;
  log('green', `  Gateway: ${gateway.name} (${gateway.apiCount} APIs)`);

  // Fetch the discovered APIs
  const apisRes = await request(`/api/apis?gateway_id=${gateway.id}`);
  const apis = apisRes.data || [];

  // Create product
  log('dim', '  Creating product...');
  const prodRes = await request('/api/products', {
    method: 'POST',
    body: {
      name: 'Auto-Agent Product',
      description: 'Created by auto-agent for MCP tool testing',
    },
  });
  const product = prodRes.data;

  // Assign APIs
  for (const api of apis) {
    await request(`/api/products/${product.id}/apis`, {
      method: 'POST',
      body: { apiId: api.id },
    });
  }
  log('green', `  Assigned ${apis.length} APIs to product`);

  // Enable MCP
  await request(`/api/products/${product.id}/mcp/toggle`, {
    method: 'POST',
    body: { enabled: true },
  });

  // Fetch updated product with mcpServer info
  const allProds = (await request('/api/products')).data || [];
  const mcpProduct = allProds.find(p => p.id === product.id);
  
  log('green', `  MCP enabled!\n`);
  return mcpProduct;
}

async function main() {
  console.log('');
  log('cyan', '  ================================================');
  log('cyan', '  |' + C.bold + '     MCP Auto Agent                          ' + C.cyan + '|');
  log('cyan', '  |' + C.dim + '     Automated tool discovery & execution     ' + C.cyan + '|');
  log('cyan', '  ================================================');
  console.log('');

  // Check server
  try {
    await request('/api/health');
    log('green', `  Connected to ${BASE_URL}`);
  } catch {
    log('red', `  ERROR: Cannot connect to ${BASE_URL}`);
    log('dim', '  Start the backend: cd server && node src/index.js');
    process.exit(1);
  }

  // Setup
  const product = await ensureSetup();
  const productId = product.id;
  const apiKey = product.mcpServer.api_key;

  // Initialize
  log('dim', '  Initializing MCP connection...');
  const init = await mcpCall(productId, apiKey, 'initialize');
  const serverInfo = init.result?.serverInfo;
  log('green', `  Server: ${serverInfo?.name} v${serverInfo?.version}`);
  log('dim', `  Protocol: ${init.result?.protocolVersion}`);

  // Discover tools
  console.log('');
  log('bold', '  Discovering tools...');
  const toolsResult = await mcpCall(productId, apiKey, 'tools/list');
  const tools = toolsResult.result?.tools || [];
  log('green', `  Found ${tools.length} tools\n`);

  // Execute each tool
  const results = [];
  for (let i = 0; i < tools.length; i++) {
    const tool = tools[i];
    const readOnly = tool.annotations?.readOnlyHint ? '[READ]' : '';
    const destructive = tool.annotations?.destructiveHint ? '[DESTRUCTIVE]' : '';

    log('yellow', `  [${i + 1}/${tools.length}] ${tool.name} ${readOnly}${destructive}`);
    log('dim', `  ${tool.description}`);

    // Build sample arguments from schema
    const sampleArgs = buildSampleArgs(tool.inputSchema);
    if (Object.keys(sampleArgs).length > 0) {
      log('dim', `  Args: ${JSON.stringify(sampleArgs)}`);
    }

    const start = Date.now();
    const result = await mcpCall(productId, apiKey, 'tools/call', {
      name: tool.name,
      arguments: sampleArgs,
    });
    const elapsed = Date.now() - start;

    if (result.error) {
      log('red', `  ERROR: ${result.error.message}`);
      results.push({ tool: tool.name, success: false, elapsed, error: result.error.message });
    } else {
      const content = result.result?.content?.[0]?.text;
      let parsed;
      try { parsed = JSON.parse(content); } catch { parsed = content; }
      log('green', `  Response (${elapsed}ms):`);
      const formatted = JSON.stringify(parsed, null, 2).split('\n');
      formatted.forEach(line => log('dim', `    ${line}`));
      results.push({ tool: tool.name, success: true, elapsed, response: parsed });
    }
    console.log('');
  }

  // Summary
  log('cyan', '  ================================================');
  log('bold', '  Summary Report');
  log('cyan', '  ================================================');
  console.log('');
  log('dim', `  Product: ${product.name}`);
  log('dim', `  MCP Endpoint: ${product.mcpServer.endpoint}`);
  log('dim', `  Tools tested: ${results.length}`);
  log('green', `  Successful: ${results.filter(r => r.success).length}`);
  const failed = results.filter(r => !r.success).length;
  if (failed > 0) log('red', `  Failed: ${failed}`);
  const avgTime = Math.round(results.reduce((sum, r) => sum + r.elapsed, 0) / results.length);
  log('dim', `  Avg response time: ${avgTime}ms`);
  console.log('');

  results.forEach((r, i) => {
    const icon = r.success ? C.green + 'PASS' : C.red + 'FAIL';
    console.log(`  ${icon}${C.reset} ${r.tool} (${r.elapsed}ms)`);
  });

  console.log('');
  log('green', '  Agent run complete!');
  console.log('');
}

function buildSampleArgs(schema) {
  const args = {};
  if (!schema?.properties) return args;

  for (const [name, prop] of Object.entries(schema.properties)) {
    // Only provide required args and a few optional ones for demo
    const isRequired = schema.required?.includes(name);
    if (!isRequired) continue;

    if (prop.enum) {
      args[name] = prop.enum[0];
    } else if (prop.type === 'string') {
      args[name] = prop.format === 'email' ? 'demo@example.com' : `sample-${name}`;
    } else if (prop.type === 'integer' || prop.type === 'number') {
      args[name] = prop.minimum || 1;
    } else if (prop.type === 'boolean') {
      args[name] = true;
    } else {
      args[name] = `sample-${name}`;
    }
  }

  return args;
}

main().catch(err => {
  log('red', `\n  Fatal: ${err.message}\n`);
  process.exit(1);
});
