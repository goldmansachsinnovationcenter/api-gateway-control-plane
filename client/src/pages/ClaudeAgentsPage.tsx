import { useState, useEffect, useCallback } from "react";
import { claudeAgentsApi } from "@/lib/api";
import type { ClaudeInvocation, ClaudeUsageStats } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  RefreshCw,
  Search,
  Trash2,
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
  DollarSign,
  Cpu,
  Tag,
  TrendingUp,
} from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    streaming: "bg-emerald-500",
    completed: "bg-blue-500",
    error: "bg-red-500",
  };
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
      <span className={`w-2 h-2 rounded-full ${colors[status] || "bg-gray-500"} ${status === "streaming" ? "animate-pulse" : ""}`} />
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

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

function formatTokens(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function formatCost(n: number): string {
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
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

const modelColors: Record<string, string> = {
  "Claude 3.5 Sonnet": "bg-violet-500/10 text-violet-400 border-violet-500/20",
  "Claude 3 Sonnet": "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "Claude 3 Haiku": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  "Claude 3 Opus": "bg-amber-500/10 text-amber-400 border-amber-500/20",
};

const categoryColors: Record<string, string> = {
  "Code Review": "bg-blue-500/10 text-blue-400",
  "Test Generation": "bg-emerald-500/10 text-emerald-400",
  "Summarization": "bg-purple-500/10 text-purple-400",
  "Debugging": "bg-red-500/10 text-red-400",
  "Documentation": "bg-cyan-500/10 text-cyan-400",
  "Security Analysis": "bg-orange-500/10 text-orange-400",
  "Refactoring": "bg-indigo-500/10 text-indigo-400",
  "Database": "bg-amber-500/10 text-amber-400",
  "Performance": "bg-pink-500/10 text-pink-400",
};

// ─── Main Page ───────────────────────────────────────────────────────────────

export function ClaudeAgentsPage() {
  const [invocations, setInvocations] = useState<ClaudeInvocation[]>([]);
  const [stats, setStats] = useState<ClaudeUsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [selectedInv, setSelectedInv] = useState<ClaudeInvocation | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modelFilter, setModelFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const [region, setRegion] = useState("us-east-1");

  const fetchAll = useCallback(async () => {
    try {
      const [inv, st] = await Promise.all([
        claudeAgentsApi.list(),
        claudeAgentsApi.stats(),
      ]);
      setInvocations(inv);
      setStats(st);
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
      const creds = accessKeyId ? { accessKeyId, secretAccessKey, region } : undefined;
      await claudeAgentsApi.discover(creds);
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Discovery failed");
    } finally {
      setDiscovering(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await claudeAgentsApi.delete(id);
      if (selectedInv?.id === id) setSelectedInv(null);
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const models = [...new Set(invocations.map(i => i.model_short_name || i.model))];

  const filteredInvocations = invocations.filter((i) => {
    const matchesSearch =
      !search ||
      i.title.toLowerCase().includes(search.toLowerCase()) ||
      i.user_email?.toLowerCase().includes(search.toLowerCase()) ||
      i.category?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || i.status === statusFilter;
    const matchesModel = modelFilter === "all" || (i.model_short_name || i.model) === modelFilter;
    return matchesSearch && matchesStatus && matchesModel;
  });

  if (selectedInv) {
    return (
      <InvocationDetail
        invocation={selectedInv}
        onBack={() => {
          setSelectedInv(null);
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
            <Cpu className="h-6 w-6 text-violet-500" />
            Claude (Bedrock)
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Monitor Claude model invocations, token usage, costs, and user activity via AWS Bedrock
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
          {error}
          <button className="ml-2 underline" onClick={() => setError(null)}>dismiss</button>
        </div>
      )}

      {/* Discovery Section */}
      <Card className="mb-6 border-violet-500/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Cpu className="h-4 w-4 text-violet-500" />
            Connect to AWS Bedrock
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            Provide AWS credentials to discover real Claude invocations, or leave empty for demo data.
          </p>
          <div className="flex gap-3 items-end flex-wrap">
            <div className="flex-1 min-w-[200px] max-w-[220px]">
              <label className="text-xs text-muted-foreground block mb-1">Access Key ID</label>
              <Input
                type="password"
                placeholder="Optional"
                value={accessKeyId}
                onChange={(e) => setAccessKeyId(e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="flex-1 min-w-[200px] max-w-[220px]">
              <label className="text-xs text-muted-foreground block mb-1">Secret Access Key</label>
              <Input
                type="password"
                placeholder="Optional"
                value={secretAccessKey}
                onChange={(e) => setSecretAccessKey(e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="w-[120px]">
              <label className="text-xs text-muted-foreground block mb-1">Region</label>
              <Input
                placeholder="us-east-1"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="text-sm"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={discovering}
              onClick={handleDiscover}
              className="border-violet-500/30 hover:border-violet-500 hover:bg-violet-500/5"
            >
              {discovering ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Cpu className="h-4 w-4 mr-2 text-violet-500" />
              )}
              Discover Invocations
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Dashboard */}
      {stats && stats.totalInvocations > 0 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <Card className="bg-violet-500/5 border-violet-500/20">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <Hash className="h-3.5 w-3.5" /> Invocations
                </div>
                <p className="text-2xl font-bold">{stats.totalInvocations}</p>
              </CardContent>
            </Card>
            <Card className="bg-blue-500/5 border-blue-500/20">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <Zap className="h-3.5 w-3.5" /> Total Tokens
                </div>
                <p className="text-2xl font-bold">{formatTokens(stats.totalTokens)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {formatTokens(stats.totalPromptTokens)} in / {formatTokens(stats.totalCompletionTokens)} out
                </p>
              </CardContent>
            </Card>
            <Card className="bg-emerald-500/5 border-emerald-500/20">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <DollarSign className="h-3.5 w-3.5" /> Est. Cost
                </div>
                <p className="text-2xl font-bold">{formatCost(stats.totalCost)}</p>
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
                  <Timer className="h-3.5 w-3.5" /> Avg Latency
                </div>
                <p className="text-2xl font-bold">{formatDuration(stats.avgDurationMs)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Model Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Cpu className="h-4 w-4" /> Usage by Model
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(stats.modelStats).map(([model, data]) => {
                    const pct = stats.totalTokens > 0 ? Math.round((data.tokens / stats.totalTokens) * 100) : 0;
                    return (
                      <div key={model}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded border ${modelColors[model] || "bg-gray-500/10 text-gray-400 border-gray-500/20"}`}>
                            {model}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {data.invocations} calls &middot; {formatTokens(data.tokens)} tokens &middot; {formatCost(data.cost)}
                          </span>
                        </div>
                        <div className="flex-1 bg-accent rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-violet-500 h-full rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Tag className="h-4 w-4" /> Usage by Category
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(stats.categoryStats).map(([cat, data]) => (
                    <div key={cat} className="flex items-center justify-between text-sm py-1 border-b border-border/30 last:border-0">
                      <span className={`text-xs px-2 py-0.5 rounded ${categoryColors[cat] || "bg-gray-500/10 text-gray-400"}`}>
                        {cat}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {data.invocations} calls &middot; {formatTokens(data.tokens)} &middot; {formatCost(data.cost)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Daily Usage Chart */}
          {stats.dailyUsage && stats.dailyUsage.some(d => d.tokens > 0) && (
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
                          className="w-full bg-violet-500/60 rounded-t transition-all"
                          style={{ height: `${height}%` }}
                          title={`${day.date}: ${day.tokens.toLocaleString()} tokens, ${day.invocations} invocations, ${formatCost(day.cost)}`}
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
                          className="bg-violet-500 h-full rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-16 text-right">
                        {formatTokens(data.tokens)}
                      </span>
                      <span className="text-xs text-muted-foreground w-16 text-right">
                        {formatCost(data.cost)}
                      </span>
                      <span className="text-xs text-muted-foreground w-14 text-right">
                        {data.invocations} calls
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Search & Filter */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search invocations, users, categories..."
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
          <option value="streaming">Streaming</option>
          <option value="completed">Completed</option>
          <option value="error">Error</option>
        </select>
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={modelFilter}
          onChange={(e) => setModelFilter(e.target.value)}
        >
          <option value="all">All Models</option>
          {models.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <span className="text-sm text-muted-foreground">
          {filteredInvocations.length} of {invocations.length} invocations
        </span>
      </div>

      {/* Invocations List */}
      {loading ? (
        <p className="text-center text-muted-foreground py-12">Loading...</p>
      ) : filteredInvocations.length === 0 ? (
        <div className="text-center py-12">
          <Cpu className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">
            {invocations.length === 0
              ? 'No Claude invocations discovered yet. Click "Discover Invocations" above to get started.'
              : "No invocations match your search."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredInvocations.map((inv) => (
            <Card
              key={inv.id}
              className="cursor-pointer hover:border-violet-500/50 transition-colors"
              onClick={() => setSelectedInv(inv)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Cpu className="h-5 w-5 text-violet-500 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-sm truncate">{inv.title}</h3>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] border ${modelColors[inv.model_short_name] || "bg-gray-500/10 text-gray-400 border-gray-500/20"}`}>
                          {inv.model_short_name}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${categoryColors[inv.category] || "bg-gray-500/10 text-gray-400"}`}>
                          {inv.category}
                        </span>
                        <span>{inv.user_email}</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {timeAgo(inv.started_at)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-bold">{formatTokens(inv.total_tokens)}</p>
                      <p className="text-[10px] text-muted-foreground">{formatCost(inv.estimated_cost)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">{formatDuration(inv.duration_ms)}</p>
                    </div>
                    <StatusBadge status={inv.status} />
                    <button
                      className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      title="Remove"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(inv.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
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

// ─── Invocation Detail ───────────────────────────────────────────────────────

function InvocationDetail({
  invocation,
  onBack,
}: {
  invocation: ClaudeInvocation;
  onBack: () => void;
}) {
  const promptPct = invocation.total_tokens > 0
    ? Math.round((invocation.prompt_tokens / invocation.total_tokens) * 100)
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
              <Cpu className="h-5 w-5 text-violet-500" />
              {invocation.title}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs px-2 py-0.5 rounded border ${modelColors[invocation.model_short_name] || "bg-gray-500/10 text-gray-400 border-gray-500/20"}`}>
                {invocation.model_short_name}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded ${categoryColors[invocation.category] || "bg-gray-500/10 text-gray-400"}`}>
                {invocation.category}
              </span>
            </div>
          </div>
        </div>
        <StatusBadge status={invocation.status} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Card className="bg-violet-500/5 border-violet-500/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Zap className="h-3.5 w-3.5" /> Total Tokens
            </div>
            <p className="text-2xl font-bold">{invocation.total_tokens.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-500/5 border-blue-500/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Activity className="h-3.5 w-3.5" /> Prompt
            </div>
            <p className="text-2xl font-bold">{invocation.prompt_tokens.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-purple-500/5 border-purple-500/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Activity className="h-3.5 w-3.5" /> Completion
            </div>
            <p className="text-2xl font-bold">{invocation.completion_tokens.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-emerald-500/5 border-emerald-500/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <DollarSign className="h-3.5 w-3.5" /> Est. Cost
            </div>
            <p className="text-2xl font-bold">{formatCost(invocation.estimated_cost)}</p>
          </CardContent>
        </Card>
        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Timer className="h-3.5 w-3.5" /> Latency
            </div>
            <p className="text-2xl font-bold">{formatDuration(invocation.duration_ms)}</p>
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

      {/* Cost Breakdown */}
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Cost Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <InfoRow label="Estimated Total Cost" value={formatCost(invocation.estimated_cost)} />
            <InfoRow label="Model" value={invocation.model_short_name || invocation.model} />
            <InfoRow label="Input Cost (per 1K tokens)" value={getModelInputPrice(invocation.model)} />
            <InfoRow label="Output Cost (per 1K tokens)" value={getModelOutputPrice(invocation.model)} />
          </div>
        </CardContent>
      </Card>

      {/* Session Info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Invocation Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <InfoRow label="Invocation ID" value={invocation.invocation_id}>
              <CopyBtn text={invocation.invocation_id} />
            </InfoRow>
            <InfoRow label="User" value={invocation.user_email} />
            <InfoRow label="Category" value={invocation.category} />
            <InfoRow label="Model" value={invocation.model}>
              <CopyBtn text={invocation.model} />
            </InfoRow>
            <InfoRow label="Region" value={invocation.region} />
            <InfoRow label="Status" value={invocation.status} />
            <InfoRow
              label="Started"
              value={new Date(invocation.started_at).toLocaleString()}
            />
            <InfoRow
              label="Finished"
              value={invocation.finished_at ? new Date(invocation.finished_at).toLocaleString() : "In progress..."}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function getModelInputPrice(modelId: string): string {
  if (modelId.includes('claude-3-5-sonnet') || modelId.includes('claude-3-sonnet')) return '$0.003';
  if (modelId.includes('claude-3-haiku')) return '$0.00025';
  if (modelId.includes('claude-3-opus')) return '$0.015';
  return '$0.003';
}

function getModelOutputPrice(modelId: string): string {
  if (modelId.includes('claude-3-5-sonnet') || modelId.includes('claude-3-sonnet')) return '$0.015';
  if (modelId.includes('claude-3-haiku')) return '$0.00125';
  if (modelId.includes('claude-3-opus')) return '$0.075';
  return '$0.015';
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
