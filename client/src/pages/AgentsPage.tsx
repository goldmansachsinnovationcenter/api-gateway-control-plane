import { useState, useEffect, useCallback } from "react";
import { agentsApi, productsApi } from "@/lib/api";
import type { Agent, AgentLog, Product, McpTool } from "@/lib/api";
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
} from "lucide-react";

export function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [tools, setTools] = useState<McpTool[]>([]);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [backdropMessage, setBackdropMessage] = useState("");

  // Create form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formProductId, setFormProductId] = useState("");
  const [formModel, setFormModel] = useState("local");
  const [formSystemPrompt, setFormSystemPrompt] = useState("");

  // Tool execution state
  const [selectedTool, setSelectedTool] = useState<McpTool | null>(null);
  const [toolArgs, setToolArgs] = useState("{}");
  const [execResult, setExecResult] = useState<string | null>(null);
  const [runAllResults, setRunAllResults] = useState<Array<{
    tool: string; success: boolean; durationMs: number; result: unknown;
  }> | null>(null);

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

  const handleCreate = async () => {
    if (!formName) return;
    setLoading(true);
    setBackdropMessage("Creating agent...");
    try {
      await agentsApi.create({
        name: formName,
        description: formDescription,
        productId: formProductId || undefined,
        model: formModel,
        systemPrompt: formSystemPrompt,
      });
      setShowCreate(false);
      setFormName("");
      setFormDescription("");
      setFormProductId("");
      setFormModel("local");
      setFormSystemPrompt("");
      await fetchAgents();
    } catch (err) {
      console.error("Failed to create agent:", err);
    } finally {
      setLoading(false);
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

  const handleSelectAgent = async (agent: Agent) => {
    setSelectedAgent(agent);
    setSelectedTool(null);
    setExecResult(null);
    setRunAllResults(null);
    setToolArgs("{}");

    // Fetch tools if agent has a linked product
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

    // Fetch logs
    try {
      const agentLogs = await agentsApi.getLogs(agent.id, 50);
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
        else if (s.type === "string") defaultArgs[key] = s.enum ? (s.enum as string[])[0] : "";
        else if (s.type === "integer" || s.type === "number") defaultArgs[key] = 0;
        else if (s.type === "boolean") defaultArgs[key] = false;
      }
    }
    setToolArgs(JSON.stringify(defaultArgs, null, 2));
  };

  const handleExecuteTool = async () => {
    if (!selectedAgent || !selectedTool) return;
    setLoading(true);
    setBackdropMessage(`Executing ${selectedTool.name}...`);
    try {
      const args = JSON.parse(toolArgs);
      const result = await agentsApi.executeTool(selectedAgent.id, selectedTool.name, args);
      setExecResult(JSON.stringify(result, null, 2));
      // Refresh logs
      const agentLogs = await agentsApi.getLogs(selectedAgent.id, 50);
      setLogs(agentLogs);
      // Refresh agent to update logCount
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
    setLoading(true);
    setBackdropMessage("Running all tools...");
    setRunAllResults(null);
    try {
      const results = await agentsApi.runAll(selectedAgent.id);
      setRunAllResults(results);
      // Refresh logs
      const agentLogs = await agentsApi.getLogs(selectedAgent.id, 50);
      setLogs(agentLogs);
      const updated = await agentsApi.get(selectedAgent.id);
      setSelectedAgent(updated);
      await fetchAgents();
    } catch (err) {
      console.error("Failed to run all tools:", err);
    } finally {
      setLoading(false);
    }
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

  const methodColors: Record<string, string> = {
    GET: "text-emerald-400",
    POST: "text-blue-400",
    PUT: "text-amber-400",
    DELETE: "text-red-400",
  };

  // Agent detail view
  if (selectedAgent) {
    return (
      <div>
        <Backdrop open={loading} message={backdropMessage} />

        <div className="mb-6 flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => { setSelectedAgent(null); setTools([]); setLogs([]); setRunAllResults(null); }}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bot className="h-6 w-6 text-primary" />
              {selectedAgent.name}
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">{selectedAgent.description || "No description"}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Badge variant={selectedAgent.status === "running" ? "default" : "secondary"}>
              {selectedAgent.status}
            </Badge>
            {selectedAgent.product && (
              <Badge variant="outline">{selectedAgent.product.name}</Badge>
            )}
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Left: Tools + Actions */}
          <div className="col-span-4 space-y-4">
            {/* Agent Info Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Agent Configuration</CardTitle>
              </CardHeader>
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
                  <span className="font-mono text-xs">{selectedAgent.mcpServer?.endpoint || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tool Calls</span>
                  <span>{selectedAgent.logCount}</span>
                </div>
                {selectedAgent.system_prompt && (
                  <div className="pt-2 border-t border-border">
                    <span className="text-muted-foreground text-xs">System Prompt:</span>
                    <p className="text-xs mt-1 bg-secondary rounded p-2">{selectedAgent.system_prompt}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  onClick={handleRunAll}
                  className="w-full"
                  disabled={tools.length === 0}
                >
                  <Zap className="h-4 w-4 mr-1" />
                  Run All Tools ({tools.length})
                </Button>
                <Button variant="outline" onClick={handleClearLogs} className="w-full" disabled={logs.length === 0}>
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Clear Logs
                </Button>
              </CardContent>
            </Card>

            {/* Tools List */}
            {tools.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Available Tools</CardTitle>
                  <CardDescription>{tools.length} tools from {selectedAgent.product?.name}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-1 max-h-72 overflow-y-auto">
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
                        <span className={`text-xs font-bold ${methodColors[tool._meta.method] || ""}`}>
                          {tool._meta.method}
                        </span>
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
            {/* Run All Results */}
            {runAllResults && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Run All Results
                  </CardTitle>
                  <CardDescription>
                    {runAllResults.filter(r => r.success).length}/{runAllResults.length} passed
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {runAllResults.map((r, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-secondary rounded text-sm">
                        <div className="flex items-center gap-2">
                          {r.success ? (
                            <CheckCircle className="h-4 w-4 text-emerald-400" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-400" />
                          )}
                          <span className="font-mono text-xs">{r.tool}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{r.durationMs}ms</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tool Execution */}
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
                    <div>
                      <h4 className="text-xs font-medium mb-2 text-muted-foreground">Input Schema</h4>
                      <div className="bg-secondary rounded-md p-2 space-y-1">
                        {Object.entries(selectedTool.inputSchema.properties || {}).map(([key, schema]) => {
                          const s = schema as Record<string, unknown>;
                          const isRequired = selectedTool.inputSchema.required?.includes(key);
                          return (
                            <div key={key} className="flex items-center gap-2 text-xs">
                              <code className="text-primary">{key}</code>
                              <Badge variant="outline" className="text-[10px] px-1 py-0">{String(s.type || "string")}</Badge>
                              {isRequired && <Badge variant="warning" className="text-[10px] px-1 py-0">required</Badge>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <Textarea
                      label="Arguments (JSON)"
                      id="agent-tool-args"
                      value={toolArgs}
                      onChange={(e) => setToolArgs(e.target.value)}
                      className="font-mono text-xs min-h-[100px]"
                    />
                    <Button onClick={handleExecuteTool} className="w-full">
                      <Play className="h-4 w-4 mr-1" />
                      Execute Tool
                    </Button>
                    {execResult && (
                      <div>
                        <h4 className="text-xs font-medium mb-1 text-muted-foreground">Response</h4>
                        <pre className="bg-secondary rounded-md p-3 text-xs font-mono overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
                          {execResult}
                        </pre>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : !runAllResults ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Wrench className="h-10 w-10 text-muted-foreground mb-3" />
                  <h3 className="text-sm font-medium mb-1">Select a tool or run all</h3>
                  <p className="text-muted-foreground text-xs">
                    Pick a tool from the left or click "Run All Tools"
                  </p>
                </CardContent>
              </Card>
            ) : null}

            {/* Execution Logs */}
            {logs.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ScrollText className="h-4 w-4" />
                    Execution History ({logs.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {logs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between p-2 bg-secondary/50 rounded text-xs"
                      >
                        <div className="flex items-center gap-2">
                          {log.success ? (
                            <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 text-red-400" />
                          )}
                          <span className="font-mono">{log.tool_name}</span>
                        </div>
                        <div className="flex items-center gap-3 text-muted-foreground">
                          <span>{log.duration_ms}ms</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(log.created_at).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
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

  // Agent list view
  return (
    <div>
      <Backdrop open={loading} message={backdropMessage} />

      <div className="flex items-center justify-between mb-8">
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
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
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
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); handleDelete(agent.id); }}
                    className="text-muted-foreground hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <CardDescription className="ml-7">
                  {agent.description || "No description"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant={agent.status === "running" ? "default" : "secondary"}>
                      {agent.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Product</span>
                    <span>{agent.product?.name || "Not linked"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Model</span>
                    <span className="font-mono text-xs">{agent.model}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Tool Calls</span>
                    <span>{agent.logCount}</span>
                  </div>
                  {agent.mcpServer && (
                    <div className="pt-2 border-t border-border">
                      <span className="text-xs text-muted-foreground font-mono">
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
          <Input
            label="Agent Name"
            id="agent-name"
            placeholder="My API Agent"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
          />
          <Input
            label="Description (optional)"
            id="agent-desc"
            placeholder="Agent for testing user management APIs"
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
          />
          <Select
            label="MCP-Enabled Product"
            id="agent-product"
            value={formProductId}
            onChange={(e) => setFormProductId(e.target.value)}
            options={[
              { value: "", label: "-- Select a product --" },
              ...products.map((p) => ({
                value: p.id,
                label: `${p.name} (${p.apis.length} APIs)`,
              })),
            ]}
          />
          <Input
            label="Model"
            id="agent-model"
            placeholder="local"
            value={formModel}
            onChange={(e) => setFormModel(e.target.value)}
          />
          <Textarea
            label="System Prompt (optional)"
            id="agent-prompt"
            placeholder="You are an API testing agent. Call tools to verify endpoint behavior."
            value={formSystemPrompt}
            onChange={(e) => setFormSystemPrompt(e.target.value)}
            className="min-h-[80px]"
          />
          {products.length === 0 && (
            <p className="text-xs text-yellow-500">
              No MCP-enabled products found. Create a product and enable MCP first.
            </p>
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
