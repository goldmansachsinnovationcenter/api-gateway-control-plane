import { useState, useEffect, useCallback } from "react";
import { agentsApi, productsApi } from "@/lib/api";
import type { Agent, AgentLog, Product, McpTool, AgentGuardrails, AgentBehaviorConfig, AgentToolPermission, AgentAnomalyThresholds, AgentAnomaly } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { Backdrop } from "@/components/Backdrop";
import {
  Bot, Plus, Trash2, Play, RotateCcw, Clock,
  CheckCircle, XCircle, ArrowLeft, Wrench, Zap, ScrollText,
  Copy, Download, CopyPlus, Search, Filter, ChevronDown, ChevronRight,
  Activity, Timer, TrendingUp, Loader2,
  Shield, Settings, AlertTriangle, Power, PowerOff,
} from "lucide-react";

// Status Indicator with color coding and pulse animation
function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    idle: "bg-emerald-400",
    running: "bg-amber-400",
    error: "bg-red-400",
    disabled: "bg-gray-400",
  };
  return (
    <span className="relative flex h-2.5 w-2.5">
      {status === "running" && (
        <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${colors[status]} opacity-75`} />
      )}
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${colors[status] || colors.idle}`} />
    </span>
  );
}

// Default values for governance fields
const DEFAULT_GUARDRAILS: AgentGuardrails = {
  inputFilters: { piiDetection: true, topicRestrictions: [], maxInputLength: 10000, blockedPatterns: [] },
  outputFilters: { piiRedaction: true, contentModeration: true, maxOutputLength: 50000, sensitiveDataMasking: true },
};
const DEFAULT_BEHAVIOR: AgentBehaviorConfig = {
  maxRetries: 3, timeoutMs: 30000, fallbackBehavior: 'return_error',
  escalationRules: { onRepeatedFailure: 'log', failureThreshold: 5 }, concurrentExecutions: 1,
};
const DEFAULT_THRESHOLDS: AgentAnomalyThresholds = {
  errorRatePercent: 50, avgLatencyMs: 5000, latencySpikeMs: 10000, errorSpikeCount: 10, minCallsForEvaluation: 5,
};

// Copy to clipboard button with visual feedback
function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      title={label}
    >
      {copied ? <CheckCircle className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : label}
    </button>
  );
}

// Bulk execution progress bar
function BulkProgress({ current, total, toolName }: { current: number; total: number; toolName: string }) {
  const pct = Math.round((current / total) * 100);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Running: <span className="font-mono text-foreground">{toolName}</span></span>
        <span className="text-muted-foreground">{current}/{total}</span>
      </div>
      <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// Expandable log row with full request/response details
function LogRow({ log }: { log: AgentLog }) {
  const [expanded, setExpanded] = useState(false);
  let parsedArgs: unknown = null;
  let parsedResult: unknown = null;
  try { parsedArgs = JSON.parse(log.args); } catch { parsedArgs = log.args; }
  try { parsedResult = JSON.parse(log.result); } catch { parsedResult = log.result; }

  return (
    <div className="border border-border/50 rounded-md overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-2.5 hover:bg-secondary/30 transition-colors text-xs"
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
          {log.success ? <CheckCircle className="h-3.5 w-3.5 text-emerald-400" /> : <XCircle className="h-3.5 w-3.5 text-red-400" />}
          <span className="font-mono">{log.tool_name}</span>
        </div>
        <div className="flex items-center gap-3 text-muted-foreground">
          <span>{log.duration_ms}ms</span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {new Date(log.created_at).toLocaleTimeString()}
          </span>
        </div>
      </button>
      {expanded && (
        <div className="border-t border-border/50 bg-secondary/20 p-3 space-y-2">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Request Args</span>
              <CopyButton text={JSON.stringify(parsedArgs, null, 2)} label="Copy" />
            </div>
            <pre className="text-xs font-mono bg-secondary rounded p-2 overflow-x-auto max-h-32 overflow-y-auto whitespace-pre-wrap">{JSON.stringify(parsedArgs, null, 2)}</pre>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Response</span>
              <CopyButton text={JSON.stringify(parsedResult, null, 2)} label="Copy" />
            </div>
            <pre className="text-xs font-mono bg-secondary rounded p-2 overflow-x-auto max-h-32 overflow-y-auto whitespace-pre-wrap">{JSON.stringify(parsedResult, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

// Inline tool argument form with typed fields per parameter
function ToolArgForm({ tool, args, onChange }: {
  tool: McpTool;
  args: Record<string, unknown>;
  onChange: (args: Record<string, unknown>) => void;
}) {
  const props = tool.inputSchema.properties || {};
  const required = tool.inputSchema.required || [];

  if (Object.keys(props).length === 0) {
    return <p className="text-xs text-muted-foreground italic">This tool requires no arguments.</p>;
  }

  return (
    <div className="space-y-3">
      {Object.entries(props).map(([key, schema]) => {
        const s = schema as Record<string, unknown>;
        const isRequired = required.includes(key);
        const type = String(s.type || "string");
        const enumValues = s.enum as string[] | undefined;

        if (enumValues) {
          return (
            <Select
              key={key}
              label={`${key}${isRequired ? " *" : ""}`}
              id={`arg-${key}`}
              value={String(args[key] || "")}
              onChange={(e) => onChange({ ...args, [key]: e.target.value })}
              options={enumValues.map(v => ({ value: v, label: v }))}
            />
          );
        }

        if (type === "boolean") {
          return (
            <div key={key} className="flex items-center gap-2">
              <input
                type="checkbox"
                id={`arg-${key}`}
                checked={!!args[key]}
                onChange={(e) => onChange({ ...args, [key]: e.target.checked })}
                className="h-4 w-4 rounded border-border bg-background"
              />
              <label htmlFor={`arg-${key}`} className="text-sm font-medium">
                {key}{isRequired ? " *" : ""}
              </label>
            </div>
          );
        }

        if (type === "integer" || type === "number") {
          return (
            <Input
              key={key}
              label={`${key}${isRequired ? " *" : ""}`}
              id={`arg-${key}`}
              type="number"
              value={String(args[key] ?? "")}
              onChange={(e) => onChange({ ...args, [key]: type === "integer" ? parseInt(e.target.value) || 0 : parseFloat(e.target.value) || 0 })}
              placeholder={String(s.description || key)}
            />
          );
        }

        return (
          <Input
            key={key}
            label={`${key}${isRequired ? " *" : ""}`}
            id={`arg-${key}`}
            value={String(args[key] ?? "")}
            onChange={(e) => onChange({ ...args, [key]: e.target.value })}
            placeholder={String(s.description || key)}
          />
        );
      })}
    </div>
  );
}

// Main Agents Page
export function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [tools, setTools] = useState<McpTool[]>([]);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [backdropMessage, setBackdropMessage] = useState("");

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [productFilter, setProductFilter] = useState<string>("all");

  // Create form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formProductId, setFormProductId] = useState("");
  const [formModel, setFormModel] = useState("local");
  const [formSystemPrompt, setFormSystemPrompt] = useState("");
  const [formTab, setFormTab] = useState<'basic' | 'guardrails' | 'behavior' | 'tools' | 'anomaly'>('basic');

  // Guardrails form state
  const [formGuardrails, setFormGuardrails] = useState<AgentGuardrails>(DEFAULT_GUARDRAILS);
  // Behavior config form state
  const [formBehavior, setFormBehavior] = useState<AgentBehaviorConfig>(DEFAULT_BEHAVIOR);
  // Tool permissions form state
  const [formToolPermissions, setFormToolPermissions] = useState<Record<string, AgentToolPermission>>({});
  // Anomaly thresholds form state
  const [formThresholds, setFormThresholds] = useState<AgentAnomalyThresholds>(DEFAULT_THRESHOLDS);
  // Topic restrictions as comma-separated text
  const [formTopicRestrictions, setFormTopicRestrictions] = useState("");
  const [formBlockedPatterns, setFormBlockedPatterns] = useState("");

  // Tool execution state
  const [selectedTool, setSelectedTool] = useState<McpTool | null>(null);
  const [toolArgs, setToolArgs] = useState<Record<string, unknown>>({});
  const [rawJsonMode, setRawJsonMode] = useState(false);
  const [rawJsonArgs, setRawJsonArgs] = useState("{}");
  const [execResult, setExecResult] = useState<string | null>(null);

  // Bulk execution state
  const [runAllResults, setRunAllResults] = useState<Array<{
    tool: string; success: boolean; durationMs: number; result: unknown;
  }> | null>(null);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number; toolName: string } | null>(null);

  const fetchAgents = useCallback(async () => {
    try {
      const data = await agentsApi.list();
      setAgents(data);
    } catch (err) {
      console.error("Failed to fetch agents:", err);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const data = await productsApi.list();
      setProducts(data.filter((p) => p.mcp_enabled));
    } catch (err) {
      console.error("Failed to fetch products:", err);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
    fetchProducts();
  }, [fetchAgents, fetchProducts]);

  // Filtered agents based on search and filters
  const filteredAgents = agents.filter(agent => {
    if (searchQuery && !agent.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !agent.description?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (statusFilter !== "all" && agent.status !== statusFilter) return false;
    if (productFilter !== "all") {
      if (productFilter === "none" && agent.product_id) return false;
      if (productFilter !== "none" && agent.product_id !== productFilter) return false;
    }
    return true;
  });

  const handleCreate = async () => {
    if (!formName) return;
    setLoading(true);
    setBackdropMessage("Creating agent...");
    try {
      const guardrails = {
        ...formGuardrails,
        inputFilters: {
          ...formGuardrails.inputFilters,
          topicRestrictions: formTopicRestrictions ? formTopicRestrictions.split(',').map(s => s.trim()).filter(Boolean) : [],
          blockedPatterns: formBlockedPatterns ? formBlockedPatterns.split(',').map(s => s.trim()).filter(Boolean) : [],
        },
      };
      await agentsApi.create({
        name: formName,
        description: formDescription,
        productId: formProductId || undefined,
        model: formModel,
        systemPrompt: formSystemPrompt,
        guardrails,
        behaviorConfig: formBehavior,
        toolPermissions: Object.keys(formToolPermissions).length > 0 ? formToolPermissions : undefined,
        anomalyThresholds: formThresholds,
      });
      setShowCreate(false);
      setFormName("");
      setFormDescription("");
      setFormProductId("");
      setFormModel("local");
      setFormSystemPrompt("");
      setFormGuardrails(DEFAULT_GUARDRAILS);
      setFormBehavior(DEFAULT_BEHAVIOR);
      setFormToolPermissions({});
      setFormThresholds(DEFAULT_THRESHOLDS);
      setFormTopicRestrictions("");
      setFormBlockedPatterns("");
      setFormTab('basic');
      await fetchAgents();
    } catch (err) {
      console.error("Failed to create agent:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEnabled = async (e: React.MouseEvent, agent: Agent) => {
    e.stopPropagation();
    try {
      if (agent.enabled) {
        await agentsApi.disable(agent.id);
      } else {
        await agentsApi.enable(agent.id);
      }
      await fetchAgents();
    } catch (err) {
      console.error("Failed to toggle agent:", err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await agentsApi.delete(id);
      if (selectedAgent?.id === id) {
        setSelectedAgent(null);
        setTools([]);
        setLogs([]);
      }
      await fetchAgents();
    } catch (err) {
      console.error("Failed to delete agent:", err);
    }
  };

  const handleClone = async (id: string) => {
    try {
      await agentsApi.clone(id);
      await fetchAgents();
    } catch (err) {
      console.error("Failed to clone agent:", err);
    }
  };

  const handleSelectAgent = async (agent: Agent) => {
    setSelectedAgent(agent);
    setSelectedTool(null);
    setExecResult(null);
    setRunAllResults(null);
    setBulkProgress(null);
    setToolArgs({});
    setRawJsonArgs("{}");

    if (agent.product_id) {
      try {
        const mcpTools = await productsApi.getMcpTools(agent.product_id);
        setTools(mcpTools);
      } catch (err) {
        console.error("Failed to fetch tools:", err);
        setTools([]);
      }
    } else {
      setTools([]);
    }

    try {
      const agentLogs = await agentsApi.getLogs(agent.id, 100);
      setLogs(agentLogs);
    } catch (err) {
      console.error("Failed to fetch logs:", err);
      setLogs([]);
    }
  };

  const handleSelectTool = (tool: McpTool) => {
    setSelectedTool(tool);
    setExecResult(null);
    const defaultArgs: Record<string, unknown> = {};
    if (tool.inputSchema.properties) {
      for (const [key, schema] of Object.entries(tool.inputSchema.properties)) {
        const s = schema as Record<string, unknown>;
        if (s.default !== undefined) defaultArgs[key] = s.default;
        else if (s.enum) defaultArgs[key] = (s.enum as string[])[0];
        else if (s.type === "string") defaultArgs[key] = "";
        else if (s.type === "integer" || s.type === "number") defaultArgs[key] = 0;
        else if (s.type === "boolean") defaultArgs[key] = false;
      }
    }
    setToolArgs(defaultArgs);
    setRawJsonArgs(JSON.stringify(defaultArgs, null, 2));
  };

  const handleExecuteTool = async () => {
    if (!selectedAgent || !selectedTool) return;
    setLoading(true);
    setBackdropMessage(`Executing ${selectedTool.name}...`);
    try {
      const args = rawJsonMode ? JSON.parse(rawJsonArgs) : toolArgs;
      const result = await agentsApi.executeTool(selectedAgent.id, selectedTool.name, args);
      setExecResult(JSON.stringify(result, null, 2));
      const agentLogs = await agentsApi.getLogs(selectedAgent.id, 100);
      setLogs(agentLogs);
      const updated = await agentsApi.get(selectedAgent.id);
      setSelectedAgent(updated);
      await fetchAgents();
    } catch (err) {
      setExecResult(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }, null, 2));
    } finally {
      setLoading(false);
    }
  };

  const handleRunAll = async () => {
    if (!selectedAgent) return;
    setRunAllResults(null);
    setBulkProgress({ current: 0, total: tools.length, toolName: tools[0]?.name || "" });

    const results: Array<{ tool: string; success: boolean; durationMs: number; result: unknown }> = [];
    for (let i = 0; i < tools.length; i++) {
      setBulkProgress({ current: i, total: tools.length, toolName: tools[i].name });
      try {
        const result = await agentsApi.executeTool(selectedAgent.id, tools[i].name, {});
        results.push({ tool: tools[i].name, success: result.success, durationMs: result.durationMs, result: result.result });
      } catch (err) {
        results.push({ tool: tools[i].name, success: false, durationMs: 0, result: { error: err instanceof Error ? err.message : "Unknown error" } });
      }
    }

    setBulkProgress(null);
    setRunAllResults(results);
    const agentLogs = await agentsApi.getLogs(selectedAgent.id, 100);
    setLogs(agentLogs);
    const updated = await agentsApi.get(selectedAgent.id);
    setSelectedAgent(updated);
    await fetchAgents();
  };

  const handleClearLogs = async () => {
    if (!selectedAgent) return;
    try {
      await agentsApi.clearLogs(selectedAgent.id);
      setLogs([]);
      const updated = await agentsApi.get(selectedAgent.id);
      setSelectedAgent(updated);
      await fetchAgents();
    } catch (err) {
      console.error("Failed to clear logs:", err);
    }
  };

  const handleExportLogs = async () => {
    if (!selectedAgent) return;
    try {
      const data = await agentsApi.exportLogs(selectedAgent.id);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `agent-${selectedAgent.name.replace(/\s+/g, "-").toLowerCase()}-logs.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export logs:", err);
    }
  };

  const methodColors: Record<string, string> = {
    GET: "text-emerald-400",
    POST: "text-blue-400",
    PUT: "text-amber-400",
    DELETE: "text-red-400",
  };

  // Agent Detail View
  if (selectedAgent) {
    return (
      <div>
        <Backdrop open={loading} message={backdropMessage} />

        <div className="mb-6 flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => { setSelectedAgent(null); setTools([]); setLogs([]); setRunAllResults(null); setBulkProgress(null); }}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bot className="h-6 w-6 text-primary" />
              {selectedAgent.name}
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">{selectedAgent.description || "No description"}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusDot status={selectedAgent.status} />
            <Badge variant={selectedAgent.status === "running" ? "default" : "secondary"}>
              {selectedAgent.status}
            </Badge>
            {selectedAgent.product && (
              <Badge variant="outline">{selectedAgent.product.name}</Badge>
            )}
          </div>
        </div>

        {/* Stats Dashboard */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="bg-secondary/50 rounded-lg p-3 flex items-center gap-3">
            <div className="p-2 rounded-md bg-primary/10"><Activity className="h-4 w-4 text-primary" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Total Calls</p>
              <p className="text-lg font-bold">{selectedAgent.logCount}</p>
            </div>
          </div>
          <div className="bg-secondary/50 rounded-lg p-3 flex items-center gap-3">
            <div className="p-2 rounded-md bg-emerald-500/10"><TrendingUp className="h-4 w-4 text-emerald-400" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Success Rate</p>
              <p className="text-lg font-bold">{selectedAgent.successRate}%</p>
            </div>
          </div>
          <div className="bg-secondary/50 rounded-lg p-3 flex items-center gap-3">
            <div className="p-2 rounded-md bg-amber-500/10"><Timer className="h-4 w-4 text-amber-400" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Avg Response</p>
              <p className="text-lg font-bold">{selectedAgent.avgResponseMs}ms</p>
            </div>
          </div>
          <div className="bg-secondary/50 rounded-lg p-3 flex items-center gap-3">
            <div className="p-2 rounded-md bg-blue-500/10"><Clock className="h-4 w-4 text-blue-400" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Last Active</p>
              <p className="text-sm font-medium">{selectedAgent.lastActive ? new Date(selectedAgent.lastActive).toLocaleTimeString() : "Never"}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Left: Config + Actions + Tools */}
          <div className="col-span-4 space-y-4">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Agent Configuration</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Model</span>
                  <span className="font-mono">{selectedAgent.model}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Product</span>
                  <span>{selectedAgent.product?.name || "None"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">MCP Endpoint</span>
                  <span className="font-mono text-xs truncate max-w-[180px]">{selectedAgent.mcpServer?.endpoint || "N/A"}</span>
                </div>
                {selectedAgent.system_prompt && (
                  <div className="pt-2 border-t border-border">
                    <span className="text-muted-foreground text-xs">System Prompt:</span>
                    <p className="text-xs mt-1 bg-secondary rounded p-2">{selectedAgent.system_prompt}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Quick Actions</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <Button onClick={handleRunAll} className="w-full" disabled={tools.length === 0 || bulkProgress !== null}>
                  {bulkProgress ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Zap className="h-4 w-4 mr-1" />}
                  Run All Tools ({tools.length})
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleExportLogs} className="flex-1" disabled={logs.length === 0}>
                    <Download className="h-4 w-4 mr-1" />
                    Export
                  </Button>
                  <Button variant="outline" onClick={handleClearLogs} className="flex-1" disabled={logs.length === 0}>
                    <RotateCcw className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                </div>
              </CardContent>
            </Card>

            {tools.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Available Tools</CardTitle>
                  <CardDescription>{tools.length} tools from {selectedAgent.product?.name}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-1 max-h-80 overflow-y-auto">
                  {tools.map((tool) => (
                    <button
                      key={tool.name}
                      onClick={() => handleSelectTool(tool)}
                      className={`w-full p-2.5 rounded-md text-left transition-colors ${
                        selectedTool?.name === tool.name
                          ? "bg-primary/10 border border-primary/30"
                          : "hover:bg-secondary/50 border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Wrench className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs font-mono">{tool.name}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 ml-5">
                        <span className={`text-xs font-bold ${methodColors[tool._meta.method] || ""}`}>{tool._meta.method}</span>
                        <span className="text-xs text-muted-foreground font-mono">{tool._meta.path}</span>
                      </div>
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right: Execution + Logs */}
          <div className="col-span-8 space-y-4">
            {/* Bulk Progress */}
            {bulkProgress && (
              <Card>
                <CardContent className="pt-6">
                  <BulkProgress current={bulkProgress.current} total={bulkProgress.total} toolName={bulkProgress.toolName} />
                </CardContent>
              </Card>
            )}

            {/* Run All Results */}
            {runAllResults && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Zap className="h-4 w-4" />
                        Run All Results
                      </CardTitle>
                      <CardDescription>
                        {runAllResults.filter(r => r.success).length}/{runAllResults.length} passed
                        {" \u00b7 "}
                        {runAllResults.reduce((sum, r) => sum + r.durationMs, 0)}ms total
                      </CardDescription>
                    </div>
                    <CopyButton text={JSON.stringify(runAllResults, null, 2)} label="Copy All" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {runAllResults.map((r, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-secondary rounded text-sm">
                        <div className="flex items-center gap-2">
                          {r.success ? <CheckCircle className="h-4 w-4 text-emerald-400" /> : <XCircle className="h-4 w-4 text-red-400" />}
                          <span className="font-mono text-xs">{r.tool}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{r.durationMs}ms</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tool Execution Panel */}
            {selectedTool ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="font-mono text-sm">{selectedTool.name}</CardTitle>
                      <CardDescription className="mt-1">{selectedTool.description}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedTool.annotations.readOnlyHint && <Badge variant="outline">Read-Only</Badge>}
                      {selectedTool.annotations.destructiveHint && <Badge variant="destructive">Destructive</Badge>}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Mode Toggle: Form vs JSON */}
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-medium text-muted-foreground">Arguments</h4>
                      <button
                        onClick={() => {
                          if (!rawJsonMode) {
                            setRawJsonArgs(JSON.stringify(toolArgs, null, 2));
                          } else {
                            try { setToolArgs(JSON.parse(rawJsonArgs)); } catch { /* keep form args */ }
                          }
                          setRawJsonMode(!rawJsonMode);
                        }}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {rawJsonMode ? "Switch to Form" : "Switch to JSON"}
                      </button>
                    </div>

                    {rawJsonMode ? (
                      <Textarea
                        id="agent-tool-args-raw"
                        value={rawJsonArgs}
                        onChange={(e) => setRawJsonArgs(e.target.value)}
                        className="font-mono text-xs min-h-[120px]"
                      />
                    ) : (
                      <ToolArgForm tool={selectedTool} args={toolArgs} onChange={setToolArgs} />
                    )}

                    <Button onClick={handleExecuteTool} className="w-full">
                      <Play className="h-4 w-4 mr-1" />
                      Execute Tool
                    </Button>

                    {execResult && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="text-xs font-medium text-muted-foreground">Response</h4>
                          <CopyButton text={execResult} label="Copy" />
                        </div>
                        <pre className="bg-secondary rounded-md p-3 text-xs font-mono overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
                          {execResult}
                        </pre>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : !runAllResults && !bulkProgress ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Wrench className="h-10 w-10 text-muted-foreground mb-3" />
                  <h3 className="text-sm font-medium mb-1">Select a tool or run all</h3>
                  <p className="text-muted-foreground text-xs">
                    Pick a tool from the left or click &quot;Run All Tools&quot;
                  </p>
                </CardContent>
              </Card>
            ) : null}

            {/* Execution History with Expandable Rows */}
            {logs.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ScrollText className="h-4 w-4" />
                      Execution History ({logs.length})
                    </CardTitle>
                    <CopyButton text={JSON.stringify(logs, null, 2)} label="Copy All" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1.5 max-h-80 overflow-y-auto">
                    {logs.map((log) => (
                      <LogRow key={log.id} log={log} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Agent List View
  return (
    <div>
      <Backdrop open={loading} message={backdropMessage} />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Agents</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage local agents that connect to MCP tools
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Create Agent
        </Button>
      </div>

      {/* Search & Filter Bar */}
      {agents.length > 0 && (
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search agents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 px-2 rounded-md border border-input bg-background text-sm"
            >
              <option value="all">All Status</option>
              <option value="idle">Idle</option>
              <option value="running">Running</option>
              <option value="error">Error</option>
            </select>
            <select
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className="h-9 px-2 rounded-md border border-input bg-background text-sm"
            >
              <option value="all">All Products</option>
              <option value="none">Not Linked</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <span className="text-xs text-muted-foreground">
            {filteredAgents.length} of {agents.length} agents
          </span>
        </div>
      )}

      {/* Agent Cards Grid */}
      {agents.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Bot className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No agents yet</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Create an agent to start testing MCP tools
            </p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Create Your First Agent
            </Button>
          </CardContent>
        </Card>
      ) : filteredAgents.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Search className="h-8 w-8 text-muted-foreground mb-3" />
            <h3 className="text-sm font-medium mb-1">No matching agents</h3>
            <p className="text-muted-foreground text-xs">Try adjusting your search or filters</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAgents.map((agent) => (
            <Card
              key={agent.id}
              className="cursor-pointer hover:border-primary/30 transition-colors"
              onClick={() => handleSelectAgent(agent)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bot className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">{agent.name}</CardTitle>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleToggleEnabled(e, agent)}
                      className={`h-7 w-7 p-0 ${agent.enabled ? 'text-emerald-400 hover:text-red-400' : 'text-red-400 hover:text-emerald-400'}`}
                      title={agent.enabled ? 'Disable Agent' : 'Enable Agent'}
                    >
                      {agent.enabled ? <Power className="h-3.5 w-3.5" /> : <PowerOff className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); handleClone(agent.id); }}
                      className="text-muted-foreground hover:text-foreground h-7 w-7 p-0"
                      title="Clone Agent"
                    >
                      <CopyPlus className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); handleDelete(agent.id); }}
                      className="text-muted-foreground hover:text-red-400 h-7 w-7 p-0"
                      title="Delete Agent"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <CardDescription className="ml-7 line-clamp-1">
                  {agent.description || "No description"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2.5 text-sm">
                  {/* Status Row */}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <div className="flex items-center gap-1.5">
                      <StatusDot status={agent.enabled ? agent.status : 'disabled'} />
                      <span className="text-xs">{agent.enabled ? agent.status : 'disabled'}</span>
                    </div>
                  </div>

                  {/* Anomaly indicator */}
                  {(agent.unresolvedAnomalies > 0) && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Anomalies</span>
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                        <AlertTriangle className="h-3 w-3 mr-0.5" />
                        {agent.unresolvedAnomalies}
                      </Badge>
                    </div>
                  )}

                  {/* Product */}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Product</span>
                    <span className="text-xs">{agent.product?.name || "Not linked"}</span>
                  </div>

                  {/* Stats Row */}
                  <div className="pt-2 border-t border-border grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-lg font-bold">{agent.logCount}</p>
                      <p className="text-[10px] text-muted-foreground">Calls</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold">{agent.successRate}<span className="text-xs font-normal">%</span></p>
                      <p className="text-[10px] text-muted-foreground">Success</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold">{agent.avgResponseMs}<span className="text-xs font-normal">ms</span></p>
                      <p className="text-[10px] text-muted-foreground">Avg Time</p>
                    </div>
                  </div>

                  {/* Last Active */}
                  {agent.lastActive && (
                    <div className="text-[10px] text-muted-foreground text-center pt-1">
                      Last active: {new Date(agent.lastActive).toLocaleString()}
                    </div>
                  )}

                  {/* MCP Endpoint */}
                  {agent.mcpServer && (
                    <div className="pt-2 border-t border-border">
                      <span className="text-xs text-muted-foreground font-mono truncate block">
                        {agent.mcpServer.endpoint}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Agent Dialog */}
      <Dialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create Agent"
      >
        <div className="space-y-4">
          {/* Tab navigation */}
          <div className="flex gap-1 border-b border-border pb-2">
            {(['basic', 'guardrails', 'behavior', 'tools', 'anomaly'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setFormTab(tab)}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                  formTab === tab ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'
                }`}
              >
                {tab === 'basic' ? 'Basic' : tab === 'guardrails' ? 'Guardrails' : tab === 'behavior' ? 'Behavior' : tab === 'tools' ? 'Tools' : 'Anomaly Detection'}
              </button>
            ))}
          </div>

          {/* Basic tab */}
          {formTab === 'basic' && (
            <div className="space-y-4">
              <Input label="Agent Name" id="agent-name" placeholder="My API Agent" value={formName} onChange={(e) => setFormName(e.target.value)} />
              <Input label="Description (optional)" id="agent-desc" placeholder="Agent for testing user management APIs" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} />
              <Select label="MCP-Enabled Product" id="agent-product" value={formProductId} onChange={(e) => setFormProductId(e.target.value)}
                options={[{ value: "", label: "-- Select a product --" }, ...products.map((p) => ({ value: p.id, label: `${p.name} (${p.apis.length} APIs)` }))]}
              />
              <Input label="Model" id="agent-model" placeholder="local" value={formModel} onChange={(e) => setFormModel(e.target.value)} />
              <Textarea label="System Prompt (optional)" id="agent-prompt" placeholder="You are an API testing agent." value={formSystemPrompt} onChange={(e) => setFormSystemPrompt(e.target.value)} className="min-h-[80px]" />
              {products.length === 0 && <p className="text-xs text-yellow-500">No MCP-enabled products found. Create a product and enable MCP first.</p>}
            </div>
          )}

          {/* Guardrails tab */}
          {formTab === 'guardrails' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4 text-primary" />
                <h4 className="text-sm font-medium">Input Filters</h4>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="pii-detect" checked={formGuardrails.inputFilters.piiDetection}
                  onChange={(e) => setFormGuardrails({...formGuardrails, inputFilters: {...formGuardrails.inputFilters, piiDetection: e.target.checked}})}
                  className="h-4 w-4 rounded border-border bg-background" />
                <label htmlFor="pii-detect" className="text-sm">PII Detection (SSN, Credit Card, Email, Phone)</label>
              </div>
              <Input label="Topic Restrictions (comma-separated)" id="topic-restrict" placeholder="politics, religion, violence"
                value={formTopicRestrictions} onChange={(e) => setFormTopicRestrictions(e.target.value)} />
              <Input label="Blocked Patterns (comma-separated regex)" id="blocked-patterns" placeholder="password=.*, secret_key"
                value={formBlockedPatterns} onChange={(e) => setFormBlockedPatterns(e.target.value)} />
              <Input label="Max Input Length" id="max-input" type="number" value={String(formGuardrails.inputFilters.maxInputLength)}
                onChange={(e) => setFormGuardrails({...formGuardrails, inputFilters: {...formGuardrails.inputFilters, maxInputLength: parseInt(e.target.value) || 10000}})} />

              <div className="flex items-center gap-2 mt-4 mb-2">
                <Shield className="h-4 w-4 text-primary" />
                <h4 className="text-sm font-medium">Output Filters</h4>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="pii-redact" checked={formGuardrails.outputFilters.piiRedaction}
                  onChange={(e) => setFormGuardrails({...formGuardrails, outputFilters: {...formGuardrails.outputFilters, piiRedaction: e.target.checked}})}
                  className="h-4 w-4 rounded border-border bg-background" />
                <label htmlFor="pii-redact" className="text-sm">PII Redaction</label>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="content-mod" checked={formGuardrails.outputFilters.contentModeration}
                  onChange={(e) => setFormGuardrails({...formGuardrails, outputFilters: {...formGuardrails.outputFilters, contentModeration: e.target.checked}})}
                  className="h-4 w-4 rounded border-border bg-background" />
                <label htmlFor="content-mod" className="text-sm">Content Moderation</label>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="data-mask" checked={formGuardrails.outputFilters.sensitiveDataMasking}
                  onChange={(e) => setFormGuardrails({...formGuardrails, outputFilters: {...formGuardrails.outputFilters, sensitiveDataMasking: e.target.checked}})}
                  className="h-4 w-4 rounded border-border bg-background" />
                <label htmlFor="data-mask" className="text-sm">Sensitive Data Masking</label>
              </div>
              <Input label="Max Output Length" id="max-output" type="number" value={String(formGuardrails.outputFilters.maxOutputLength)}
                onChange={(e) => setFormGuardrails({...formGuardrails, outputFilters: {...formGuardrails.outputFilters, maxOutputLength: parseInt(e.target.value) || 50000}})} />
            </div>
          )}

          {/* Behavior tab */}
          {formTab === 'behavior' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Settings className="h-4 w-4 text-primary" />
                <h4 className="text-sm font-medium">Behavior Configuration</h4>
              </div>
              <Input label="Max Retries" id="max-retries" type="number" value={String(formBehavior.maxRetries)}
                onChange={(e) => setFormBehavior({...formBehavior, maxRetries: parseInt(e.target.value) || 0})} />
              <Input label="Timeout (ms)" id="timeout-ms" type="number" value={String(formBehavior.timeoutMs)}
                onChange={(e) => setFormBehavior({...formBehavior, timeoutMs: parseInt(e.target.value) || 30000})} />
              <Select label="Fallback Behavior" id="fallback" value={formBehavior.fallbackBehavior}
                onChange={(e) => setFormBehavior({...formBehavior, fallbackBehavior: e.target.value as 'return_error' | 'use_default' | 'skip'})}
                options={[{value: 'return_error', label: 'Return Error'}, {value: 'use_default', label: 'Use Default Response'}, {value: 'skip', label: 'Skip Tool'}]} />
              <Select label="On Repeated Failure" id="escalation" value={formBehavior.escalationRules.onRepeatedFailure}
                onChange={(e) => setFormBehavior({...formBehavior, escalationRules: {...formBehavior.escalationRules, onRepeatedFailure: e.target.value as 'log' | 'disable' | 'alert'}})}
                options={[{value: 'log', label: 'Log Only'}, {value: 'disable', label: 'Auto-Disable Agent'}, {value: 'alert', label: 'Send Alert'}]} />
              <Input label="Failure Threshold" id="fail-threshold" type="number" value={String(formBehavior.escalationRules.failureThreshold)}
                onChange={(e) => setFormBehavior({...formBehavior, escalationRules: {...formBehavior.escalationRules, failureThreshold: parseInt(e.target.value) || 5}})} />
              <Input label="Concurrent Executions" id="concurrent" type="number" value={String(formBehavior.concurrentExecutions)}
                onChange={(e) => setFormBehavior({...formBehavior, concurrentExecutions: parseInt(e.target.value) || 1})} />
            </div>
          )}

          {/* Tools tab */}
          {formTab === 'tools' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Wrench className="h-4 w-4 text-primary" />
                <h4 className="text-sm font-medium">Tool Permissions</h4>
              </div>
              {formProductId ? (
                <>
                  <p className="text-xs text-muted-foreground">Set permission levels for each tool from the selected product.</p>
                  {products.find(p => p.id === formProductId)?.apis.map(api => {
                    const toolName = `${api.method.toLowerCase()}_${api.path.replace(/[^a-zA-Z0-9]/g, '_')}`;
                    const perm = formToolPermissions[toolName] || { level: 'full', blocked: false };
                    return (
                      <div key={api.id} className="flex items-center gap-3 p-2 bg-secondary/30 rounded-md">
                        <div className="flex-1">
                          <span className="text-xs font-mono">{api.method} {api.path}</span>
                        </div>
                        <select
                          value={perm.level}
                          onChange={(e) => setFormToolPermissions({...formToolPermissions, [toolName]: {...perm, level: e.target.value as 'full' | 'read_only' | 'restricted'}})}
                          className="h-7 px-2 text-xs rounded border border-input bg-background"
                        >
                          <option value="full">Full Access</option>
                          <option value="read_only">Read Only</option>
                          <option value="restricted">Restricted</option>
                        </select>
                        <div className="flex items-center gap-1">
                          <input type="checkbox" checked={perm.blocked}
                            onChange={(e) => setFormToolPermissions({...formToolPermissions, [toolName]: {...perm, blocked: e.target.checked}})}
                            className="h-3.5 w-3.5 rounded border-border" />
                          <span className="text-xs text-muted-foreground">Block</span>
                        </div>
                      </div>
                    );
                  })}
                </>
              ) : (
                <p className="text-xs text-yellow-500">Select a product in the Basic tab first to configure tool permissions.</p>
              )}
            </div>
          )}

          {/* Anomaly Detection tab */}
          {formTab === 'anomaly' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-primary" />
                <h4 className="text-sm font-medium">Anomaly Detection Thresholds</h4>
              </div>
              <p className="text-xs text-muted-foreground">Agents will be auto-disabled when critical thresholds are breached.</p>
              <Input label="Error Rate Threshold (%)" id="err-rate" type="number" value={String(formThresholds.errorRatePercent)}
                onChange={(e) => setFormThresholds({...formThresholds, errorRatePercent: parseInt(e.target.value) || 50})} />
              <Input label="Avg Latency Threshold (ms)" id="avg-latency" type="number" value={String(formThresholds.avgLatencyMs)}
                onChange={(e) => setFormThresholds({...formThresholds, avgLatencyMs: parseInt(e.target.value) || 5000})} />
              <Input label="Latency Spike Threshold (ms)" id="latency-spike" type="number" value={String(formThresholds.latencySpikeMs)}
                onChange={(e) => setFormThresholds({...formThresholds, latencySpikeMs: parseInt(e.target.value) || 10000})} />
              <Input label="Error Spike Count" id="err-spike" type="number" value={String(formThresholds.errorSpikeCount)}
                onChange={(e) => setFormThresholds({...formThresholds, errorSpikeCount: parseInt(e.target.value) || 10})} />
              <Input label="Min Calls for Evaluation" id="min-calls" type="number" value={String(formThresholds.minCallsForEvaluation)}
                onChange={(e) => setFormThresholds({...formThresholds, minCallsForEvaluation: parseInt(e.target.value) || 5})} />
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowCreate(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleCreate} className="flex-1" disabled={!formName}>
              Create Agent
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
