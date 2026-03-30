import { useState, useEffect, useCallback } from "react";
import { cloudAgentsApi, gatewaysApi } from "@/lib/api";
import type { CloudAgent, CloudAgentLog, Gateway } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Cloud,
  RefreshCw,
  Search,
  Power,
  PowerOff,
  MessageSquare,
  Send,
  ArrowLeft,
  Trash2,
  Download,
  Clock,
  Activity,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Zap,
  Brain,
  Shield,
  Database,
  ExternalLink,
} from "lucide-react";

// ─── Helper Components ──────────────────────────────────────────────────────

function StatusBadge({ status, enabled }: { status: string; enabled: number }) {
  const getColor = () => {
    if (enabled && status === "PREPARED") return "bg-emerald-500";
    if (status === "PREPARING") return "bg-amber-500 animate-pulse";
    if (status === "PREPARED") return "bg-blue-500";
    if (status === "NOT_PREPARED") return "bg-gray-500";
    if (status === "FAILED" || status === "DELETING") return "bg-red-500";
    return "bg-gray-500";
  };

  const getLabel = () => {
    if (enabled && status === "PREPARED") return "Enabled";
    if (status === "PREPARING") return "Preparing...";
    if (status === "PREPARED") return "Prepared (Disabled)";
    if (status === "NOT_PREPARED") return "Not Prepared";
    return status;
  };

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
      <span className={`w-2 h-2 rounded-full ${getColor()}`} />
      {getLabel()}
    </span>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="p-1 rounded hover:bg-accent text-muted-foreground"
      title="Copy"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function ModelBadge({ model }: { model: string }) {
  const short = model?.split("/").pop()?.split(":")[0] || model || "unknown";
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-mono">
      <Brain className="h-3 w-3" />
      {short}
    </span>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function CloudAgentsPage() {
  const [agents, setAgents] = useState<CloudAgent[]>([]);
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<CloudAgent | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [a, g] = await Promise.all([cloudAgentsApi.list(), gatewaysApi.list()]);
      setAgents(a);
      setGateways(g.filter((gw) => gw.type === "aws"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleDiscover = async (gatewayId: string) => {
    setDiscovering(true);
    setError(null);
    try {
      await cloudAgentsApi.discover(gatewayId);
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Discovery failed");
    } finally {
      setDiscovering(false);
    }
  };

  const handleToggle = async (agent: CloudAgent) => {
    try {
      if (agent.enabled) {
        await cloudAgentsApi.disable(agent.id);
      } else {
        await cloudAgentsApi.enable(agent.id);
      }
      await fetchAll();
      if (selectedAgent?.id === agent.id) {
        const updated = await cloudAgentsApi.get(agent.id);
        setSelectedAgent(updated);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Toggle failed");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await cloudAgentsApi.delete(id);
      if (selectedAgent?.id === id) setSelectedAgent(null);
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const filteredAgents = agents.filter((a) => {
    const matchesSearch =
      !search ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.description?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "enabled" && a.enabled) ||
      (statusFilter === "disabled" && !a.enabled) ||
      (statusFilter === "not_prepared" && a.status === "NOT_PREPARED");
    return matchesSearch && matchesStatus;
  });

  if (selectedAgent) {
    return (
      <AgentDetail
        agent={selectedAgent}
        onBack={() => {
          setSelectedAgent(null);
          fetchAll();
        }}
        onToggle={() => handleToggle(selectedAgent)}
        onRefresh={async () => {
          const updated = await cloudAgentsApi.get(selectedAgent.id);
          setSelectedAgent(updated);
        }}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Cloud Agents</h1>
          <p className="text-muted-foreground text-sm mt-1">
            AWS Bedrock agents — discover, enable/disable, and invoke
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
          {error}
          <button className="ml-2 underline" onClick={() => setError(null)}>
            dismiss
          </button>
        </div>
      )}

      {/* Discovery Section */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Cloud className="h-4 w-4" />
            Discover Bedrock Agents
          </CardTitle>
        </CardHeader>
        <CardContent>
          {gateways.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No AWS gateways registered. Register an AWS API Gateway first to discover Bedrock agents.
            </p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {gateways.map((gw) => (
                <Button
                  key={gw.id}
                  variant="outline"
                  size="sm"
                  disabled={discovering}
                  onClick={() => handleDiscover(gw.id)}
                >
                  {discovering ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Cloud className="h-4 w-4 mr-2" />
                  )}
                  Discover from {gw.name}
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Search & Filter */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search agents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="enabled">Enabled</option>
          <option value="disabled">Disabled</option>
          <option value="not_prepared">Not Prepared</option>
        </select>
        <span className="text-sm text-muted-foreground">
          {filteredAgents.length} of {agents.length} agents
        </span>
      </div>

      {/* Agent Grid */}
      {loading ? (
        <p className="text-center text-muted-foreground py-12">Loading...</p>
      ) : filteredAgents.length === 0 ? (
        <div className="text-center py-12">
          <Cloud className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">
            {agents.length === 0
              ? "No cloud agents discovered yet. Click a gateway above to discover."
              : "No agents match your search."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredAgents.map((agent) => (
            <Card
              key={agent.id}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => setSelectedAgent(agent)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Cloud className="h-4 w-4 text-primary shrink-0" />
                    <h3 className="font-semibold text-sm truncate">{agent.name}</h3>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      className={`p-1.5 rounded transition-colors ${
                        agent.enabled
                          ? "text-emerald-500 hover:bg-emerald-500/10"
                          : "text-muted-foreground hover:bg-accent"
                      }`}
                      title={agent.enabled ? "Disable Agent" : "Enable Agent"}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggle(agent);
                      }}
                    >
                      {agent.enabled ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
                    </button>
                    <button
                      className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      title="Remove"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(agent.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                  {agent.description || "No description"}
                </p>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Status</span>
                    <StatusBadge status={agent.status} enabled={agent.enabled} />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Model</span>
                    <ModelBadge model={agent.foundation_model} />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Region</span>
                    <span className="font-mono">{agent.region}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border">
                  <div className="text-center flex-1">
                    <p className="text-lg font-bold">{agent.logCount}</p>
                    <p className="text-[10px] text-muted-foreground">Calls</p>
                  </div>
                  <div className="text-center flex-1">
                    <p className="text-lg font-bold">{agent.successRate}%</p>
                    <p className="text-[10px] text-muted-foreground">Success</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Agent Detail View ──────────────────────────────────────────────────────

function AgentDetail({
  agent,
  onBack,
  onToggle,
  onRefresh,
}: {
  agent: CloudAgent;
  onBack: () => void;
  onToggle: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [chatInput, setChatInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<
    Array<{ role: "user" | "agent"; text: string; durationMs?: number }>
  >([]);
  const [sending, setSending] = useState(false);
  const [logs, setLogs] = useState<CloudAgentLog[]>(agent.logs || []);
  const [syncing, setSyncing] = useState(false);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const handleSend = async () => {
    if (!chatInput.trim() || sending) return;
    const input = chatInput.trim();
    setChatInput("");
    setChatHistory((prev) => [...prev, { role: "user", text: input }]);
    setSending(true);

    try {
      const result = await cloudAgentsApi.invoke(agent.id, input, sessionId || undefined);
      if (!sessionId) setSessionId(result.sessionId);
      setChatHistory((prev) => [
        ...prev,
        { role: "agent", text: result.outputText, durationMs: result.durationMs },
      ]);
      // Refresh logs
      const newLogs = await cloudAgentsApi.getLogs(agent.id);
      setLogs(newLogs);
      await onRefresh();
    } catch (err) {
      setChatHistory((prev) => [
        ...prev,
        { role: "agent", text: `Error: ${err instanceof Error ? err.message : "Invocation failed"}` },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await cloudAgentsApi.sync(agent.id);
      await onRefresh();
    } finally {
      setSyncing(false);
    }
  };

  const handleExport = async () => {
    try {
      const data = await cloudAgentsApi.exportLogs(agent.id);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cloud-agent-${agent.name.replace(/\s+/g, "-").toLowerCase()}-logs.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  };

  const handleClearLogs = async () => {
    try {
      await cloudAgentsApi.clearLogs(agent.id);
      setLogs([]);
      await onRefresh();
    } catch {
      // ignore
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Cloud className="h-5 w-5 text-primary" />
              {agent.name}
            </h1>
            <p className="text-sm text-muted-foreground">{agent.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={agent.status} enabled={agent.enabled} />
          <Button
            variant={agent.enabled ? "destructive" : "default"}
            size="sm"
            onClick={onToggle}
          >
            {agent.enabled ? (
              <>
                <PowerOff className="h-4 w-4 mr-1" /> Disable
              </>
            ) : (
              <>
                <Power className="h-4 w-4 mr-1" /> Enable
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Activity className="h-3.5 w-3.5" /> Total Calls
            </div>
            <p className="text-xl font-bold">{agent.logCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Zap className="h-3.5 w-3.5" /> Success Rate
            </div>
            <p className="text-xl font-bold">{agent.successRate}%</p>
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Brain className="h-3.5 w-3.5" /> Model
            </div>
            <p className="text-sm font-mono truncate" title={agent.foundation_model}>
              {agent.foundation_model?.split("/").pop()?.split(":")[0] || "N/A"}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Clock className="h-3.5 w-3.5" /> Last Synced
            </div>
            <p className="text-sm">
              {agent.last_synced
                ? new Date(agent.last_synced).toLocaleTimeString()
                : "Never"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Config & Info */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="h-4 w-4" /> Agent Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">AWS Agent ID</span>
                <span className="font-mono text-xs flex items-center gap-1">
                  {agent.aws_agent_id}
                  <CopyBtn text={agent.aws_agent_id} />
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Region</span>
                <span className="font-mono">{agent.region}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Foundation Model</span>
                <ModelBadge model={agent.foundation_model} />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Session TTL</span>
                <span>{agent.idle_session_ttl}s</span>
              </div>
              {agent.agent_arn && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ARN</span>
                  <span className="font-mono text-[10px] max-w-[200px] truncate flex items-center gap-1" title={agent.agent_arn}>
                    {agent.agent_arn}
                    <CopyBtn text={agent.agent_arn} />
                  </span>
                </div>
              )}
              {agent.alias_id && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Alias ID</span>
                  <span className="font-mono text-xs">{agent.alias_id}</span>
                </div>
              )}
              {agent.gateway && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Gateway</span>
                  <span>{agent.gateway.name}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {agent.instruction && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Database className="h-4 w-4" /> Instructions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                  {agent.instruction}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
                <RefreshCw className={`h-4 w-4 mr-1 ${syncing ? "animate-spin" : ""}`} />
                Sync Status
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={agent.logCount === 0}
              >
                <Download className="h-4 w-4 mr-1" /> Export Logs
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearLogs}
                disabled={agent.logCount === 0}
              >
                <Trash2 className="h-4 w-4 mr-1" /> Clear Logs
              </Button>
              {agent.agent_arn && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const region = agent.region || "us-east-1";
                    const url = `https://${region}.console.aws.amazon.com/bedrock/home?region=${region}#/agents/${agent.aws_agent_id}`;
                    window.open(url, "_blank");
                  }}
                >
                  <ExternalLink className="h-4 w-4 mr-1" /> View in AWS
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Invocation History */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4" /> Invocation History ({logs.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <p className="text-xs text-muted-foreground">No invocations yet</p>
              ) : (
                <div className="space-y-1 max-h-80 overflow-y-auto">
                  {logs.map((log) => (
                    <div key={log.id}>
                      <button
                        className="w-full text-left px-2 py-1.5 rounded hover:bg-accent text-xs flex items-center justify-between"
                        onClick={() =>
                          setExpandedLog(expandedLog === log.id ? null : log.id)
                        }
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {expandedLog === log.id ? (
                            <ChevronDown className="h-3 w-3 shrink-0" />
                          ) : (
                            <ChevronRight className="h-3 w-3 shrink-0" />
                          )}
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              log.success ? "bg-emerald-500" : "bg-red-500"
                            }`}
                          />
                          <span className="truncate">{log.input_text}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <span className="text-muted-foreground">{log.duration_ms}ms</span>
                          <span className="text-muted-foreground">
                            {new Date(log.created_at).toLocaleTimeString()}
                          </span>
                        </div>
                      </button>
                      {expandedLog === log.id && (
                        <div className="mx-2 mb-2 p-2 rounded bg-muted/50 text-xs space-y-2">
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-muted-foreground">Input</span>
                              <CopyBtn text={log.input_text} />
                            </div>
                            <p className="mt-1 whitespace-pre-wrap">{log.input_text}</p>
                          </div>
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-muted-foreground">Output</span>
                              <CopyBtn text={log.output_text} />
                            </div>
                            <p className="mt-1 whitespace-pre-wrap">{log.output_text}</p>
                          </div>
                          {log.session_id && (
                            <div className="text-muted-foreground">
                              Session: <span className="font-mono">{log.session_id}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Chat / Invoke */}
        <Card className="h-fit">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageSquare className="h-4 w-4" /> Invoke Agent
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!agent.enabled ? (
              <div className="text-center py-8">
                <PowerOff className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-3">
                  Agent is disabled. Enable it to start invoking.
                </p>
                <Button size="sm" onClick={onToggle}>
                  <Power className="h-4 w-4 mr-1" /> Enable Agent
                </Button>
              </div>
            ) : (
              <>
                {/* Chat History */}
                <div className="min-h-[300px] max-h-[500px] overflow-y-auto mb-3 space-y-3">
                  {chatHistory.length === 0 ? (
                    <div className="text-center py-12">
                      <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Send a message to invoke the agent
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2 justify-center">
                        {agent.aws_agent_id === "MOCK-AGENT-001" && (
                          <>
                            <button
                              className="text-xs px-2 py-1 rounded-full border hover:bg-accent"
                              onClick={() => setChatInput("What is the status of my order?")}
                            >
                              Check order status
                            </button>
                            <button
                              className="text-xs px-2 py-1 rounded-full border hover:bg-accent"
                              onClick={() => setChatInput("I want to return an item")}
                            >
                              Start a return
                            </button>
                          </>
                        )}
                        {agent.aws_agent_id === "MOCK-AGENT-002" && (
                          <>
                            <button
                              className="text-xs px-2 py-1 rounded-full border hover:bg-accent"
                              onClick={() => setChatInput("Show me the revenue report")}
                            >
                              Revenue report
                            </button>
                            <button
                              className="text-xs px-2 py-1 rounded-full border hover:bg-accent"
                              onClick={() => setChatInput("Generate monthly performance report")}
                            >
                              Monthly report
                            </button>
                          </>
                        )}
                        {!["MOCK-AGENT-001", "MOCK-AGENT-002"].includes(agent.aws_agent_id) && (
                          <button
                            className="text-xs px-2 py-1 rounded-full border hover:bg-accent"
                            onClick={() => setChatInput("Hello, what can you help me with?")}
                          >
                            Say hello
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    chatHistory.map((msg, i) => (
                      <div
                        key={i}
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                            msg.role === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{msg.text}</p>
                          {msg.durationMs !== undefined && (
                            <p className="text-[10px] opacity-60 mt-1">{msg.durationMs}ms</p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                  {sending && (
                    <div className="flex justify-start">
                      <div className="bg-muted rounded-lg px-3 py-2 text-sm">
                        <span className="inline-flex gap-1">
                          <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                          <span
                            className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                            style={{ animationDelay: "0.1s" }}
                          />
                          <span
                            className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                            style={{ animationDelay: "0.2s" }}
                          />
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Input */}
                <div className="flex gap-2">
                  <Input
                    placeholder="Type a message..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    disabled={sending}
                  />
                  <Button onClick={handleSend} disabled={sending || !chatInput.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                {sessionId && (
                  <p className="text-[10px] text-muted-foreground mt-2">
                    Session: <span className="font-mono">{sessionId.substring(0, 8)}...</span>
                    <button
                      className="ml-2 underline"
                      onClick={() => {
                        setSessionId(null);
                        setChatHistory([]);
                      }}
                    >
                      New session
                    </button>
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
