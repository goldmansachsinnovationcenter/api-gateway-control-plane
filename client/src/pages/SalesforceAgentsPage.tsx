import { useState, useEffect, useCallback } from "react";
import { salesforceAgentsApi } from "@/lib/api";
import type { SalesforceAgent, SalesforceAgentLog } from "@/lib/api";
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
  ExternalLink,
} from "lucide-react";

// ─── Helper Components ──────────────────────────────────────────────────────

function StatusBadge({ status, enabled }: { status: string; enabled: number }) {
  const getColor = () => {
    if (enabled && status === "Active") return "bg-emerald-500";
    if (status === "Active") return "bg-blue-500";
    if (status === "Inactive") return "bg-gray-500";
    if (status === "Error") return "bg-red-500";
    return "bg-gray-500";
  };

  const getLabel = () => {
    if (enabled && status === "Active") return "Enabled";
    if (status === "Active") return "Active (Disabled)";
    if (status === "Inactive") return "Inactive";
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

function ChannelBadge({ channel }: { channel: string }) {
  const colors: Record<string, string> = {
    "Sales Cloud": "bg-blue-500/10 text-blue-500",
    "Service Cloud": "bg-emerald-500/10 text-emerald-500",
    "Commerce Cloud": "bg-purple-500/10 text-purple-500",
    "API": "bg-orange-500/10 text-orange-500",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${colors[channel] || "bg-primary/10 text-primary"}`}>
      <Cloud className="h-3 w-3" />
      {channel}
    </span>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function SalesforceAgentsPage() {
  const [agents, setAgents] = useState<SalesforceAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<SalesforceAgent | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [instanceUrl, setInstanceUrl] = useState("");
  const [accessToken, setAccessToken] = useState("");

  const fetchAll = useCallback(async () => {
    try {
      const a = await salesforceAgentsApi.list();
      setAgents(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleDiscover = async () => {
    setDiscovering(true);
    setError(null);
    try {
      await salesforceAgentsApi.discover(instanceUrl || undefined, accessToken || undefined);
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Discovery failed");
    } finally {
      setDiscovering(false);
    }
  };

  const handleToggle = async (agent: SalesforceAgent) => {
    try {
      if (agent.enabled) {
        await salesforceAgentsApi.disable(agent.id);
      } else {
        await salesforceAgentsApi.enable(agent.id);
      }
      await fetchAll();
      if (selectedAgent?.id === agent.id) {
        const updated = await salesforceAgentsApi.get(agent.id);
        setSelectedAgent(updated);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Toggle failed");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await salesforceAgentsApi.delete(id);
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
      (statusFilter === "inactive" && a.status === "Inactive");
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
          const updated = await salesforceAgentsApi.get(selectedAgent.id);
          setSelectedAgent(updated);
        }}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Cloud className="h-6 w-6 text-[#00A1E0]" />
            Salesforce Agents
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Salesforce Agentforce agents — discover, enable/disable, and invoke
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
      <Card className="mb-6 border-[#00A1E0]/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Cloud className="h-4 w-4 text-[#00A1E0]" />
            Discover Salesforce Agents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            Connect to your Salesforce org to discover Agentforce agents. Leave fields empty to use demo agents.
          </p>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs text-muted-foreground block mb-1">Instance URL</label>
              <Input
                placeholder="https://your-org.salesforce.com"
                value={instanceUrl}
                onChange={(e) => setInstanceUrl(e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs text-muted-foreground block mb-1">Access Token (OAuth)</label>
              <Input
                type="password"
                placeholder="Optional — for real Salesforce connection"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                className="text-sm"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={discovering}
              onClick={handleDiscover}
              className="border-[#00A1E0]/30 hover:border-[#00A1E0] hover:bg-[#00A1E0]/5"
            >
              {discovering ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Cloud className="h-4 w-4 mr-2 text-[#00A1E0]" />
              )}
              Discover Agents
            </Button>
          </div>
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
          <option value="inactive">Inactive</option>
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
              ? 'No Salesforce agents discovered yet. Click "Discover Agents" above to get started.'
              : "No agents match your search."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredAgents.map((agent) => (
            <Card
              key={agent.id}
              className="cursor-pointer hover:border-[#00A1E0]/50 transition-colors"
              onClick={() => setSelectedAgent(agent)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Cloud className="h-4 w-4 text-[#00A1E0] shrink-0" />
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
                    <span className="text-muted-foreground">Channel</span>
                    <ChannelBadge channel={agent.channel} />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Model</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-mono">
                      <Brain className="h-3 w-3" />
                      {agent.model}
                    </span>
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
  agent: SalesforceAgent;
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
  const [logs, setLogs] = useState<SalesforceAgentLog[]>(agent.logs || []);
  const [syncing, setSyncing] = useState(false);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const handleSend = async () => {
    if (!chatInput.trim() || sending) return;
    const input = chatInput.trim();
    setChatInput("");
    setChatHistory((prev) => [...prev, { role: "user", text: input }]);
    setSending(true);

    try {
      const result = await salesforceAgentsApi.invoke(agent.id, input, sessionId || undefined);
      if (!sessionId) setSessionId(result.sessionId);
      setChatHistory((prev) => [
        ...prev,
        { role: "agent", text: result.output, durationMs: result.durationMs },
      ]);
      const newLogs = await salesforceAgentsApi.getLogs(agent.id);
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
      await salesforceAgentsApi.sync(agent.id);
      await onRefresh();
    } finally {
      setSyncing(false);
    }
  };

  const handleExport = async () => {
    try {
      const data = await salesforceAgentsApi.exportLogs(agent.id);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `salesforce-agent-${agent.name.replace(/\s+/g, "-").toLowerCase()}-logs.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  };

  const handleClearLogs = async () => {
    try {
      await salesforceAgentsApi.clearLogs(agent.id);
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
              <Cloud className="h-5 w-5 text-[#00A1E0]" />
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
        <Card className="bg-[#00A1E0]/5 border-[#00A1E0]/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Activity className="h-3.5 w-3.5" /> Total Calls
            </div>
            <p className="text-xl font-bold">{agent.logCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#00A1E0]/5 border-[#00A1E0]/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Zap className="h-3.5 w-3.5" /> Success Rate
            </div>
            <p className="text-xl font-bold">{agent.successRate}%</p>
          </CardContent>
        </Card>
        <Card className="bg-[#00A1E0]/5 border-[#00A1E0]/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Brain className="h-3.5 w-3.5" /> Model
            </div>
            <p className="text-sm font-mono truncate">{agent.model}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#00A1E0]/5 border-[#00A1E0]/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Cloud className="h-3.5 w-3.5" /> Channel
            </div>
            <p className="text-sm truncate">{agent.channel}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuration Panel */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Shield className="h-4 w-4" /> Configuration
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSync}
                  disabled={syncing}
                >
                  <RefreshCw className={`h-3.5 w-3.5 mr-1 ${syncing ? "animate-spin" : ""}`} />
                  Sync
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ConfigRow label="Agent ID" value={agent.sf_agent_id} copyable />
              <ConfigRow label="Agent Type" value={agent.agent_type} />
              <ConfigRow label="Channel" value={agent.channel} />
              <ConfigRow label="Model" value={agent.model} />
              <ConfigRow label="Instance URL" value={agent.instance_url} copyable />
              <ConfigRow label="Region" value={agent.region} />
              {agent.last_synced && (
                <ConfigRow label="Last Synced" value={new Date(agent.last_synced).toLocaleString()} />
              )}
            </CardContent>
          </Card>

          {agent.instruction && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Brain className="h-4 w-4" /> Agent Instructions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{agent.instruction}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Chat Interface */}
        <div className="space-y-4">
          <Card className="flex flex-col" style={{ minHeight: 400 }}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Chat with Agent
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              {!agent.enabled ? (
                <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                  Enable the agent to start chatting
                </div>
              ) : (
                <>
                  <div className="flex-1 overflow-y-auto space-y-3 mb-3 max-h-[300px]">
                    {chatHistory.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-8">
                        Send a message to start a conversation with the Salesforce agent
                      </p>
                    )}
                    {chatHistory.map((msg, i) => (
                      <div
                        key={i}
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                            msg.role === "user"
                              ? "bg-[#00A1E0] text-white"
                              : "bg-accent"
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{msg.text}</p>
                          {msg.durationMs !== undefined && (
                            <p className="text-[10px] opacity-60 mt-1">
                              {msg.durationMs}ms
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                    {sending && (
                      <div className="flex justify-start">
                        <div className="bg-accent rounded-lg px-3 py-2 text-sm text-muted-foreground animate-pulse">
                          Thinking...
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Type a message..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSend()}
                      disabled={sending}
                    />
                    <Button size="sm" onClick={handleSend} disabled={sending || !chatInput.trim()}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Invocation History */}
      <Card className="mt-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4" /> Invocation History ({logs.length})
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={handleExport}>
                <Download className="h-3.5 w-3.5 mr-1" /> Export
              </Button>
              {logs.length > 0 && (
                <Button variant="ghost" size="sm" onClick={handleClearLogs} className="text-destructive">
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Clear
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No invocation history</p>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <div key={log.id} className="border rounded-md">
                  <button
                    className="w-full flex items-center justify-between p-3 text-sm hover:bg-accent/50"
                    onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                  >
                    <div className="flex items-center gap-2">
                      {expandedLog === log.id ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                      <span className={`w-2 h-2 rounded-full ${log.success ? "bg-emerald-500" : "bg-red-500"}`} />
                      <span className="truncate max-w-[200px]">{log.input_text}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{log.duration_ms}ms</span>
                      <span>{new Date(log.created_at).toLocaleString()}</span>
                    </div>
                  </button>
                  {expandedLog === log.id && (
                    <div className="px-3 pb-3 border-t space-y-2">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mt-2">Input</p>
                        <div className="flex items-start gap-1">
                          <p className="text-sm bg-accent rounded p-2 flex-1">{log.input_text}</p>
                          <CopyBtn text={log.input_text} />
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Output</p>
                        <div className="flex items-start gap-1">
                          <p className="text-sm bg-accent rounded p-2 flex-1 whitespace-pre-wrap">{log.output_text}</p>
                          <CopyBtn text={log.output_text} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Config Row Helper ──────────────────────────────────────────────────────

function ConfigRow({ label, value, copyable }: { label: string; value: string; copyable?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        <span className="font-mono text-xs">{value || "—"}</span>
        {copyable && value && <CopyBtn text={value} />}
      </div>
    </div>
  );
}
