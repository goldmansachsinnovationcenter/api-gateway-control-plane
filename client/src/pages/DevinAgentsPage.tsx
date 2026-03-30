import { useState, useEffect, useCallback } from "react";
import { devinAgentsApi } from "@/lib/api";
import type { DevinSession, DevinUsageStats, DevinTool, DevinMcpServer, DevinAllTools, DevinSessionTools } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  RefreshCw,
  Search,
  Trash2,
  ExternalLink,
  Clock,
  Activity,
  Copy,
  Check,
  Zap,
  Users,
  BarChart3,
  Timer,
  Hash,
  ArrowLeft,
  Bot,
  Wrench,
  Server,
  ChevronDown,
  ChevronRight,
  Plug,
} from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    running: "bg-emerald-500",
    finished: "bg-blue-500",
    blocked: "bg-amber-500",
    failed: "bg-red-500",
    stopped: "bg-gray-500",
  };
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
      <span className={`w-2 h-2 rounded-full ${colors[status] || "bg-gray-500"} ${status === "running" ? "animate-pulse" : ""}`} />
      {status}
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

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function formatTokens(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export function DevinAgentsPage() {
  const [sessions, setSessions] = useState<DevinSession[]>([]);
  const [stats, setStats] = useState<DevinUsageStats | null>(null);
  const [allTools, setAllTools] = useState<DevinAllTools | null>(null);
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [selectedSession, setSelectedSession] = useState<DevinSession | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");

  const fetchAll = useCallback(async () => {
    try {
      const [s, st] = await Promise.all([
        devinAgentsApi.list(),
        devinAgentsApi.stats(),
      ]);
      setSessions(s);
      setStats(st);
      // Fetch tools only after sessions exist
      if (s.length > 0) {
        try {
          const tools = await devinAgentsApi.getAllTools();
          setAllTools(tools);
        } catch { /* tools are optional */ }
      }
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
      await devinAgentsApi.discover(apiKey || undefined);
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Discovery failed");
    } finally {
      setDiscovering(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await devinAgentsApi.delete(id);
      if (selectedSession?.id === id) setSelectedSession(null);
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const filteredSessions = sessions.filter((s) => {
    const matchesSearch =
      !search ||
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.created_by?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (selectedSession) {
    return (
      <SessionDetail
        session={selectedSession}
        onBack={() => {
          setSelectedSession(null);
          fetchAll();
        }}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="h-6 w-6 text-emerald-500" />
            Devin Agent
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Monitor Devin sessions, token usage, and user activity
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
      <Card className="mb-6 border-emerald-500/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bot className="h-4 w-4 text-emerald-500" />
            Connect to Devin
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            Provide your Devin API key to discover real sessions, or leave empty for demo data.
          </p>
          <div className="flex gap-3 items-end">
            <div className="flex-1 max-w-md">
              <label className="text-xs text-muted-foreground block mb-1">Devin API Key</label>
              <Input
                type="password"
                placeholder="Optional — for real Devin connection"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="text-sm"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={discovering}
              onClick={handleDiscover}
              className="border-emerald-500/30 hover:border-emerald-500 hover:bg-emerald-500/5"
            >
              {discovering ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Bot className="h-4 w-4 mr-2 text-emerald-500" />
              )}
              Discover Sessions
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Dashboard */}
      {stats && stats.totalSessions > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Card className="bg-emerald-500/5 border-emerald-500/20">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Hash className="h-3.5 w-3.5" /> Sessions
              </div>
              <p className="text-2xl font-bold">{stats.totalSessions}</p>
            </CardContent>
          </Card>
          <Card className="bg-blue-500/5 border-blue-500/20">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Zap className="h-3.5 w-3.5" /> Total Tokens
              </div>
              <p className="text-2xl font-bold">{formatTokens(stats.totalTokens)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {formatTokens(stats.totalPromptTokens)} prompt / {formatTokens(stats.totalCompletionTokens)} completion
              </p>
            </CardContent>
          </Card>
          <Card className="bg-purple-500/5 border-purple-500/20">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Users className="h-3.5 w-3.5" /> Users
              </div>
              <p className="text-2xl font-bold">{stats.uniqueUsers}</p>
            </CardContent>
          </Card>
          <Card className="bg-amber-500/5 border-amber-500/20">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Timer className="h-3.5 w-3.5" /> Avg Duration
              </div>
              <p className="text-2xl font-bold">{formatDuration(stats.avgDurationSeconds)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Token Usage Chart (simple bar) */}
      {stats && stats.dailyUsage && stats.dailyUsage.some(d => d.tokens > 0) && (
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Daily Token Usage (Last 7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 h-32">
              {stats.dailyUsage.map((day) => {
                const maxTokens = Math.max(...stats.dailyUsage.map(d => d.tokens), 1);
                const height = day.tokens > 0 ? Math.max((day.tokens / maxTokens) * 100, 4) : 0;
                return (
                  <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] text-muted-foreground">
                      {day.tokens > 0 ? formatTokens(day.tokens) : ""}
                    </span>
                    <div
                      className="w-full bg-emerald-500/60 rounded-t transition-all"
                      style={{ height: `${height}%` }}
                      title={`${day.date}: ${day.tokens.toLocaleString()} tokens, ${day.sessions} sessions`}
                    />
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(day.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" })}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* User Breakdown */}
      {stats && stats.uniqueUsers > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4" /> Usage by User
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(stats.userStats).map(([user, data]) => {
                const pct = stats.totalTokens > 0 ? Math.round((data.tokens / stats.totalTokens) * 100) : 0;
                return (
                  <div key={user} className="flex items-center gap-3 text-sm">
                    <span className="w-48 truncate font-mono text-xs">{user}</span>
                    <div className="flex-1 bg-accent rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-20 text-right">
                      {formatTokens(data.tokens)}
                    </span>
                    <span className="text-xs text-muted-foreground w-16 text-right">
                      {data.sessions} sess
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Connected MCP Tools */}
      {allTools && allTools.totalTools > 0 && (
        <ConnectedToolsOverview allTools={allTools} />
      )}

      {/* Search & Filter */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search sessions or users..."
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
          <option value="running">Running</option>
          <option value="finished">Finished</option>
          <option value="blocked">Blocked</option>
          <option value="failed">Failed</option>
        </select>
        <span className="text-sm text-muted-foreground">
          {filteredSessions.length} of {sessions.length} sessions
        </span>
      </div>

      {/* Sessions List */}
      {loading ? (
        <p className="text-center text-muted-foreground py-12">Loading...</p>
      ) : filteredSessions.length === 0 ? (
        <div className="text-center py-12">
          <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">
            {sessions.length === 0
              ? 'No Devin sessions discovered yet. Click "Discover Sessions" above to get started.'
              : "No sessions match your search."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredSessions.map((session) => (
            <Card
              key={session.id}
              className="cursor-pointer hover:border-emerald-500/50 transition-colors"
              onClick={() => setSelectedSession(session)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Bot className="h-5 w-5 text-emerald-500 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-sm truncate">{session.title}</h3>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{session.created_by}</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {timeAgo(session.started_at)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Timer className="h-3 w-3" />
                          {formatDuration(session.duration_seconds)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-bold">{formatTokens(session.token_usage)}</p>
                      <p className="text-[10px] text-muted-foreground">tokens</p>
                    </div>
                    <StatusBadge status={session.status} />
                    <div className="flex items-center gap-1">
                      {session.session_url && (
                        <a
                          href={session.session_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                          title="Open in Devin"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                      <button
                        className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="Remove"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(session.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
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

// ─── Session Detail ──────────────────────────────────────────────────────────

function SessionDetail({
  session,
  onBack,
}: {
  session: DevinSession;
  onBack: () => void;
}) {
  const promptPct = session.token_usage > 0
    ? Math.round((session.prompt_tokens / session.token_usage) * 100)
    : 0;
  const completionPct = 100 - promptPct;

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
              <Bot className="h-5 w-5 text-emerald-500" />
              {session.title}
            </h1>
            <p className="text-sm text-muted-foreground">
              Session {session.devin_session_id}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={session.status} />
          {session.session_url && (
            <a
              href={session.session_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="sm">
                <ExternalLink className="h-4 w-4 mr-1" /> Open in Devin
              </Button>
            </a>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card className="bg-emerald-500/5 border-emerald-500/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Zap className="h-3.5 w-3.5" /> Total Tokens
            </div>
            <p className="text-2xl font-bold">{session.token_usage.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-500/5 border-blue-500/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Activity className="h-3.5 w-3.5" /> Prompt Tokens
            </div>
            <p className="text-2xl font-bold">{session.prompt_tokens.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-purple-500/5 border-purple-500/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Activity className="h-3.5 w-3.5" /> Completion Tokens
            </div>
            <p className="text-2xl font-bold">{session.completion_tokens.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Timer className="h-3.5 w-3.5" /> Duration
            </div>
            <p className="text-2xl font-bold">{formatDuration(session.duration_seconds)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Token Breakdown */}
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Token Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 bg-accent rounded-full h-4 overflow-hidden flex">
              <div
                className="bg-blue-500 h-full transition-all"
                style={{ width: `${promptPct}%` }}
                title={`Prompt: ${promptPct}%`}
              />
              <div
                className="bg-purple-500 h-full transition-all"
                style={{ width: `${completionPct}%` }}
                title={`Completion: ${completionPct}%`}
              />
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              Prompt ({promptPct}%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
              Completion ({completionPct}%)
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Connected MCP Tools for this session */}
      <SessionToolsSection sessionId={session.id} />

      {/* Session Info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Session Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <InfoRow label="Session ID" value={session.devin_session_id}>
              <CopyBtn text={session.devin_session_id} />
            </InfoRow>
            <InfoRow label="Created By" value={session.created_by} />
            <InfoRow label="Model" value={session.model} />
            <InfoRow label="Status" value={session.status} />
            <InfoRow
              label="Started"
              value={new Date(session.started_at).toLocaleString()}
            />
            <InfoRow
              label="Finished"
              value={session.finished_at ? new Date(session.finished_at).toLocaleString() : "In progress..."}
            />
            {session.session_url && (
              <InfoRow label="URL" value={session.session_url}>
                <CopyBtn text={session.session_url} />
              </InfoRow>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Connected Tools Overview (Main Page) ───────────────────────────────────

function ConnectedToolsOverview({ allTools }: { allTools: DevinAllTools }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="mb-6 border-cyan-500/20">
      <CardHeader className="pb-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Plug className="h-4 w-4 text-cyan-500" />
            Connected MCP Tools
            <span className="text-xs font-normal text-muted-foreground">
              {allTools.totalTools} tools across {allTools.totalServers} servers
            </span>
          </span>
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </CardTitle>
      </CardHeader>
      {expanded && (
        <CardContent>
          {/* MCP Servers */}
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Server className="h-3.5 w-3.5" /> MCP Servers
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {allTools.mcpServers.map((server) => (
                <div
                  key={server.url}
                  className="flex items-center justify-between p-2.5 rounded-md bg-accent/50 border border-border/50"
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${server.status === 'connected' ? 'bg-emerald-500' : 'bg-gray-500'}`} />
                    <div>
                      <p className="text-sm font-medium">{server.name}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{server.protocol}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium">{server.toolCount} tools</p>
                    <p className="text-[10px] text-muted-foreground">{server.sessionCount} sessions</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tools Grid */}
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Wrench className="h-3.5 w-3.5" /> Tools
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {allTools.tools.map((tool) => (
              <ToolCard key={tool.name} tool={tool} showSessionCount />
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ─── Session Tools Section (Detail View) ─────────────────────────────────────

function SessionToolsSection({ sessionId }: { sessionId: string }) {
  const [sessionTools, setSessionTools] = useState<DevinSessionTools | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    devinAgentsApi.getSessionTools(sessionId)
      .then(setSessionTools)
      .catch(() => setSessionTools(null))
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) {
    return (
      <Card className="mb-6">
        <CardContent className="p-4 text-center text-muted-foreground text-sm">Loading tools...</CardContent>
      </Card>
    );
  }

  if (!sessionTools || sessionTools.tools.length === 0) return null;

  return (
    <Card className="mb-6 border-cyan-500/20">
      <CardHeader className="pb-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Plug className="h-4 w-4 text-cyan-500" />
            Connected MCP Tools
            <span className="text-xs font-normal text-muted-foreground">
              {sessionTools.tools.length} tools · {sessionTools.mcpServers.length} servers
            </span>
          </span>
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </CardTitle>
      </CardHeader>
      {expanded && (
        <CardContent>
          {/* MCP Servers */}
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Server className="h-3.5 w-3.5" /> MCP Servers
            </h4>
            <div className="space-y-1.5">
              {sessionTools.mcpServers.map((server) => (
                <div
                  key={server.url}
                  className="flex items-center justify-between p-2 rounded-md bg-accent/50 border border-border/50"
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${server.status === 'connected' ? 'bg-emerald-500' : 'bg-gray-500'}`} />
                    <span className="text-sm font-medium">{server.name}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">{server.protocol}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{server.toolCount} tools</span>
                </div>
              ))}
            </div>
          </div>

          {/* Tools */}
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Wrench className="h-3.5 w-3.5" /> Tools Used
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {sessionTools.tools.map((tool) => (
              <ToolCard key={tool.name} tool={tool} />
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ─── Tool Card ───────────────────────────────────────────────────────────────

function ToolCard({ tool, showSessionCount }: { tool: DevinTool; showSessionCount?: boolean }) {
  const [showSchema, setShowSchema] = useState(false);
  const categoryColors: Record<string, string> = {
    System: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    Testing: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    Database: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    'CI/CD': 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    Monitoring: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
    Security: 'bg-red-500/10 text-red-500 border-red-500/20',
  };

  return (
    <div className="p-2.5 rounded-md bg-accent/30 border border-border/50 hover:border-cyan-500/30 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Wrench className="h-3.5 w-3.5 text-cyan-500 shrink-0" />
            <span className="text-sm font-semibold font-mono truncate">{tool.name}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${categoryColors[tool.category] || 'bg-gray-500/10 text-gray-500 border-gray-500/20'}`}>
              {tool.category}
            </span>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">{tool.description}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs font-bold">{(tool.totalCalls || tool.callCount).toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground">calls</p>
          {showSessionCount && tool.sessionCount && (
            <p className="text-[10px] text-muted-foreground">{tool.sessionCount} sess</p>
          )}
        </div>
      </div>
      {tool.inputSchema?.properties && Object.keys(tool.inputSchema.properties).length > 0 && (
        <div className="mt-1.5">
          <button
            className="text-[10px] text-cyan-500 hover:text-cyan-400 flex items-center gap-1"
            onClick={() => setShowSchema(!showSchema)}
          >
            {showSchema ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {Object.keys(tool.inputSchema.properties).length} parameters
          </button>
          {showSchema && (
            <div className="mt-1.5 p-2 rounded bg-background/50 border border-border/30">
              {Object.entries(tool.inputSchema.properties).map(([key, val]) => {
                const prop = val as Record<string, unknown>;
                const isRequired = tool.inputSchema.required?.includes(key);
                return (
                  <div key={key} className="flex items-start gap-2 text-[10px] py-0.5">
                    <span className="font-mono text-cyan-400">{key}</span>
                    <span className="text-muted-foreground">{String(prop.type || 'any')}</span>
                    {isRequired && <span className="text-red-400">*</span>}
                    {prop.description && (
                      <span className="text-muted-foreground/70 truncate">— {String(prop.description)}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-xs">{value}</span>
        {children}
      </div>
    </div>
  );
}
