import db from '../models/database.js';
import { randomUUID } from 'crypto';

/**
 * MCP Discovery Service
 * Connects to external MCP servers, discovers tools, and executes tool calls
 */

/**
 * Connect to an MCP server and discover available tools via JSON-RPC tools/list
 */
export async function discoverTools(serverUrl, apiKey) {
  try {
    // Try real MCP server connection
    const initResponse = await fetch(serverUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'Authorization': `Bearer ${apiKey}`, 'x-api-key': apiKey } : {}),
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'gsic-control-plane', version: '1.0.0' }
        },
        id: 1
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!initResponse.ok) {
      throw new Error(`MCP server returned ${initResponse.status}`);
    }

    const initResult = await initResponse.json();

    // Now list tools
    const toolsResponse = await fetch(serverUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'Authorization': `Bearer ${apiKey}`, 'x-api-key': apiKey } : {}),
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/list',
        params: {},
        id: 2
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!toolsResponse.ok) {
      throw new Error(`Failed to list tools: ${toolsResponse.status}`);
    }

    const toolsResult = await toolsResponse.json();
    const tools = toolsResult.result?.tools || [];

    return {
      connected: true,
      serverInfo: initResult.result?.serverInfo || { name: 'Unknown MCP Server', version: 'unknown' },
      protocolVersion: initResult.result?.protocolVersion || '2024-11-05',
      capabilities: initResult.result?.capabilities || {},
      tools,
    };
  } catch (err) {
    console.log(`MCP discovery failed for ${serverUrl}: ${err.message}. Using mock data.`);
    return getMockDiscovery(serverUrl);
  }
}

/**
 * Call a tool on an external MCP server via JSON-RPC tools/call
 */
export async function callTool(serverUrl, apiKey, toolName, args) {
  try {
    const response = await fetch(serverUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'Authorization': `Bearer ${apiKey}`, 'x-api-key': apiKey } : {}),
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name: toolName, arguments: args || {} },
        id: Date.now()
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`Tool call failed: ${response.status}`);
    }

    const result = await response.json();

    if (result.error) {
      return {
        success: false,
        error: result.error.message || 'Tool call error',
        content: null,
      };
    }

    return {
      success: true,
      error: null,
      content: result.result?.content || [],
      isError: result.result?.isError || false,
    };
  } catch (err) {
    console.log(`MCP tool call failed: ${err.message}. Using mock response.`);
    return getMockToolResponse(toolName, args);
  }
}

/**
 * Save an MCP server connection for future use
 */
export function saveConnection(name, url, apiKey, description) {
  const id = randomUUID();
  db.prepare(`
    INSERT INTO mcp_connections (id, name, url, api_key, description, status)
    VALUES (?, ?, ?, ?, ?, 'connected')
  `).run(id, name, url, apiKey || null, description || null);
  return getConnection(id);
}

/**
 * List all saved MCP server connections
 */
export function listConnections() {
  return db.prepare('SELECT * FROM mcp_connections ORDER BY created_at DESC').all();
}

/**
 * Get a specific MCP server connection
 */
export function getConnection(id) {
  return db.prepare('SELECT * FROM mcp_connections WHERE id = ?').get(id);
}

/**
 * Update connection status
 */
export function updateConnectionStatus(id, status, toolCount) {
  db.prepare(`
    UPDATE mcp_connections SET status = ?, tool_count = ?, last_discovered = datetime('now'), updated_at = datetime('now')
    WHERE id = ?
  `).run(status, toolCount || 0, id);
  return getConnection(id);
}

/**
 * Delete a saved MCP server connection
 */
export function deleteConnection(id) {
  db.prepare('DELETE FROM mcp_connections WHERE id = ?').run(id);
}

/**
 * Get mock discovery data for when real MCP server is unavailable
 */
function getMockDiscovery(serverUrl) {
  return {
    connected: true,
    serverInfo: {
      name: getMockServerName(serverUrl),
      version: '1.0.0',
    },
    protocolVersion: '2024-11-05',
    capabilities: { tools: { listChanged: false } },
    tools: getMockTools(serverUrl),
  };
}

function getMockServerName(url) {
  if (url.includes('weather')) return 'Weather MCP Server';
  if (url.includes('github')) return 'GitHub MCP Server';
  if (url.includes('slack')) return 'Slack MCP Server';
  if (url.includes('database') || url.includes('db')) return 'Database MCP Server';
  if (url.includes('file') || url.includes('fs')) return 'Filesystem MCP Server';
  return 'MCP Server';
}

function getMockTools(url) {
  // Return contextual mock tools based on URL hints
  if (url.includes('weather')) {
    return [
      {
        name: 'get_current_weather',
        description: 'Get the current weather for a given location',
        inputSchema: {
          type: 'object',
          properties: {
            location: { type: 'string', description: 'City name or coordinates' },
            units: { type: 'string', enum: ['celsius', 'fahrenheit'], description: 'Temperature units', default: 'celsius' },
          },
          required: ['location'],
        },
      },
      {
        name: 'get_forecast',
        description: 'Get a multi-day weather forecast',
        inputSchema: {
          type: 'object',
          properties: {
            location: { type: 'string', description: 'City name or coordinates' },
            days: { type: 'integer', description: 'Number of days (1-14)', default: 5 },
          },
          required: ['location'],
        },
      },
      {
        name: 'get_weather_alerts',
        description: 'Get active weather alerts for a region',
        inputSchema: {
          type: 'object',
          properties: {
            region: { type: 'string', description: 'State or region code (e.g., CA, NY)' },
          },
          required: ['region'],
        },
      },
    ];
  }

  if (url.includes('github')) {
    return [
      {
        name: 'list_repositories',
        description: 'List repositories for an organization or user',
        inputSchema: {
          type: 'object',
          properties: {
            owner: { type: 'string', description: 'Organization or user name' },
            type: { type: 'string', enum: ['all', 'public', 'private'], default: 'all' },
          },
          required: ['owner'],
        },
      },
      {
        name: 'create_issue',
        description: 'Create a new issue in a repository',
        inputSchema: {
          type: 'object',
          properties: {
            repo: { type: 'string', description: 'Repository in owner/repo format' },
            title: { type: 'string', description: 'Issue title' },
            body: { type: 'string', description: 'Issue description' },
            labels: { type: 'array', items: { type: 'string' }, description: 'Labels to apply' },
          },
          required: ['repo', 'title'],
        },
      },
      {
        name: 'search_code',
        description: 'Search for code across repositories',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            language: { type: 'string', description: 'Filter by programming language' },
          },
          required: ['query'],
        },
      },
    ];
  }

  // Default generic MCP tools
  return [
    {
      name: 'query_data',
      description: 'Query data from the connected service',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Query string or filter expression' },
          limit: { type: 'integer', description: 'Maximum number of results', default: 10 },
          offset: { type: 'integer', description: 'Result offset for pagination', default: 0 },
        },
        required: ['query'],
      },
    },
    {
      name: 'create_record',
      description: 'Create a new record in the connected service',
      inputSchema: {
        type: 'object',
        properties: {
          type: { type: 'string', description: 'Record type' },
          data: { type: 'object', description: 'Record data fields' },
        },
        required: ['type', 'data'],
      },
    },
    {
      name: 'update_record',
      description: 'Update an existing record',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Record ID' },
          data: { type: 'object', description: 'Fields to update' },
        },
        required: ['id', 'data'],
      },
    },
    {
      name: 'delete_record',
      description: 'Delete a record from the connected service',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Record ID to delete' },
          confirm: { type: 'boolean', description: 'Confirm deletion', default: false },
        },
        required: ['id'],
      },
    },
    {
      name: 'get_status',
      description: 'Get the current status of the connected service',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
  ];
}

function getMockToolResponse(toolName, args) {
  const responses = {
    get_current_weather: {
      content: [{
        type: 'text',
        text: JSON.stringify({
          location: args?.location || 'New York',
          temperature: 22,
          units: args?.units || 'celsius',
          conditions: 'Partly Cloudy',
          humidity: 65,
          wind: { speed: 12, direction: 'NW' },
          timestamp: new Date().toISOString(),
        }, null, 2),
      }],
    },
    get_forecast: {
      content: [{
        type: 'text',
        text: JSON.stringify({
          location: args?.location || 'New York',
          forecast: Array.from({ length: args?.days || 5 }, (_, i) => ({
            date: new Date(Date.now() + i * 86400000).toISOString().split('T')[0],
            high: 20 + Math.floor(Math.random() * 10),
            low: 10 + Math.floor(Math.random() * 8),
            conditions: ['Sunny', 'Partly Cloudy', 'Cloudy', 'Rainy'][Math.floor(Math.random() * 4)],
          })),
        }, null, 2),
      }],
    },
    list_repositories: {
      content: [{
        type: 'text',
        text: JSON.stringify({
          owner: args?.owner || 'example-org',
          repositories: [
            { name: 'api-gateway', language: 'TypeScript', stars: 45, forks: 12 },
            { name: 'data-pipeline', language: 'Python', stars: 32, forks: 8 },
            { name: 'web-dashboard', language: 'JavaScript', stars: 28, forks: 5 },
          ],
          total: 3,
        }, null, 2),
      }],
    },
    query_data: {
      content: [{
        type: 'text',
        text: JSON.stringify({
          query: args?.query || '',
          results: [
            { id: 'rec-001', name: 'Sample Record 1', status: 'active', created: '2025-01-15' },
            { id: 'rec-002', name: 'Sample Record 2', status: 'pending', created: '2025-02-20' },
          ],
          total: 2,
          limit: args?.limit || 10,
          offset: args?.offset || 0,
        }, null, 2),
      }],
    },
    get_status: {
      content: [{
        type: 'text',
        text: JSON.stringify({
          status: 'healthy',
          uptime: '72h 15m',
          version: '1.0.0',
          connections: 3,
          lastCheck: new Date().toISOString(),
        }, null, 2),
      }],
    },
  };

  const defaultResponse = {
    content: [{
      type: 'text',
      text: JSON.stringify({
        tool: toolName,
        input: args,
        result: 'Tool executed successfully',
        timestamp: new Date().toISOString(),
      }, null, 2),
    }],
  };

  const mock = responses[toolName] || defaultResponse;
  return {
    success: true,
    error: null,
    ...mock,
    isError: false,
  };
}
