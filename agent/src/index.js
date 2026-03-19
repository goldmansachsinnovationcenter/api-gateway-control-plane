#!/usr/bin/env node

/**
 * MCP Demo Agent
 * 
 * Interactive CLI agent that connects to the locally running MCP server,
 * discovers available tools, and lets you execute them.
 * 
 * Usage:
 *   node src/index.js
 * 
 * Prerequisites:
 *   - Backend server running on http://localhost:3001
 *   - At least one gateway registered with APIs
 *   - At least one product created with APIs assigned and MCP enabled
 */

import http from 'http';
import readline from 'readline';

const BASE_URL = process.env.MCP_BASE_URL || 'http://localhost:3001';
const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  white: '\x1b[37m',
  bgBlue: '\x1b[44m',
  bgGreen: '\x1b[42m',
};

function c(color, text) {
  return `${COLORS[color]}${text}${COLORS.reset}`;
}

// HTTP request helper
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

// MCP JSON-RPC call
async function mcpCall(productId, apiKey, method, params = {}) {
  const res = await request(`/mcp/${productId}`, {
    method: 'POST',
    headers: { 'x-api-key': apiKey },
    body: {
      jsonrpc: '2.0',
      method,
      params,
      id: Date.now(),
    },
  });
  return res.data;
}

// Readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

function printBanner() {
  console.log('');
  console.log(c('cyan', '  ================================================'));
  console.log(c('cyan', '  |') + c('bold', '     MCP Demo Agent                          ') + c('cyan', '|'));
  console.log(c('cyan', '  |') + c('dim', '     Interactive tool caller for MCP servers   ') + c('cyan', '|'));
  console.log(c('cyan', '  ================================================'));
  console.log('');
  console.log(c('dim', `  Connecting to: ${BASE_URL}`));
  console.log('');
}

function printTools(tools) {
  console.log('');
  console.log(c('bold', `  Available Tools (${tools.length}):`));
  console.log(c('dim', '  ' + '-'.repeat(50)));
  tools.forEach((tool, i) => {
    const readOnly = tool.annotations?.readOnlyHint ? c('green', ' [READ]') : '';
    const destructive = tool.annotations?.destructiveHint ? c('red', ' [DESTRUCTIVE]') : '';
    console.log(`  ${c('yellow', `[${i + 1}]`)} ${c('bold', tool.name)}${readOnly}${destructive}`);
    console.log(`      ${c('dim', tool.description)}`);
    if (tool.inputSchema?.properties && Object.keys(tool.inputSchema.properties).length > 0) {
      const params = Object.entries(tool.inputSchema.properties)
        .map(([name, schema]) => {
          const required = tool.inputSchema.required?.includes(name) ? c('red', '*') : '';
          return `${name}${required}:${schema.type || 'any'}`;
        })
        .join(', ');
      console.log(`      ${c('cyan', 'params:')} ${params}`);
    }
  });
  console.log('');
}

async function collectArguments(tool) {
  const args = {};
  const properties = tool.inputSchema?.properties || {};
  const required = tool.inputSchema?.required || [];

  if (Object.keys(properties).length === 0) {
    return args;
  }

  console.log('');
  console.log(c('bold', '  Enter arguments:'));
  console.log(c('dim', '  (press Enter to skip optional parameters)'));
  console.log('');

  for (const [name, schema] of Object.entries(properties)) {
    const isRequired = required.includes(name);
    const reqLabel = isRequired ? c('red', ' (required)') : c('dim', ' (optional)');
    const typeLabel = c('cyan', schema.type || 'string');
    let enumLabel = '';
    if (schema.enum) {
      enumLabel = c('dim', ` [${schema.enum.join(', ')}]`);
    }
    const desc = schema.description ? c('dim', ` - ${schema.description}`) : '';
    const defaultVal = schema.default !== undefined ? c('dim', ` (default: ${schema.default})`) : '';

    const value = await prompt(
      `  ${c('yellow', name)} (${typeLabel})${reqLabel}${enumLabel}${defaultVal}${desc}: `
    );

    if (value !== '') {
      if (schema.type === 'integer' || schema.type === 'number') {
        args[name] = Number(value);
      } else if (schema.type === 'boolean') {
        args[name] = value.toLowerCase() === 'true' || value === '1';
      } else if (schema.type === 'object' || schema.type === 'array') {
        try {
          args[name] = JSON.parse(value);
        } catch {
          args[name] = value;
        }
      } else {
        args[name] = value;
      }
    } else if (isRequired) {
      console.log(c('red', `    This parameter is required!`));
      return collectArguments(tool); // retry
    }
  }

  return args;
}

async function main() {
  printBanner();

  // Step 1: Check server health
  try {
    await request('/api/health');
    console.log(c('green', '  Connected to control plane server'));
  } catch {
    console.log(c('red', `  ERROR: Cannot connect to ${BASE_URL}`));
    console.log(c('dim', '  Make sure the backend server is running:'));
    console.log(c('dim', '    cd server && node src/index.js'));
    rl.close();
    process.exit(1);
  }

  // Step 2: Fetch products with MCP enabled
  const productsRes = await request('/api/products');
  const allProducts = productsRes.data || [];
  const mcpProducts = allProducts.filter(
    (p) => p.mcp_enabled === 1 && p.mcpServer
  );

  if (mcpProducts.length === 0) {
    console.log('');
    console.log(c('yellow', '  No MCP-enabled products found.'));
    console.log(c('dim', '  To use this agent:'));
    console.log(c('dim', '  1. Open http://localhost:5173 in your browser'));
    console.log(c('dim', '  2. Register a gateway (AWS or Kong)'));
    console.log(c('dim', '  3. Create a product and assign APIs to it'));
    console.log(c('dim', '  4. Enable MCP for the product'));
    console.log(c('dim', '  5. Run this agent again'));
    console.log('');

    const setupNow = await prompt(
      c('yellow', '  Would you like to auto-setup a demo? (y/n): ')
    );
    if (setupNow.toLowerCase() === 'y') {
      await autoSetup();
      return main(); // restart
    }

    rl.close();
    process.exit(0);
  }

  // Step 3: Select a product
  console.log('');
  console.log(c('bold', '  MCP-Enabled Products:'));
  mcpProducts.forEach((p, i) => {
    const apiCount = p.apis?.length || 0;
    console.log(
      `  ${c('yellow', `[${i + 1}]`)} ${c('bold', p.name)} ${c('dim', `(${apiCount} APIs, endpoint: ${p.mcpServer.endpoint})`)}`
    );
  });
  console.log('');

  let selectedProduct;
  if (mcpProducts.length === 1) {
    selectedProduct = mcpProducts[0];
    console.log(c('dim', `  Auto-selected: ${selectedProduct.name}`));
  } else {
    const choice = await prompt(c('cyan', '  Select product [1]: '));
    const idx = (parseInt(choice) || 1) - 1;
    selectedProduct = mcpProducts[idx] || mcpProducts[0];
  }

  const productId = selectedProduct.id;
  const apiKey = selectedProduct.mcpServer.api_key;

  // Step 4: Initialize MCP connection
  console.log('');
  console.log(c('dim', '  Initializing MCP connection...'));
  const initResult = await mcpCall(productId, apiKey, 'initialize');
  if (initResult.result) {
    const info = initResult.result.serverInfo;
    console.log(
      c('green', `  Connected to MCP server: ${info.name} v${info.version}`)
    );
    console.log(
      c('dim', `  Protocol: ${initResult.result.protocolVersion}`)
    );
  }

  // Step 5: List tools
  const toolsResult = await mcpCall(productId, apiKey, 'tools/list');
  const tools = toolsResult.result?.tools || [];

  if (tools.length === 0) {
    console.log(c('yellow', '  No tools available. Assign APIs to this product first.'));
    rl.close();
    process.exit(0);
  }

  printTools(tools);

  // Step 6: Interactive tool execution loop
  console.log(c('bold', '  Commands:'));
  console.log(c('dim', '    [number]  - Execute a tool by number'));
  console.log(c('dim', '    list      - Show available tools'));
  console.log(c('dim', '    info N    - Show detailed info for tool N'));
  console.log(c('dim', '    quick N   - Execute tool N with empty/default args'));
  console.log(c('dim', '    all       - Execute ALL tools sequentially'));
  console.log(c('dim', '    quit      - Exit'));
  console.log('');

  while (true) {
    const input = await prompt(c('cyan', '  agent> '));

    if (input === 'quit' || input === 'exit' || input === 'q') {
      console.log(c('dim', '\n  Goodbye!\n'));
      break;
    }

    if (input === 'list' || input === 'ls') {
      printTools(tools);
      continue;
    }

    if (input.startsWith('info ')) {
      const idx = parseInt(input.split(' ')[1]) - 1;
      const tool = tools[idx];
      if (!tool) {
        console.log(c('red', '  Invalid tool number'));
        continue;
      }
      console.log('');
      console.log(c('bold', `  Tool: ${tool.name}`));
      console.log(c('dim', `  Description: ${tool.description}`));
      console.log(c('dim', `  Annotations: ${JSON.stringify(tool.annotations, null, 2)}`));
      console.log(c('dim', `  Input Schema:`));
      console.log(c('dim', `  ${JSON.stringify(tool.inputSchema, null, 2)}`));
      console.log('');
      continue;
    }

    if (input.startsWith('quick ')) {
      const idx = parseInt(input.split(' ')[1]) - 1;
      const tool = tools[idx];
      if (!tool) {
        console.log(c('red', '  Invalid tool number'));
        continue;
      }
      console.log(c('dim', `\n  Executing ${tool.name} with default args...`));
      const result = await mcpCall(productId, apiKey, 'tools/call', {
        name: tool.name,
        arguments: {},
      });
      printResult(tool.name, {}, result);
      continue;
    }

    if (input === 'all') {
      console.log(c('bold', '\n  Executing all tools...\n'));
      for (const tool of tools) {
        console.log(c('yellow', `  --- ${tool.name} ---`));
        const result = await mcpCall(productId, apiKey, 'tools/call', {
          name: tool.name,
          arguments: {},
        });
        printResult(tool.name, {}, result);
      }
      continue;
    }

    // Try as tool number
    const toolIdx = parseInt(input) - 1;
    if (!isNaN(toolIdx) && toolIdx >= 0 && toolIdx < tools.length) {
      const tool = tools[toolIdx];
      console.log(c('bold', `\n  Selected: ${tool.name}`));
      console.log(c('dim', `  ${tool.description}`));

      const args = await collectArguments(tool);

      console.log('');
      console.log(c('dim', `  Executing ${tool.name}...`));
      console.log(c('dim', `  Arguments: ${JSON.stringify(args)}`));

      const result = await mcpCall(productId, apiKey, 'tools/call', {
        name: tool.name,
        arguments: args,
      });

      printResult(tool.name, args, result);
      continue;
    }

    console.log(c('dim', '  Unknown command. Type "list" or a tool number.'));
  }

  rl.close();
}

function printResult(toolName, args, result) {
  console.log('');
  if (result.error) {
    console.log(c('red', `  ERROR: ${result.error.message}`));
  } else {
    console.log(c('green', '  Result:'));
    const content = result.result?.content || [];
    for (const item of content) {
      if (item.type === 'text') {
        try {
          const parsed = JSON.parse(item.text);
          console.log(c('white', '  ' + JSON.stringify(parsed, null, 2).replace(/\n/g, '\n  ')));
        } catch {
          console.log(c('white', `  ${item.text}`));
        }
      }
    }
  }
  console.log('');
}

async function autoSetup() {
  console.log('');
  console.log(c('yellow', '  Setting up demo environment...'));

  // Register a gateway
  console.log(c('dim', '  1. Registering AWS API Gateway...'));
  const gwRes = await request('/api/gateways', {
    method: 'POST',
    body: {
      name: 'Demo AWS Gateway',
      type: 'aws',
      config: { region: 'us-east-1', accountId: 'demo-account' },
    },
  });

  if (gwRes.status >= 400) {
    console.log(c('red', `  Failed to register gateway: ${JSON.stringify(gwRes.data)}`));
    return;
  }

  const gateway = gwRes.data;
  console.log(c('green', `  Gateway registered: ${gateway.name} (${gateway.apiCount} APIs discovered)`));

  // Fetch discovered APIs
  const apisRes = await request(`/api/apis?gateway_id=${gateway.id}`);
  const apis = apisRes.data || [];

  // Create a product
  console.log(c('dim', '  2. Creating product...'));
  const prodRes = await request('/api/products', {
    method: 'POST',
    body: {
      name: 'Demo API Product',
      description: 'Auto-created product for demo agent testing',
    },
  });
  const product = prodRes.data;
  console.log(c('green', `  Product created: ${product.name}`));

  // Assign all APIs to the product
  console.log(c('dim', '  3. Assigning APIs to product...'));
  for (const api of apis) {
    await request(`/api/products/${product.id}/apis`, {
      method: 'POST',
      body: { apiId: api.id },
    });
  }
  console.log(c('green', `  Assigned ${apis.length} APIs`));

  // Enable MCP
  console.log(c('dim', '  4. Enabling MCP...'));
  const mcpRes = await request(`/api/products/${product.id}/mcp/toggle`, {
    method: 'POST',
    body: { enabled: true },
  });
  console.log(c('green', `  MCP enabled! Endpoint: ${mcpRes.data.mcpServer?.endpoint}`));
  console.log(c('green', `  API Key: ${mcpRes.data.mcpServer?.apiKey}`));

  console.log('');
  console.log(c('green', '  Demo setup complete! Restarting agent...'));
  console.log('');
}

main().catch((err) => {
  console.error(c('red', `\n  Fatal error: ${err.message}\n`));
  rl.close();
  process.exit(1);
});
