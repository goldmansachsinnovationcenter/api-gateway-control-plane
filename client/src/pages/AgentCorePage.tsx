import { useState, useEffect, useCallback } from "react";
import { agentCoreApi, gatewaysApi } from "@/lib/api";
import type { AgentCoreRuntime, AgentCoreRuntimeLog, AgentCoreGateway, AgentCoreGatewayTarget, Gateway } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft, Search, RefreshCw, Trash2, Download, Send, ChevronDown, ChevronRight,
  Zap, Shield, Globe, Server, Activity, Clock, Copy, Check, X, Play,
} from "lucide-react";

// ─── Helpers ────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    READY: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    CREATING: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    UPDATING: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    CREATE_FAILED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    UPDATE_FAILED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    FAILED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    DELETING: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
    SYNCHRONIZING: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    SYNCHRONIZE_UNSUCCESSFUL: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    UPDATE_UNSUCCESSFUL: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };
  const cls = colors[status] || "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{status}</span>;
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="p-1 rounded hover:bg-accent text-muted-foreground"
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function AuthBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    CUSTOM_JWT: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    AWS_IAM: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    NONE: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  };
  const cls = colors[type] || "bg-gray-100 text-gray-600";
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{type}</span>;
}

type Tab = "runtimes" | "gateways";
type ViewMode = "list" | "runtime-detail" | "gateway-detail";

// ─── Main Component ─────────────────────────────────────────────────────────

export function AgentCorePage() {
  const [tab, setTab] = useState<Tab>("runtimes");
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  // Data
  const [runtimes, setRuntimes] = useState<AgentCoreRuntime[]>([]);
  const [acGateways, setAcGateways] = useState<AgentCoreGateway[]>([]);
  const [localGateways, setLocalGateways] = useState<Gateway[]>([]);
  const [selectedRuntime, setSelectedRuntime] = useState<AgentCoreRuntime | null>(null);
  const [selectedGateway, setSelectedGateway] = useState<AgentCoreGateway | null>(null);

  // UI state
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState<string | null>(null);

  // Chat state (for runtime invocation)
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant"; text: string; durationMs?: number }>>([]);
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const [invoking, setInvoking] = useState(false);

  // Log state
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  // ─── Data Loading ───────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [rts, gws, localGws] = await Promise.all([
        agentCoreApi.listRuntimes(),
        agentCoreApi.listGateways(),
        gatewaysApi.list(),
      ]);
      setRuntimes(rts);
      setAcGateways(gws);
      setLocalGateways(localGws.filter((g: Gateway) => g.type === "aws"));
    } catch (err) {
      console.error("Failed to load AgentCore data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Discovery ──────────────────────────────────────────────────────────

  const handleDiscoverRuntimes = async (gatewayId: string) => {
    setDiscovering(gatewayId + "-runtimes");
    try {
      await agentCoreApi.discoverRuntimes(gatewayId);
      await loadData();
    } catch (err) {
      console.error("Discovery failed:", err);
    } finally {
      setDiscovering(null);
    }
  };

  const handleDiscoverGateways = async (gatewayId: string) => {
    setDiscovering(gatewayId + "-gateways");
    try {
      await agentCoreApi.discoverGateways(gatewayId);
      await loadData();
    } catch (err) {
      console.error("Discovery failed:", err);
    } finally {
      setDiscovering(null);
    }
  };

  // ─── Runtime Actions ────────────────────────────────────────────────────

  const openRuntime = async (id: string) => {
    const rt = await agentCoreApi.getRuntime(id);
    setSelectedRuntime(rt);
    setChatMessages([]);
    setChatSessionId(null);
    setViewMode("runtime-detail");
  };

  const handleInvokeRuntime = async () => {
    if (!selectedRuntime || !chatInput.trim()) return;
    const text = chatInput.trim();
    setChatInput("");
    setChatMessages(prev => [...prev, { role: "user", text }]);
    setInvoking(true);
    try {
      const result = await agentCoreApi.invokeRuntime(selectedRuntime.id, text, chatSessionId || undefined);
      setChatSessionId(result.sessionId);
      setChatMessages(prev => [...prev, { role: "assistant", text: result.outputText, durationMs: result.durationMs }]);
      // Refresh runtime data for updated stats
      const updated = await agentCoreApi.getRuntime(selectedRuntime.id);
      setSelectedRuntime(updated);
    } catch (err) {
      setChatMessages(prev => [...prev, { role: "assistant", text: `Error: ${err instanceof Error ? err.message : "Unknown error"}` }]);
    } finally {
      setInvoking(false);
    }
  };

  const handleSyncRuntime = async (id: string) => {
    const updated = await agentCoreApi.syncRuntime(id);
    setSelectedRuntime(updated);
    await loadData();
  };

  const handleExportRuntimeLogs = async (id: string) => {
    const data = await agentCoreApi.exportRuntimeLogs(id);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `agentcore-runtime-${id}-logs.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearRuntimeLogs = async (id: string) => {
    await agentCoreApi.clearRuntimeLogs(id);
    const updated = await agentCoreApi.getRuntime(id);
    setSelectedRuntime(updated);
  };

  const handleDeleteRuntime = async (id: string) => {
    await agentCoreApi.deleteRuntime(id);
    setViewMode("list");
    setSelectedRuntime(null);
    await loadData();
  };

  // ─── Gateway Actions ────────────────────────────────────────────────────

  const openGateway = async (id: string) => {
    const gw = await agentCoreApi.getGateway(id);
    setSelectedGateway(gw);
    setViewMode("gateway-detail");
  };

  const handleSyncGateway = async (id: string) => {
    const updated = await agentCoreApi.syncGateway(id);
    setSelectedGateway(updated);
    await loadData();
  };

  const handleDeleteGateway = async (id: string) => {
    await agentCoreApi.deleteGateway(id);
    setViewMode("list");
    setSelectedGateway(null);
    await loadData();
  };

  // ─── Filtering ──────────────────────────────────────────────────────────

  const filteredRuntimes = runtimes.filter(rt => {
    if (search && !rt.name.toLowerCase().includes(search.toLowerCase()) && !(rt.description || "").toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== "all" && rt.status !== statusFilter) return false;
    return true;
  });

  const filteredGateways = acGateways.filter(gw => {
    if (search && !gw.name.toLowerCase().includes(search.toLowerCase()) && !(gw.description || "").toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== "all" && gw.status !== statusFilter) return false;
    return true;
  });

  const allStatuses = tab === "runtimes"
    ? [...new Set(runtimes.map(r => r.status))]
    : [...new Set(acGateways.map(g => g.status))];

  // ─── Render: Runtime Detail ─────────────────────────────────────────────

  if (viewMode === "runtime-detail" && selectedRuntime) {
    const rt = selectedRuntime;
    const suggestedPrompts = [
      "Hello, what can you do?",
      "Summarize this conversation so far",
      "Help me analyze some data",
    ];

    return (
      <div className="space-y-6">
        <button onClick={() => { setViewMode("list"); setSelectedRuntime(null); }} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to AgentCore
        </button>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{rt.name}</h1>
              <StatusBadge status={rt.status} />
            </div>
            {rt.description && <p className="text-muted-foreground mt-1">{rt.description}</p>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => handleSyncRuntime(rt.id)} className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-accent flex items-center gap-1">
              <RefreshCw className="h-3.5 w-3.5" /> Sync
            </button>
            <button onClick={() => handleExportRuntimeLogs(rt.id)} className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-accent flex items-center gap-1">
              <Download className="h-3.5 w-3.5" /> Export Logs
            </button>
            <button onClick={() => handleClearRuntimeLogs(rt.id)} className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-accent flex items-center gap-1 text-orange-600">
              <Trash2 className="h-3.5 w-3.5" /> Clear Logs
            </button>
            <button onClick={() => handleDeleteRuntime(rt.id)} className="px-3 py-1.5 text-sm rounded-md border border-red-300 hover:bg-red-50 text-red-600 flex items-center gap-1">
              <X className="h-3.5 w-3.5" /> Delete
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Total Calls", value: rt.logCount, icon: Activity },
            { label: "Success Rate", value: `${rt.successRate}%`, icon: Zap },
            { label: "Region", value: rt.region, icon: Globe },
            { label: "Version", value: rt.version || "N/A", icon: Server },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><s.icon className="h-3.5 w-3.5" />{s.label}</div>
                <div className="text-lg font-semibold">{s.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Configuration */}
        <Card>
          <CardHeader><CardTitle className="text-base">Configuration</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {[
                ["Runtime ID", rt.runtime_id],
                ["Region", rt.region],
                ["Version", rt.version || "N/A"],
                ["Status", rt.status],
                ["ARN", rt.runtime_arn || "N/A"],
                ["Last Synced", rt.last_synced ? new Date(rt.last_synced).toLocaleString() : "Never"],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <span className="text-muted-foreground">{label}</span>
                  <div className="font-mono text-xs mt-0.5 flex items-center gap-1">
                    {value} {(value as string).length > 10 && <CopyBtn text={value as string} />}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Chat Interface */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Send className="h-4 w-4" /> Invoke Runtime
              {chatSessionId && <span className="text-xs text-muted-foreground font-normal">Session: {chatSessionId.slice(0, 8)}...</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {rt.status !== "READY" ? (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Runtime is not ready. Current status: <StatusBadge status={rt.status} /></p>
              </div>
            ) : (
              <>
                {chatMessages.length === 0 && (
                  <div className="mb-4">
                    <p className="text-sm text-muted-foreground mb-2">Suggested prompts:</p>
                    <div className="flex flex-wrap gap-2">
                      {suggestedPrompts.map(p => (
                        <button key={p} onClick={() => { setChatInput(p); }} className="px-3 py-1.5 text-xs rounded-full border border-border hover:bg-accent transition-colors">
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-3 max-h-80 overflow-y-auto mb-4">
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                        <p className="whitespace-pre-wrap">{msg.text}</p>
                        {msg.durationMs !== undefined && (
                          <p className="text-[10px] opacity-60 mt-1">{msg.durationMs}ms</p>
                        )}
                      </div>
                    </div>
                  ))}
                  {invoking && (
                    <div className="flex justify-start">
                      <div className="bg-muted rounded-lg px-3 py-2 text-sm animate-pulse">Thinking...</div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <input
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleInvokeRuntime()}
                    placeholder="Send a message to the runtime..."
                    className="flex-1 px-3 py-2 text-sm border border-border rounded-md bg-background"
                    disabled={invoking}
                  />
                  <button onClick={handleInvokeRuntime} disabled={invoking || !chatInput.trim()} className="px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50">
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Invocation History */}
        {rt.logs && rt.logs.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Invocation History</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {rt.logs.map(log => (
                  <div key={log.id} className="border border-border rounded-md">
                    <button
                      className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-accent/50 transition-colors"
                      onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                    >
                      <div className="flex items-center gap-2">
                        {expandedLog === log.id ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        <span className={log.success ? "text-green-600" : "text-red-600"}>{log.success ? "Success" : "Failed"}</span>
                        <span className="text-muted-foreground truncate max-w-[300px]">{log.input_text}</span>
                      </div>
                      <div className="flex items-center gap-3 text-muted-foreground text-xs">
                        <span>{log.duration_ms}ms</span>
                        <span>{new Date(log.created_at).toLocaleString()}</span>
                      </div>
                    </button>
                    {expandedLog === log.id && (
                      <div className="px-3 pb-3 border-t border-border">
                        <div className="mt-2 space-y-2">
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-muted-foreground">Input</span>
                              <CopyBtn text={log.input_text} />
                            </div>
                            <pre className="text-xs bg-muted rounded p-2 mt-1 whitespace-pre-wrap">{log.input_text}</pre>
                          </div>
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-muted-foreground">Output</span>
                              <CopyBtn text={log.output_text} />
                            </div>
                            <pre className="text-xs bg-muted rounded p-2 mt-1 whitespace-pre-wrap">{log.output_text}</pre>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // ─── Render: Gateway Detail ─────────────────────────────────────────────

  if (viewMode === "gateway-detail" && selectedGateway) {
    const gw = selectedGateway;
    return (
      <div className="space-y-6">
        <button onClick={() => { setViewMode("list"); setSelectedGateway(null); }} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to AgentCore
        </button>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{gw.name}</h1>
              <StatusBadge status={gw.status} />
              <AuthBadge type={gw.authorizer_type} />
            </div>
            {gw.description && <p className="text-muted-foreground mt-1">{gw.description}</p>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => handleSyncGateway(gw.id)} className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-accent flex items-center gap-1">
              <RefreshCw className="h-3.5 w-3.5" /> Sync
            </button>
            <button onClick={() => handleDeleteGateway(gw.id)} className="px-3 py-1.5 text-sm rounded-md border border-red-300 hover:bg-red-50 text-red-600 flex items-center gap-1">
              <X className="h-3.5 w-3.5" /> Delete
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Protocol", value: gw.protocol_type, icon: Zap },
            { label: "Auth Type", value: gw.authorizer_type, icon: Shield },
            { label: "Region", value: gw.region, icon: Globe },
            { label: "Targets", value: gw.targets.length, icon: Server },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><s.icon className="h-3.5 w-3.5" />{s.label}</div>
                <div className="text-lg font-semibold">{s.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Configuration */}
        <Card>
          <CardHeader><CardTitle className="text-base">Configuration</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {[
                ["Gateway ID", gw.ac_gateway_id],
                ["Protocol", gw.protocol_type],
                ["Auth Type", gw.authorizer_type],
                ["Region", gw.region],
                ["Status", gw.status],
                ["Last Synced", gw.last_synced ? new Date(gw.last_synced).toLocaleString() : "Never"],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <span className="text-muted-foreground">{label}</span>
                  <div className="font-mono text-xs mt-0.5 flex items-center gap-1">
                    {value} {(value as string).length > 10 && <CopyBtn text={value as string} />}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Gateway Targets (MCP Tools) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Server className="h-4 w-4" /> Gateway Targets ({gw.targets.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {gw.targets.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">No targets registered on this gateway</p>
            ) : (
              <div className="space-y-3">
                {gw.targets.map((tgt: AgentCoreGatewayTarget) => (
                  <div key={tgt.id} className="border border-border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`h-2.5 w-2.5 rounded-full ${tgt.status === "READY" ? "bg-green-500" : tgt.status === "SYNCHRONIZING" ? "bg-blue-500 animate-pulse" : "bg-gray-400"}`} />
                        <div>
                          <h4 className="font-medium text-sm">{tgt.name}</h4>
                          {tgt.description && <p className="text-xs text-muted-foreground mt-0.5">{tgt.description}</p>}
                        </div>
                      </div>
                      <StatusBadge status={tgt.status} />
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Target ID: <span className="font-mono">{tgt.target_id}</span></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Render: List View ──────────────────────────────────────────────────

  const awsGateways = localGateways.filter(g => g.type === "aws");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AgentCore</h1>
        <p className="text-muted-foreground">Discover and manage AWS Bedrock AgentCore runtimes and MCP gateways</p>
      </div>

      {/* Discovery Section */}
      {awsGateways.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Discover from AWS Account</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {awsGateways.map(gw => (
                <div key={gw.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                  <div>
                    <span className="font-medium text-sm">{gw.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">(AWS)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDiscoverRuntimes(gw.id)}
                      disabled={discovering !== null}
                      className="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1"
                    >
                      {discovering === gw.id + "-runtimes" ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                      Discover Runtimes
                    </button>
                    <button
                      onClick={() => handleDiscoverGateways(gw.id)}
                      disabled={discovering !== null}
                      className="px-3 py-1.5 text-xs rounded-md border border-primary text-primary hover:bg-primary/10 disabled:opacity-50 flex items-center gap-1"
                    >
                      {discovering === gw.id + "-gateways" ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Shield className="h-3 w-3" />}
                      Discover Gateways
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {awsGateways.length === 0 && runtimes.length === 0 && acGateways.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Server className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <h3 className="font-semibold mb-1">No AWS Gateway Registered</h3>
            <p className="text-sm text-muted-foreground">Register an AWS gateway first to discover AgentCore runtimes and gateways.</p>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      {(runtimes.length > 0 || acGateways.length > 0) && (
        <>
          <div className="flex items-center gap-4 border-b border-border">
            <button
              onClick={() => { setTab("runtimes"); setSearch(""); setStatusFilter("all"); }}
              className={`pb-2 text-sm font-medium border-b-2 transition-colors ${tab === "runtimes" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              Agent Runtimes ({runtimes.length})
            </button>
            <button
              onClick={() => { setTab("gateways"); setSearch(""); setStatusFilter("all"); }}
              className={`pb-2 text-sm font-medium border-b-2 transition-colors ${tab === "gateways" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              MCP Gateways ({acGateways.length})
            </button>
          </div>

          {/* Search & Filter */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={`Search ${tab}...`}
                className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-md bg-background"
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-border rounded-md bg-background"
            >
              <option value="all">All statuses</option>
              {allStatuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={loadData} className="px-3 py-2 text-sm border border-border rounded-md hover:bg-accent flex items-center gap-1">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
          </div>

          {/* Runtimes Grid */}
          {tab === "runtimes" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRuntimes.map(rt => (
                <Card key={rt.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => openRuntime(rt.id)}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-sm truncate flex-1">{rt.name}</h3>
                      <StatusBadge status={rt.status} />
                    </div>
                    {rt.description && (
                      <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{rt.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Globe className="h-3 w-3" />{rt.region}</span>
                      <span className="flex items-center gap-1"><Server className="h-3 w-3" />v{rt.version || "?"}</span>
                      <span className="flex items-center gap-1"><Activity className="h-3 w-3" />{rt.logCount} calls</span>
                      {rt.logCount > 0 && (
                        <span className="flex items-center gap-1"><Zap className="h-3 w-3" />{rt.successRate}%</span>
                      )}
                    </div>
                    {rt.gateway && (
                      <div className="mt-2 text-[10px] text-muted-foreground">
                        via {rt.gateway.name}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
              {filteredRuntimes.length === 0 && (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  {search || statusFilter !== "all" ? "No runtimes match your filters" : "No runtimes discovered yet. Use the discovery section above."}
                </div>
              )}
            </div>
          )}

          {/* Gateways Grid */}
          {tab === "gateways" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredGateways.map(gw => (
                <Card key={gw.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => openGateway(gw.id)}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-sm truncate flex-1">{gw.name}</h3>
                      <div className="flex items-center gap-1.5">
                        <StatusBadge status={gw.status} />
                      </div>
                    </div>
                    {gw.description && (
                      <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{gw.description}</p>
                    )}
                    <div className="flex items-center gap-3 mb-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                        {gw.protocol_type}
                      </span>
                      <AuthBadge type={gw.authorizer_type} />
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Globe className="h-3 w-3" />{gw.region}</span>
                      <span className="flex items-center gap-1"><Server className="h-3 w-3" />{gw.targets.length} targets</span>
                    </div>
                    {gw.gateway && (
                      <div className="mt-2 text-[10px] text-muted-foreground">
                        via {gw.gateway.name}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
              {filteredGateways.length === 0 && (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  {search || statusFilter !== "all" ? "No gateways match your filters" : "No MCP gateways discovered yet. Use the discovery section above."}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
