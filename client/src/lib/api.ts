const BASE_URL = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export interface GatewayConfig {
  region?: string;
  adminUrl?: string;
  apiKey?: string;
  accountId?: string;
  restApiId?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  stageName?: string;
}

export interface Gateway {
  id: string;
  name: string;
  type: 'aws' | 'kong' | 'custom';
  config: GatewayConfig;
  status: string;
  apiCount: number;
  created_at: string;
  updated_at: string;
  apis?: Api[];
}

export interface Api {
  id: string;
  gateway_id: string;
  gateway_name?: string;
  gateway_type?: string;
  name: string;
  method: string;
  path: string;
  description: string;
  spec: Record<string, unknown> | null;
  security_score: number;
  quality_score: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface McpServer {
  id: string;
  product_id: string;
  endpoint: string;
  api_key: string;
  status: string;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  mcp_enabled: number;
  mcp_server_url: string | null;
  mcp_api_key: string | null;
  apis: Api[];
  mcpServer: McpServer | null;
  created_at: string;
  updated_at: string;
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required: string[];
  };
  annotations: {
    readOnlyHint: boolean;
    destructiveHint: boolean;
    idempotentHint: boolean;
    openWorldHint: boolean;
  };
  _meta: {
    apiId: string;
    gatewayName: string;
    gatewayType: string;
    method: string;
    path: string;
  };
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  product_id: string | null;
  status: 'idle' | 'running' | 'error';
  model: string;
  system_prompt: string;
  product: { id: string; name: string; mcp_enabled: number } | null;
  mcpServer: McpServer | null;
  logCount: number;
  successCount: number;
  successRate: number;
  avgResponseMs: number;
  lastActive: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentLog {
  id: string;
  agent_id: string;
  tool_name: string;
  args: string;
  result: string;
  success: number;
  duration_ms: number;
  created_at: string;
}

export interface CloudAgent {
  id: string;
  aws_agent_id: string;
  aws_agent_version: string;
  name: string;
  description: string;
  status: string;
  foundation_model: string;
  instruction: string;
  idle_session_ttl: number;
  agent_arn: string;
  alias_id: string | null;
  alias_arn: string | null;
  region: string;
  gateway_id: string | null;
  enabled: number;
  last_synced: string | null;
  gateway: { id: string; name: string; type: string } | null;
  logCount: number;
  successCount: number;
  successRate: number;
  logs?: CloudAgentLog[];
  created_at: string;
  updated_at: string;
}

export interface CloudAgentLog {
  id: string;
  cloud_agent_id: string;
  session_id: string;
  input_text: string;
  output_text: string;
  success: number;
  duration_ms: number;
  trace: string | null;
  created_at: string;
}

export const gatewaysApi = {
  list: () => request<Gateway[]>('/gateways'),
  get: (id: string) => request<Gateway>(`/gateways/${id}`),
  create: (data: { name: string; type: string; config: GatewayConfig }) =>
    request<Gateway>('/gateways', { method: 'POST', body: JSON.stringify(data) }),
  delete: (id: string) => request<void>(`/gateways/${id}`, { method: 'DELETE' }),
};

export const apisApi = {
  list: (gatewayId?: string) =>
    request<Api[]>(`/apis${gatewayId ? `?gateway_id=${gatewayId}` : ''}`),
  get: (id: string) => request<Api>(`/apis/${id}`),
  updateSpec: (id: string, spec: unknown) =>
    request<Api>(`/apis/${id}/spec`, { method: 'PUT', body: JSON.stringify({ spec }) }),
};

export const productsApi = {
  list: () => request<Product[]>('/products'),
  get: (id: string) => request<Product>(`/products/${id}`),
  create: (data: { name: string; description?: string }) =>
    request<Product>('/products', { method: 'POST', body: JSON.stringify(data) }),
  delete: (id: string) => request<void>(`/products/${id}`, { method: 'DELETE' }),
  assignApi: (productId: string, apiId: string) =>
    request<Product>(`/products/${productId}/apis`, { method: 'POST', body: JSON.stringify({ apiId }) }),
  unassignApi: (productId: string, apiId: string) =>
    request<Product>(`/products/${productId}/apis/${apiId}`, { method: 'DELETE' }),
  getAvailableApis: (productId: string) =>
    request<Api[]>(`/products/${productId}/available-apis`),
  toggleMcp: (productId: string, enabled: boolean) =>
    request<{ product: Product; mcpServer: McpServer | null }>(`/products/${productId}/mcp/toggle`, {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    }),
  getMcpTools: (productId: string) =>
    request<McpTool[]>(`/products/${productId}/mcp/tools`),
  testMcpTool: (productId: string, toolName: string, args: Record<string, unknown>) =>
    request<{ tool: string; input: Record<string, unknown>; output: unknown }>(`/products/${productId}/mcp/test`, {
      method: 'POST',
      body: JSON.stringify({ toolName, args }),
    }),
};

export const agentsApi = {
  list: () => request<Agent[]>('/agents'),
  get: (id: string) => request<Agent>(`/agents/${id}`),
  create: (data: { name: string; description?: string; productId?: string; model?: string; systemPrompt?: string }) =>
    request<Agent>('/agents', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<{ name: string; description: string; product_id: string; model: string; system_prompt: string; status: string }>) =>
    request<Agent>(`/agents/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request<void>(`/agents/${id}`, { method: 'DELETE' }),
  getLogs: (id: string, limit?: number) =>
    request<AgentLog[]>(`/agents/${id}/logs${limit ? `?limit=${limit}` : ''}`),
  clearLogs: (id: string) => request<void>(`/agents/${id}/logs`, { method: 'DELETE' }),
  executeTool: (id: string, toolName: string, args: Record<string, unknown>) =>
    request<{ logId: string; tool: string; args: Record<string, unknown>; result: unknown; success: boolean; durationMs: number }>(
      `/agents/${id}/execute`, { method: 'POST', body: JSON.stringify({ toolName, args }) }
    ),
  runAll: (id: string) =>
    request<Array<{ logId: string; tool: string; args: Record<string, unknown>; result: unknown; success: boolean; durationMs: number }>>(
      `/agents/${id}/run-all`, { method: 'POST' }
    ),
  clone: (id: string) => request<Agent>(`/agents/${id}/clone`, { method: 'POST' }),
  exportLogs: (id: string) =>
    request<{ agent: { id: string; name: string }; logs: AgentLog[]; exportedAt: string }>(`/agents/${id}/export`),
};

export const cloudAgentsApi = {
  list: () => request<CloudAgent[]>('/cloud-agents'),
  get: (id: string) => request<CloudAgent>(`/cloud-agents/${id}`),
  discover: (gatewayId: string, credentials?: { accessKeyId: string; secretAccessKey: string; region: string }) =>
    request<{ discovered: number; imported: CloudAgent[] }>('/cloud-agents/discover', {
      method: 'POST',
      body: JSON.stringify({ gatewayId, credentials }),
    }),
  enable: (id: string) => request<CloudAgent>(`/cloud-agents/${id}/enable`, { method: 'POST' }),
  disable: (id: string) => request<CloudAgent>(`/cloud-agents/${id}/disable`, { method: 'POST' }),
  invoke: (id: string, inputText: string, sessionId?: string) =>
    request<{ logId: string; sessionId: string; inputText: string; outputText: string; success: boolean; durationMs: number }>(
      `/cloud-agents/${id}/invoke`, { method: 'POST', body: JSON.stringify({ inputText, sessionId }) }
    ),
  sync: (id: string) => request<CloudAgent>(`/cloud-agents/${id}/sync`, { method: 'POST' }),
  getLogs: (id: string, limit?: number) =>
    request<CloudAgentLog[]>(`/cloud-agents/${id}/logs${limit ? `?limit=${limit}` : ''}`),
  clearLogs: (id: string) => request<void>(`/cloud-agents/${id}/logs`, { method: 'DELETE' }),
  exportLogs: (id: string) =>
    request<{ agent: { id: string; name: string; awsAgentId: string }; logs: CloudAgentLog[]; exportedAt: string }>(
      `/cloud-agents/${id}/export`
    ),
  delete: (id: string) => request<void>(`/cloud-agents/${id}`, { method: 'DELETE' }),
};
