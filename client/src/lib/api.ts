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
