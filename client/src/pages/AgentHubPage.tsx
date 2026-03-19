import { useState, useEffect, useCallback } from "react";
import { agentHubApi } from "@/lib/api";
import type { AgentHubEntry, AgentHubSummary } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Bot, Cloud, Boxes, Search, Monitor, Activity,
  CheckCircle, XCircle, ChevronDown, ChevronUp,
  Zap, Clock, BarChart3, Globe, Server,
} from "lucide-react";

const typeConfig: Record<string, { label: string; icon: React.ElementType; color: string; badgeClass: string }> = {
  local: { label: "Local", icon: Monitor, color: "text-blue-400", badgeClass: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  bedrock: { label: "Bedrock", icon: Cloud, color: "text-purple-400", badgeClass: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  agentcore: { label: "AgentCore", icon: Boxes, color: "text-cyan-400", badgeClass: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
};

const statusConfig: Record<string, { color: string; dotClass: string; label: string }> = {
  idle: { color: "text-emerald-400", dotClass: "bg-emerald-500", label: "Idle" },
  running: { color: "text-amber-400", dotClass: "bg-amber-500 animate-pulse", label: "Running" },
  error: { color: "text-red-400", dotClass: "bg-red-500", label: "Error" },
  PREPARED: { color: "text-emerald-400", dotClass: "bg-emerald-500", label: "Prepared" },
  NOT_PREPARED: { color: "text-amber-400", dotClass: "bg-amber-500", label: "Not Prepared" },
  READY: { color: "text-emerald-400", dotClass: "bg-emerald-500", label: "Ready" },
  CREATING: { color: "text-amber-400", dotClass: "bg-amber-500 animate-pulse", label: "Creating" },
  UPDATING: { color: "text-blue-400", dotClass: "bg-blue-500 animate-pulse", label: "Updating" },
  FAILED: { color: "text-red-400", dotClass: "bg-red-500", label: "Failed" },
  UNKNOWN: { color: "text-muted-foreground", dotClass: "bg-muted-foreground", label: "Unknown" },
};

function getStatusCfg(status: string) {
  return statusConfig[status] || statusConfig.UNKNOWN;
}

export function AgentHubPage() {
  const [agents, setAgents] = useState<AgentHubEntry[]>([]);
  const [summary, setSummary] = useState<AgentHubSummary | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<string>("name");

  const fetchData = useCallback(async () => {
    try {
      const data = await agentHubApi.getAll();
      setAgents(data.agents);
      setSummary(data.summary);
    } catch (err) {
      console.error("Failed to fetch agent hub:", err);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = agents.filter(a => {
    if (search) {
      const q = search.toLowerCase();
      if (!a.name.toLowerCase().includes(q) && !a.description.toLowerCase().includes(q) && !a.provider.toLowerCase().includes(q)) return false;
    }
    if (typeFilter !== "all" && a.type !== typeFilter) return false;
    if (statusFilter === "active" && !a.enabled) return false;
    if (statusFilter === "inactive" && a.enabled) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "name") return a.name.localeCompare(b.name);
    if (sortBy === "calls") return b.totalCalls - a.totalCalls;
    if (sortBy === "success") return b.successRate - a.successRate;
    if (sortBy === "recent") return (b.lastActive || "").localeCompare(a.lastActive || "");
    return 0;
  });

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            Agent Hub
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Unified view of all agents across local, Bedrock, and AgentCore
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Bot className="h-6 w-6 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Total Agents</p>
                <p className="text-2xl font-bold">{summary.total}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-emerald-500/20">
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle className="h-6 w-6 text-emerald-400" />
              <div>
                <p className="text-xs text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-emerald-400">{summary.active}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Activity className="h-6 w-6 text-blue-400" />
              <div>
                <p className="text-xs text-muted-foreground">Total Calls</p>
                <p className="text-2xl font-bold">{summary.totalCalls}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <BarChart3 className="h-6 w-6 text-amber-400" />
              <div>
                <p className="text-xs text-muted-foreground">Avg Success Rate</p>
                <p className="text-2xl font-bold">{summary.avgSuccessRate}%</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Provider Breakdown */}
      {summary && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {(["local", "bedrock", "agentcore"] as const).map(type => {
            const cfg = typeConfig[type];
            const Icon = cfg.icon;
            const count = summary.providers[type];
            return (
              <Card key={type} className="cursor-pointer hover:border-primary/30 transition-colors"
                onClick={() => setTypeFilter(typeFilter === type ? "all" : type)}>
                <CardContent className="p-4 flex items-center gap-3">
                  <Icon className={"h-5 w-5 " + cfg.color} />
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">{cfg.label} Agents</p>
                    <p className="text-xl font-bold">{count}</p>
                  </div>
                  {typeFilter === type && (
                    <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">Filtered</Badge>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Search / Filter / Sort */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search agents..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-2">
          {[
            { value: "all", label: "All Types" },
            { value: "local", label: "Local" },
            { value: "bedrock", label: "Bedrock" },
            { value: "agentcore", label: "AgentCore" },
          ].map(opt => (
            <button key={opt.value} onClick={() => setTypeFilter(opt.value)}
              className={"px-3 py-1.5 rounded-md text-xs transition-colors " +
                (typeFilter === opt.value ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80")}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {[
            { value: "all", label: "All Status" },
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
          ].map(opt => (
            <button key={opt.value} onClick={() => setStatusFilter(opt.value)}
              className={"px-3 py-1.5 rounded-md text-xs transition-colors " +
                (statusFilter === opt.value ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80")}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          className="px-3 py-1.5 rounded-md text-xs bg-secondary text-secondary-foreground border border-border"
        >
          <option value="name">Sort: Name</option>
          <option value="calls">Sort: Most Calls</option>
          <option value="success">Sort: Success Rate</option>
          <option value="recent">Sort: Recently Active</option>
        </select>
      </div>

      {/* Agent List */}
      <div className="space-y-2">
        {sorted.map(agent => {
          const typeCfg = typeConfig[agent.type] || typeConfig.local;
          const TypeIcon = typeCfg.icon;
          const statusCfg = getStatusCfg(agent.status);
          const isExpanded = expandedId === agent.id;

          return (
            <Card key={agent.id} className="hover:border-primary/20 transition-colors">
              <CardContent className="p-0">
                {/* Main Row */}
                <button
                  className="w-full flex items-center gap-4 p-4 text-left"
                  onClick={() => setExpandedId(isExpanded ? null : agent.id)}
                >
                  {/* Status Dot + Type Icon */}
                  <div className="relative">
                    <TypeIcon className={"h-8 w-8 p-1.5 rounded-lg border " + typeCfg.badgeClass} />
                    <span className={"absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card " + statusCfg.dotClass} />
                  </div>

                  {/* Name & Description */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-sm truncate">{agent.name}</h3>
                      <Badge variant="outline" className={"text-[10px] " + typeCfg.badgeClass}>{typeCfg.label}</Badge>
                      {agent.region && (
                        <Badge variant="outline" className="text-[10px]">
                          <Globe className="h-2.5 w-2.5 mr-1" />{agent.region}
                        </Badge>
                      )}
                      {!agent.enabled && (
                        <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-400 border-red-500/20">Disabled</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{agent.description || "No description"}</p>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-6 shrink-0">
                    <div className="text-center">
                      <p className="text-[10px] text-muted-foreground">Calls</p>
                      <p className="text-sm font-bold">{agent.totalCalls}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-muted-foreground">Success</p>
                      <p className={"text-sm font-bold " + (agent.successRate >= 80 ? "text-emerald-400" : agent.successRate >= 50 ? "text-amber-400" : agent.totalCalls === 0 ? "text-muted-foreground" : "text-red-400")}>
                        {agent.totalCalls > 0 ? agent.successRate + "%" : "—"}
                      </p>
                    </div>
                    {agent.avgResponseMs > 0 && (
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground">Avg ms</p>
                        <p className="text-sm font-bold">{agent.avgResponseMs}</p>
                      </div>
                    )}
                    <div className="text-center">
                      <p className="text-[10px] text-muted-foreground">Model</p>
                      <p className="text-xs font-medium truncate max-w-[120px]" title={agent.model}>{agent.model}</p>
                    </div>
                  </div>

                  {/* Expand/Collapse */}
                  {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                </button>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div className="border-t border-border px-4 pb-4 pt-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Info Card */}
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Server className="h-4 w-4" /> Agent Details
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">ID</span>
                            <span className="font-mono text-[11px]">{agent.id.substring(0, 16)}...</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Provider</span>
                            <span>{agent.provider}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Status</span>
                            <span className={"flex items-center gap-1.5 " + statusCfg.color}>
                              <span className={"h-1.5 w-1.5 rounded-full " + statusCfg.dotClass} />
                              {statusCfg.label}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Model</span>
                            <span className="truncate max-w-[200px]" title={agent.model}>{agent.model}</span>
                          </div>
                          {agent.region && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Region</span>
                              <span>{agent.region}</span>
                            </div>
                          )}
                          {agent.linkedProduct && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Linked Product</span>
                              <span>{agent.linkedProduct}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Created</span>
                            <span>{new Date(agent.createdAt).toLocaleString()}</span>
                          </div>
                          {agent.lastActive && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Last Active</span>
                              <span>{new Date(agent.lastActive).toLocaleString()}</span>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Details Card */}
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            {agent.type === "local" ? <Monitor className="h-4 w-4" /> :
                             agent.type === "bedrock" ? <Cloud className="h-4 w-4" /> :
                             <Boxes className="h-4 w-4" />}
                            {agent.type === "local" ? "Local Config" :
                             agent.type === "bedrock" ? "Bedrock Config" :
                             "AgentCore Config"}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-xs">
                          {Object.entries(agent.details).map(([key, value]) => {
                            if (value === null || value === undefined || value === "") return null;
                            const label = key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase());
                            const displayValue = typeof value === "boolean" ? (value ? "Yes" : "No") : String(value);
                            return (
                              <div key={key} className="flex justify-between">
                                <span className="text-muted-foreground">{label}</span>
                                <span className="truncate max-w-[200px] text-right" title={displayValue}>{displayValue}</span>
                              </div>
                            );
                          })}
                          {Object.keys(agent.details).length === 0 && (
                            <p className="text-muted-foreground italic">No additional details</p>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    {/* Activity Summary Bar */}
                    <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Activity className="h-3 w-3" /> {agent.totalCalls} total calls</span>
                      <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3 text-emerald-400" /> {agent.successRate}% success</span>
                      {agent.avgResponseMs > 0 && (
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {agent.avgResponseMs}ms avg</span>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        {/* Empty State */}
        {sorted.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Bot className="h-10 w-10 text-muted-foreground mb-2" />
              <p className="text-muted-foreground text-sm">
                {agents.length === 0
                  ? "No agents found. Create local agents or discover cloud agents to get started."
                  : "No agents match your filters."}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
