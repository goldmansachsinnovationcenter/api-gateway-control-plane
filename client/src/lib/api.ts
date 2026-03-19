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

export interface AgentCoreRuntime {
  id: string;
  runtime_id: string;
  runtime_arn: string | null;
  name: string;
  description: string | null;
  status: string;
  version: string | null;
  region: string;
  gateway_id: string | null;
  last_synced: string | null;
  gateway: { id: string; name: string; type: string } | null;
  logCount: number;
  successCount: number;
  successRate: number;
  logs?: AgentCoreRuntimeLog[];
  created_at: string;
  updated_at: string;
}

export interface AgentCoreRuntimeLog {
  id: string;
  runtime_id: string;
  session_id: string | null;
  input_text: string;
  output_text: string;
  success: number;
  duration_ms: number;
  created_at: string;
}

export interface AgentCoreGatewayTarget {
  id: string;
  agentcore_gateway_id: string;
  target_id: string;
  name: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface AgentCoreGateway {
  id: string;
  ac_gateway_id: string;
  name: string;
  description: string | null;
  status: string;
  protocol_type: string;
  authorizer_type: string;
  region: string;
  gateway_id: string | null;
  target_count: number;
  last_synced: string | null;
  gateway: { id: string; name: string; type: string } | null;
  targets: AgentCoreGatewayTarget[];
  created_at: string;
  updated_at: string;
}

export interface Plan {
  id: string;
  product_id: string;
  name: string;
  description: string | null;
  rate_limit_per_minute: number;
  rate_limit_per_hour: number;
  rate_limit_per_day: number;
  quota_per_month: number;
  throttle_burst_limit: number;
  subscriberCount: number;
  subscriptions?: Subscription[];
  created_at: string;
  updated_at: string;
}

export interface SubscriptionUsage {
  currentMinute: number;
  currentHour: number;
  currentDay: number;
  currentMonth: number;
}

export interface Subscription {
  id: string;
  plan_id: string;
  application_name: string;
  api_key: string;
  status: 'active' | 'suspended' | 'revoked';
  plan_name?: string;
  product_id?: string;
  rate_limit_per_minute?: number;
  rate_limit_per_hour?: number;
  rate_limit_per_day?: number;
  quota_per_month?: number;
  throttle_burst_limit?: number;
  usage?: SubscriptionUsage;
  created_at: string;
  updated_at: string;
}

export interface ProductUsageSummary {
  totalSubscriptions: number;
  activeSubscriptions: number;
  totalRequestsThisMonth: number;
  subscriptions: Subscription[];
}

export const plansApi = {
  listForProduct: (productId: string) =>
    request<Plan[]>(`/products/${productId}/plans`),
  get: (id: string) => request<Plan>(`/plans/${id}`),
  create: (productId: string, data: {
    name: string; description?: string;
    rateLimitPerMinute?: number; rateLimitPerHour?: number;
    rateLimitPerDay?: number; quotaPerMonth?: number;
    throttleBurstLimit?: number;
  }) => request<Plan>(`/products/${productId}/plans`, {
    method: 'POST', body: JSON.stringify(data),
  }),
  update: (id: string, data: Partial<{
    name: string; description: string;
    rateLimitPerMinute: number; rateLimitPerHour: number;
    rateLimitPerDay: number; quotaPerMonth: number;
    throttleBurstLimit: number;
  }>) => request<Plan>(`/plans/${id}`, {
    method: 'PUT', body: JSON.stringify(data),
  }),
  delete: (id: string) => request<void>(`/plans/${id}`, { method: 'DELETE' }),
  listSubscriptions: (planId: string) =>
    request<Subscription[]>(`/plans/${planId}/subscriptions`),
  subscribe: (planId: string, applicationName: string) =>
    request<Subscription>(`/plans/${planId}/subscriptions`, {
      method: 'POST', body: JSON.stringify({ applicationName }),
    }),
  getSubscription: (id: string) =>
    request<Subscription>(`/subscriptions/${id}`),
  updateSubscriptionStatus: (id: string, status: string) =>
    request<Subscription>(`/subscriptions/${id}/status`, {
      method: 'PUT', body: JSON.stringify({ status }),
    }),
  deleteSubscription: (id: string) =>
    request<void>(`/subscriptions/${id}`, { method: 'DELETE' }),
  getProductUsage: (productId: string) =>
    request<ProductUsageSummary>(`/products/${productId}/usage`),
  getProductSubscriptions: (productId: string) =>
    request<Subscription[]>(`/products/${productId}/subscriptions`),
};

export const agentCoreApi = {
  discoverRuntimes: (gatewayId: string) =>
    request<{ discovered: number; imported: AgentCoreRuntime[] }>('/agentcore/discover/runtimes', {
      method: 'POST', body: JSON.stringify({ gatewayId }),
    }),
  discoverGateways: (gatewayId: string) =>
    request<{ discovered: number; imported: AgentCoreGateway[] }>('/agentcore/discover/gateways', {
      method: 'POST', body: JSON.stringify({ gatewayId }),
    }),
  listRuntimes: () => request<AgentCoreRuntime[]>('/agentcore/runtimes'),
  getRuntime: (id: string) => request<AgentCoreRuntime>(`/agentcore/runtimes/${id}`),
  invokeRuntime: (id: string, inputText: string, sessionId?: string) =>
    request<{ logId: string; sessionId: string; inputText: string; outputText: string; success: boolean; durationMs: number }>(
      `/agentcore/runtimes/${id}/invoke`, { method: 'POST', body: JSON.stringify({ inputText, sessionId }) }
    ),
  syncRuntime: (id: string) => request<AgentCoreRuntime>(`/agentcore/runtimes/${id}/sync`, { method: 'POST' }),
  getRuntimeLogs: (id: string, limit?: number) =>
    request<AgentCoreRuntimeLog[]>(`/agentcore/runtimes/${id}/logs${limit ? `?limit=${limit}` : ''}`),
  clearRuntimeLogs: (id: string) => request<void>(`/agentcore/runtimes/${id}/logs`, { method: 'DELETE' }),
  exportRuntimeLogs: (id: string) =>
    request<{ runtime: { id: string; name: string; runtime_id: string }; logs: AgentCoreRuntimeLog[]; exportedAt: string }>(
      `/agentcore/runtimes/${id}/export`
    ),
  deleteRuntime: (id: string) => request<void>(`/agentcore/runtimes/${id}`, { method: 'DELETE' }),
  listGateways: () => request<AgentCoreGateway[]>('/agentcore/gateways'),
  getGateway: (id: string) => request<AgentCoreGateway>(`/agentcore/gateways/${id}`),
  syncGateway: (id: string) => request<AgentCoreGateway>(`/agentcore/gateways/${id}/sync`, { method: 'POST' }),
  deleteGateway: (id: string) => request<void>(`/agentcore/gateways/${id}`, { method: 'DELETE' }),
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

// ─── Governance Types ────────────────────────────────────────────────────────

export interface CompliancePolicy {
  id: string;
  name: string;
  description: string | null;
  rule_type: string;
  rule_config: Record<string, unknown>;
  severity: 'critical' | 'high' | 'medium' | 'low';
  enabled: number;
  violationCount: number;
  created_at: string;
  updated_at: string;
}

export interface PolicyViolation {
  id: string;
  policy_id: string;
  api_id: string;
  violation_details: Record<string, unknown>;
  status: 'open' | 'resolved' | 'dismissed';
  resolved_at: string | null;
  policy_name: string;
  severity: string;
  rule_type: string;
  api_name: string;
  method: string;
  path: string;
  gateway_id: string;
  created_at: string;
}

export interface ApiLifecycle {
  id: string;
  api_id: string;
  version: string;
  status: 'active' | 'deprecated' | 'sunset' | 'retired';
  deprecation_date: string | null;
  sunset_date: string | null;
  successor_api_id: string | null;
  notes: string | null;
  api_name: string;
  method: string;
  path: string;
  security_score?: number;
  quality_score?: number;
  gateway_name?: string;
  created_at: string;
  updated_at: string;
}

export interface AuditLogEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor: string;
  changes: Record<string, unknown>;
  created_at: string;
}

export interface AuditLogStats {
  total: number;
  today: number;
  thisWeek: number;
  byType: Array<{ entity_type: string; count: number }>;
  byAction: Array<{ action: string; count: number }>;
  recent: AuditLogEntry[];
}

export interface DataClassification {
  id: string;
  api_id: string;
  classification: 'public' | 'internal' | 'confidential' | 'restricted';
  pii_flag: number;
  financial_flag: number;
  notes: string | null;
  api_name: string;
  method: string;
  path: string;
  security_score?: number;
  quality_score?: number;
  gateway_name?: string;
  created_at: string;
  updated_at: string;
}

export interface RiskCategory {
  name: string;
  score: number;
  risk: 'low' | 'medium' | 'high';
  details: string;
}

export interface ApiRisk {
  id: string;
  name: string;
  method: string;
  path: string;
  security_score: number;
  quality_score: number;
  gateway_name: string;
  overall: number;
  risk: 'low' | 'medium' | 'high';
  factors: string[];
}

export interface RiskAssessment {
  totalApis: number;
  overallRisk: 'low' | 'medium' | 'high';
  riskScore: number;
  avgSecurity: number;
  avgQuality: number;
  openViolations: number;
  deprecatedApis: number;
  unclassifiedApis: number;
  categories: RiskCategory[];
  apiRisks: ApiRisk[];
}

export interface RemediationSuggestion {
  category: string;
  severity: string;
  title: string;
  description: string;
  action: string;
}

export interface ApiStandard {
  id: string;
  name: string;
  description: string | null;
  category: string;
  rule: Record<string, unknown>;
  severity: 'critical' | 'high' | 'medium' | 'low';
  enabled: number;
  created_at: string;
  updated_at: string;
}

export interface GovernanceReport {
  type: string;
  generatedAt: string;
  title: string;
  [key: string]: unknown;
}

export const governanceApi = {
  // Policies
  listPolicies: () => request<CompliancePolicy[]>('/governance/policies'),
  getPolicy: (id: string) => request<CompliancePolicy>(`/governance/policies/${id}`),
  createPolicy: (data: { name: string; description?: string; ruleType: string; ruleConfig?: Record<string, unknown>; severity?: string; enabled?: boolean }) =>
    request<CompliancePolicy>('/governance/policies', { method: 'POST', body: JSON.stringify(data) }),
  updatePolicy: (id: string, data: Partial<{ name: string; description: string; ruleType: string; ruleConfig: Record<string, unknown>; severity: string; enabled: boolean }>) =>
    request<CompliancePolicy>(`/governance/policies/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePolicy: (id: string) => request<void>(`/governance/policies/${id}`, { method: 'DELETE' }),
  evaluatePolicies: () => request<{ evaluated: number; apisChecked: number; newViolations: number }>('/governance/policies/evaluate', { method: 'POST' }),

  // Violations
  listViolations: (policyId?: string, status?: string) => {
    const params = new URLSearchParams();
    if (policyId) params.set('policyId', policyId);
    if (status) params.set('status', status);
    const qs = params.toString();
    return request<PolicyViolation[]>(`/governance/violations${qs ? '?' + qs : ''}`);
  },
  resolveViolation: (id: string) => request<{ status: string }>(`/governance/violations/${id}/resolve`, { method: 'POST' }),
  dismissViolation: (id: string) => request<{ status: string }>(`/governance/violations/${id}/dismiss`, { method: 'POST' }),

  // Lifecycle
  listLifecycles: () => request<ApiLifecycle[]>('/governance/lifecycle'),
  getLifecycle: (apiId: string) => request<ApiLifecycle | null>(`/governance/lifecycle/${apiId}`),
  setLifecycle: (apiId: string, data: { version?: string; status?: string; deprecationDate?: string; sunsetDate?: string; successorApiId?: string; notes?: string }) =>
    request<ApiLifecycle>(`/governance/lifecycle/${apiId}`, { method: 'POST', body: JSON.stringify(data) }),
  deleteLifecycle: (apiId: string) => request<void>(`/governance/lifecycle/${apiId}`, { method: 'DELETE' }),

  // Audit Log
  listAuditLogs: (params?: { entityType?: string; action?: string; limit?: number; offset?: number }) => {
    const qs = new URLSearchParams();
    if (params?.entityType) qs.set('entityType', params.entityType);
    if (params?.action) qs.set('action', params.action);
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.offset) qs.set('offset', String(params.offset));
    const s = qs.toString();
    return request<AuditLogEntry[]>(`/governance/audit-log${s ? '?' + s : ''}`);
  },
  getAuditLogStats: () => request<AuditLogStats>('/governance/audit-log/stats'),

  // Data Classification
  listClassifications: () => request<DataClassification[]>('/governance/classifications'),
  getClassification: (apiId: string) => request<DataClassification | null>(`/governance/classifications/${apiId}`),
  setClassification: (apiId: string, data: { classification: string; piiFlag?: boolean; financialFlag?: boolean; notes?: string }) =>
    request<DataClassification>(`/governance/classifications/${apiId}`, { method: 'POST', body: JSON.stringify(data) }),

  // Risk
  getRiskAssessment: () => request<RiskAssessment>('/governance/risk'),

  // Remediation
  getRemediations: (apiId: string) => request<RemediationSuggestion[]>(`/governance/remediations/${apiId}`),

  // Dependencies
  getAllDependencies: () => request<Array<Api & { products: Array<{ id: string; name: string }>; agents: Array<{ id: string; name: string }>; totalDependents: number }>>('/governance/dependencies'),
  getApiDependencies: (apiId: string) => request<{ products: Array<{ id: string; name: string }>; agents: Array<{ id: string; name: string }>; totalDependents: number }>(`/governance/dependencies/${apiId}`),

  // Reports
  generateReport: (type: string) => request<GovernanceReport>(`/governance/reports/${type}`),

  // Standards
  listStandards: () => request<ApiStandard[]>('/governance/standards'),
  createStandard: (data: { name: string; description?: string; category?: string; rule?: Record<string, unknown>; severity?: string; enabled?: boolean }) =>
    request<ApiStandard>('/governance/standards', { method: 'POST', body: JSON.stringify(data) }),
  updateStandard: (id: string, data: Partial<{ name: string; description: string; category: string; rule: Record<string, unknown>; severity: string; enabled: boolean }>) =>
    request<ApiStandard>(`/governance/standards/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteStandard: (id: string) => request<void>(`/governance/standards/${id}`, { method: 'DELETE' }),
};

// ─── Agent Hub ──────────────────────────────────────────────────────────────

export interface AgentHubEntry {
  id: string;
  name: string;
  description: string;
  type: 'local' | 'bedrock' | 'agentcore' | 'salesforce' | 'copilot';
  provider: string;
  status: string;
  model: string;
  region: string | null;
  linkedProduct: string | null;
  linkedProductId: string | null;
  enabled: boolean;
  totalCalls: number;
  successRate: number;
  avgResponseMs: number;
  lastActive: string | null;
  createdAt: string;
  updatedAt: string;
  details: Record<string, unknown>;
}

export interface AgentHubSummary {
  total: number;
  local: number;
  bedrock: number;
  agentcore: number;
  salesforce: number;
  copilot: number;
  active: number;
  inactive: number;
  totalCalls: number;
  avgSuccessRate: number;
  providers: {
    local: number;
    bedrock: number;
    agentcore: number;
    salesforce: number;
    copilot: number;
  };
}

export interface AgentHubResponse {
  agents: AgentHubEntry[];
  summary: AgentHubSummary;
}

export const agentHubApi = {
  getAll: () => request<AgentHubResponse>('/agent-hub'),
};

// ─── Salesforce Agents ──────────────────────────────────────────────────────

export interface SalesforceAgent {
  id: string;
  sf_agent_id: string;
  name: string;
  description: string;
  status: string;
  agent_type: string;
  channel: string;
  model: string;
  instruction: string;
  instance_url: string;
  region: string;
  enabled: number;
  last_synced: string | null;
  created_at: string;
  updated_at: string;
  logCount: number;
  successCount: number;
  successRate: number;
  logs?: SalesforceAgentLog[];
}

export interface SalesforceAgentLog {
  id: string;
  salesforce_agent_id: string;
  session_id: string;
  input_text: string;
  output_text: string;
  success: number;
  duration_ms: number;
  created_at: string;
}

export const salesforceAgentsApi = {
  discover: (instanceUrl?: string, accessToken?: string) =>
    request<{ discovered: number; agents: SalesforceAgent[] }>('/salesforce-agents/discover', {
      method: 'POST',
      body: JSON.stringify({ instanceUrl, accessToken }),
    }),
  list: () => request<SalesforceAgent[]>('/salesforce-agents'),
  get: (id: string) => request<SalesforceAgent>(`/salesforce-agents/${id}`),
  enable: (id: string) => request<SalesforceAgent>(`/salesforce-agents/${id}/enable`, { method: 'POST' }),
  disable: (id: string) => request<SalesforceAgent>(`/salesforce-agents/${id}/disable`, { method: 'POST' }),
  invoke: (id: string, inputText: string, sessionId?: string) =>
    request<{ sessionId: string; output: string; success: boolean; durationMs: number }>(
      `/salesforce-agents/${id}/invoke`,
      { method: 'POST', body: JSON.stringify({ inputText, sessionId }) }
    ),
  sync: (id: string) => request<SalesforceAgent>(`/salesforce-agents/${id}/sync`, { method: 'POST' }),
  getLogs: (id: string) => request<SalesforceAgentLog[]>(`/salesforce-agents/${id}/logs`),
  exportLogs: (id: string) => request<{ agent: SalesforceAgent; logs: SalesforceAgentLog[] }>(`/salesforce-agents/${id}/export`),
  clearLogs: (id: string) => request<void>(`/salesforce-agents/${id}/logs`, { method: 'DELETE' }),
  delete: (id: string) => request<void>(`/salesforce-agents/${id}`, { method: 'DELETE' }),
};

// ─── Azure Copilot Agents ───────────────────────────────────────────────────

export interface AzureAgent {
  id: string;
  azure_agent_id: string;
  name: string;
  description: string;
  status: string;
  agent_type: string;
  model: string;
  instruction: string;
  endpoint_url: string;
  tenant_id: string;
  resource_group: string;
  region: string;
  enabled: number;
  last_synced: string | null;
  created_at: string;
  updated_at: string;
  logCount: number;
  successCount: number;
  successRate: number;
  logs?: AzureAgentLog[];
}

export interface AzureAgentLog {
  id: string;
  azure_agent_id: string;
  session_id: string;
  input_text: string;
  output_text: string;
  success: number;
  duration_ms: number;
  created_at: string;
}

export const copilotAgentsApi = {
  discover: (endpointUrl?: string, accessToken?: string, tenantId?: string) =>
    request<{ discovered: number; agents: AzureAgent[] }>('/copilot-agents/discover', {
      method: 'POST',
      body: JSON.stringify({ endpointUrl, accessToken, tenantId }),
    }),
  list: () => request<AzureAgent[]>('/copilot-agents'),
  get: (id: string) => request<AzureAgent>(`/copilot-agents/${id}`),
  enable: (id: string) => request<AzureAgent>(`/copilot-agents/${id}/enable`, { method: 'POST' }),
  disable: (id: string) => request<AzureAgent>(`/copilot-agents/${id}/disable`, { method: 'POST' }),
  invoke: (id: string, inputText: string, sessionId?: string) =>
    request<{ sessionId: string; output: string; success: boolean; durationMs: number }>(
      `/copilot-agents/${id}/invoke`,
      { method: 'POST', body: JSON.stringify({ inputText, sessionId }) }
    ),
  sync: (id: string) => request<AzureAgent>(`/copilot-agents/${id}/sync`, { method: 'POST' }),
  getLogs: (id: string) => request<AzureAgentLog[]>(`/copilot-agents/${id}/logs`),
  exportLogs: (id: string) => request<{ agent: AzureAgent; logs: AzureAgentLog[] }>(`/copilot-agents/${id}/export`),
  clearLogs: (id: string) => request<void>(`/copilot-agents/${id}/logs`, { method: 'DELETE' }),
  delete: (id: string) => request<void>(`/copilot-agents/${id}`, { method: 'DELETE' }),
};

// ─── Devin Agents ────────────────────────────────────────────────────────────

export interface DevinSession {
  id: string;
  devin_session_id: string;
  title: string;
  status: string;
  created_by: string;
  token_usage: number;
  prompt_tokens: number;
  completion_tokens: number;
  model: string;
  duration_seconds: number;
  session_url: string;
  started_at: string;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DevinUsageStats {
  totalSessions: number;
  totalTokens: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalDurationSeconds: number;
  avgTokensPerSession: number;
  avgDurationSeconds: number;
  uniqueUsers: number;
  users: string[];
  statusCounts: Record<string, number>;
  userStats: Record<string, { sessions: number; tokens: number; duration: number }>;
  dailyUsage: Array<{ date: string; sessions: number; tokens: number }>;
}

export interface DevinTool {
  name: string;
  description: string;
  category: string;
  callCount: number;
  lastUsed: string | null;
  sessionCount?: number;
  totalCalls?: number;
  inputSchema: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

export interface DevinMcpServer {
  name: string;
  url: string;
  status: string;
  toolCount: number;
  protocol: string;
  sessionCount?: number;
}

export interface DevinSessionTools {
  tools: DevinTool[];
  mcpServers: DevinMcpServer[];
}

export interface DevinAllTools {
  tools: DevinTool[];
  mcpServers: DevinMcpServer[];
  totalTools: number;
  totalServers: number;
}

export const devinAgentsApi = {
  discover: (apiKey?: string) =>
    request<{ discovered: number; sessions: DevinSession[] }>('/devin-agents/discover', {
      method: 'POST',
      body: JSON.stringify({ apiKey }),
    }),
  list: () => request<DevinSession[]>('/devin-agents'),
  get: (id: string) => request<DevinSession>(`/devin-agents/${id}`),
  stats: () => request<DevinUsageStats>('/devin-agents/stats'),
  getSessionTools: (id: string) => request<DevinSessionTools>(`/devin-agents/${id}/tools`),
  getAllTools: () => request<DevinAllTools>('/devin-agents/tools/all'),
  sync: (id: string) => request<DevinSession>(`/devin-agents/${id}/sync`, { method: 'POST' }),
  delete: (id: string) => request<void>(`/devin-agents/${id}`, { method: 'DELETE' }),
};

// Claude (Bedrock) types
export interface ClaudeInvocation {
  id: string;
  invocation_id: string;
  title: string;
  category: string;
  model: string;
  model_short_name: string;
  user_email: string;
  status: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  duration_ms: number;
  estimated_cost: number;
  region: string;
  started_at: string;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClaudeUsageStats {
  totalInvocations: number;
  totalTokens: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalDurationMs: number;
  totalCost: number;
  avgTokensPerInvocation: number;
  avgDurationMs: number;
  uniqueUsers: number;
  users: string[];
  statusCounts: Record<string, number>;
  modelStats: Record<string, {
    invocations: number;
    tokens: number;
    promptTokens: number;
    completionTokens: number;
    cost: number;
    avgDurationMs: number;
  }>;
  userStats: Record<string, { invocations: number; tokens: number; cost: number }>;
  categoryStats: Record<string, { invocations: number; tokens: number; cost: number }>;
  dailyUsage: Array<{ date: string; invocations: number; tokens: number; cost: number }>;
}

export const claudeAgentsApi = {
  discover: (credentials?: { accessKeyId?: string; secretAccessKey?: string; region?: string }) =>
    request<{ discovered: number; invocations: ClaudeInvocation[] }>('/claude-agents/discover', {
      method: 'POST',
      body: JSON.stringify(credentials || {}),
    }),
  list: () => request<ClaudeInvocation[]>('/claude-agents'),
  get: (id: string) => request<ClaudeInvocation>(`/claude-agents/${id}`),
  stats: () => request<ClaudeUsageStats>('/claude-agents/stats'),
  sync: (id: string) => request<ClaudeInvocation>(`/claude-agents/${id}/sync`, { method: 'POST' }),
  delete: (id: string) => request<void>(`/claude-agents/${id}`, { method: 'DELETE' }),
};

// MCP Discovery types
export interface McpDiscoveredTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
  annotations?: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
}

export interface McpDiscoveryResult {
  connected: boolean;
  serverInfo: { name: string; version: string };
  protocolVersion: string;
  capabilities: Record<string, unknown>;
  tools: McpDiscoveredTool[];
}

export interface McpToolCallResult {
  success: boolean;
  error: string | null;
  content: Array<{ type: string; text: string }>;
  isError: boolean;
}

export interface McpConnection {
  id: string;
  name: string;
  url: string;
  api_key: string | null;
  description: string | null;
  status: string;
  tool_count: number;
  last_discovered: string | null;
  created_at: string;
  updated_at: string;
}

export const mcpDiscoveryApi = {
  discover: (serverUrl: string, apiKey?: string) =>
    request<McpDiscoveryResult>('/mcp-discovery/discover', {
      method: 'POST',
      body: JSON.stringify({ serverUrl, apiKey }),
    }),
  callTool: (serverUrl: string, toolName: string, args?: Record<string, unknown>, apiKey?: string) =>
    request<McpToolCallResult>('/mcp-discovery/call', {
      method: 'POST',
      body: JSON.stringify({ serverUrl, apiKey, toolName, args }),
    }),
  listConnections: () => request<McpConnection[]>('/mcp-discovery/connections'),
  saveConnection: (name: string, url: string, apiKey?: string, description?: string) =>
    request<McpConnection>('/mcp-discovery/connections', {
      method: 'POST',
      body: JSON.stringify({ name, url, apiKey, description }),
    }),
  getConnection: (id: string) => request<McpConnection>(`/mcp-discovery/connections/${id}`),
  deleteConnection: (id: string) => request<void>(`/mcp-discovery/connections/${id}`, { method: 'DELETE' }),
};
