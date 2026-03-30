import { useState, useEffect, useCallback } from "react";
import { agentsApi } from "@/lib/api";
import type { AgentGovernanceSummary, AgentAnomaly } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Shield, Bot, AlertTriangle, CheckCircle, XCircle,
  Power, PowerOff, Activity, Timer, TrendingUp,
  RefreshCw, Eye, ChevronDown, ChevronRight,
} from "lucide-react";

function HealthBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; label: string }> = {
    healthy: { color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30", label: "Healthy" },
    degraded: { color: "bg-amber-500/10 text-amber-400 border-amber-500/30", label: "Degraded" },
    warning: { color: "bg-orange-500/10 text-orange-400 border-orange-500/30", label: "Warning" },
    critical: { color: "bg-red-500/10 text-red-400 border-red-500/30", label: "Critical" },
    disabled: { color: "bg-gray-500/10 text-gray-400 border-gray-500/30", label: "Disabled" },
  };
  const c = config[status] || config.healthy;
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${c.color}`}>{c.label}</span>;
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: "bg-red-500/10 text-red-400",
    high: "bg-orange-500/10 text-orange-400",
    medium: "bg-amber-500/10 text-amber-400",
    low: "bg-blue-500/10 text-blue-400",
  };
  return <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${colors[severity] || colors.medium}`}>{severity}</span>;
}

export function AgentGovernanceDashboard() {
  const [summary, setSummary] = useState<AgentGovernanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());
  const [resolvingAnomaly, setResolvingAnomaly] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    try {
      setLoading(true);
      const data = await agentsApi.governanceSummary();
      setSummary(data);
    } catch (err) {
      console.error("Failed to fetch governance summary:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const toggleExpand = (id: string) => {
    setExpandedAgents(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleAgent = async (agentId: string, currentEnabled: boolean) => {
    try {
      if (currentEnabled) {
        await agentsApi.disable(agentId);
      } else {
        await agentsApi.enable(agentId);
      }
      await fetchSummary();
    } catch (err) {
      console.error("Failed to toggle agent:", err);
    }
  };

  const handleResolveAnomaly = async (anomalyId: string) => {
    try {
      setResolvingAnomaly(anomalyId);
      await agentsApi.resolveAnomaly(anomalyId);
      await fetchSummary();
    } catch (err) {
      console.error("Failed to resolve anomaly:", err);
    } finally {
      setResolvingAnomaly(null);
    }
  };

  const handleResolveAll = async (agentId: string) => {
    try {
      await agentsApi.resolveAllAnomalies(agentId);
      await fetchSummary();
    } catch (err) {
      console.error("Failed to resolve all anomalies:", err);
    }
  };

  const handleCheckAnomalies = async (agentId: string) => {
    try {
      await agentsApi.checkAnomalies(agentId);
      await fetchSummary();
    } catch (err) {
      console.error("Failed to check anomalies:", err);
    }
  };

  if (loading && !summary) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!summary) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Shield className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Unable to load governance data</h3>
          <Button onClick={fetchSummary}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  const healthyCount = summary.agentHealthStatuses.filter(a => a.healthStatus === 'healthy').length;
  const degradedCount = summary.agentHealthStatuses.filter(a => a.healthStatus === 'degraded' || a.healthStatus === 'warning').length;
  const criticalCount = summary.agentHealthStatuses.filter(a => a.healthStatus === 'critical').length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Agent Governance Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor agent health, anomalies, and governance status across all agents
          </p>
        </div>
        <Button variant="outline" onClick={fetchSummary} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-6 gap-3 mb-6">
        <div className="bg-secondary/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Bot className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground">Total Agents</span>
          </div>
          <p className="text-2xl font-bold">{summary.totalAgents}</p>
        </div>
        <div className="bg-secondary/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Power className="h-4 w-4 text-emerald-400" />
            <span className="text-xs text-muted-foreground">Enabled</span>
          </div>
          <p className="text-2xl font-bold text-emerald-400">{summary.enabledAgents}</p>
        </div>
        <div className="bg-secondary/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <PowerOff className="h-4 w-4 text-gray-400" />
            <span className="text-xs text-muted-foreground">Disabled</span>
          </div>
          <p className="text-2xl font-bold text-gray-400">{summary.disabledAgents}</p>
        </div>
        <div className="bg-secondary/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-4 w-4 text-emerald-400" />
            <span className="text-xs text-muted-foreground">Healthy</span>
          </div>
          <p className="text-2xl font-bold text-emerald-400">{healthyCount}</p>
        </div>
        <div className="bg-secondary/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <span className="text-xs text-muted-foreground">With Anomalies</span>
          </div>
          <p className="text-2xl font-bold text-amber-400">{summary.agentsWithAnomalies}</p>
        </div>
        <div className="bg-secondary/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="h-4 w-4 text-red-400" />
            <span className="text-xs text-muted-foreground">Critical</span>
          </div>
          <p className="text-2xl font-bold text-red-400">{summary.criticalAnomalies}</p>
        </div>
      </div>

      {/* Health Overview Bar */}
      {summary.totalAgents > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Health Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex rounded-full overflow-hidden h-4 bg-secondary">
              {healthyCount > 0 && (
                <div className="bg-emerald-500 transition-all" style={{ width: `${(healthyCount / summary.totalAgents) * 100}%` }} title={`${healthyCount} healthy`} />
              )}
              {degradedCount > 0 && (
                <div className="bg-amber-500 transition-all" style={{ width: `${(degradedCount / summary.totalAgents) * 100}%` }} title={`${degradedCount} degraded/warning`} />
              )}
              {criticalCount > 0 && (
                <div className="bg-red-500 transition-all" style={{ width: `${(criticalCount / summary.totalAgents) * 100}%` }} title={`${criticalCount} critical`} />
              )}
              {summary.disabledAgents > 0 && (
                <div className="bg-gray-500 transition-all" style={{ width: `${(summary.disabledAgents / summary.totalAgents) * 100}%` }} title={`${summary.disabledAgents} disabled`} />
              )}
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Healthy ({healthyCount})</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Degraded ({degradedCount})</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Critical ({criticalCount})</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-500" /> Disabled ({summary.disabledAgents})</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Agent Health Cards */}
      {summary.agentHealthStatuses.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Bot className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No agents found</h3>
            <p className="text-muted-foreground text-sm">Create agents to see their governance status here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {summary.agentHealthStatuses.map(agent => (
            <Card key={agent.id} className={`transition-colors ${agent.healthStatus === 'critical' ? 'border-red-500/30' : agent.healthStatus === 'warning' ? 'border-amber-500/30' : ''}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button onClick={() => toggleExpand(agent.id)} className="text-muted-foreground hover:text-foreground">
                      {expandedAgents.has(agent.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                    <Bot className="h-5 w-5 text-primary" />
                    <div>
                      <CardTitle className="text-base">{agent.name}</CardTitle>
                      <CardDescription className="text-xs mt-0.5">Model: {agent.model} | Status: {agent.status}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <HealthBadge status={agent.healthStatus} />
                    {agent.anomalyCount > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        {agent.anomalyCount} anomal{agent.anomalyCount === 1 ? 'y' : 'ies'}
                      </Badge>
                    )}
                    <div className="flex items-center gap-1">
                      {agent.hasGuardrails && (
                        <span className="text-xs text-muted-foreground flex items-center gap-0.5" title="Guardrails configured">
                          <Shield className="h-3 w-3 text-primary" />
                        </span>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleAgent(agent.id, agent.enabled)}
                      className={`h-7 text-xs ${agent.enabled ? 'text-emerald-400 hover:text-red-400' : 'text-red-400 hover:text-emerald-400'}`}
                    >
                      {agent.enabled ? <><Power className="h-3 w-3 mr-1" /> Enabled</> : <><PowerOff className="h-3 w-3 mr-1" /> Disabled</>}
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {/* Stats row */}
              <CardContent className="pb-3">
                <div className="grid grid-cols-5 gap-3 text-center">
                  <div className="bg-secondary/40 rounded-md p-2">
                    <Activity className="h-3 w-3 text-primary mx-auto mb-1" />
                    <p className="text-sm font-bold">{agent.logCount}</p>
                    <p className="text-[10px] text-muted-foreground">Total Calls</p>
                  </div>
                  <div className="bg-secondary/40 rounded-md p-2">
                    <TrendingUp className="h-3 w-3 text-emerald-400 mx-auto mb-1" />
                    <p className="text-sm font-bold">{agent.successRate}%</p>
                    <p className="text-[10px] text-muted-foreground">Success Rate</p>
                  </div>
                  <div className="bg-secondary/40 rounded-md p-2">
                    <Timer className="h-3 w-3 text-amber-400 mx-auto mb-1" />
                    <p className="text-sm font-bold">{agent.avgResponseMs}ms</p>
                    <p className="text-[10px] text-muted-foreground">Avg Latency</p>
                  </div>
                  <div className="bg-secondary/40 rounded-md p-2">
                    <AlertTriangle className="h-3 w-3 text-red-400 mx-auto mb-1" />
                    <p className="text-sm font-bold">{agent.anomalyCount}</p>
                    <p className="text-[10px] text-muted-foreground">Anomalies</p>
                  </div>
                  <div className="bg-secondary/40 rounded-md p-2">
                    <XCircle className="h-3 w-3 text-red-400 mx-auto mb-1" />
                    <p className="text-sm font-bold">{agent.criticalAnomalyCount}</p>
                    <p className="text-[10px] text-muted-foreground">Critical</p>
                  </div>
                </div>
              </CardContent>

              {/* Expanded section with anomalies */}
              {expandedAgents.has(agent.id) && (
                <CardContent className="pt-0">
                  <div className="border-t border-border pt-3">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Anomalies & Actions
                      </h4>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleCheckAnomalies(agent.id)}>
                          <Eye className="h-3 w-3 mr-1" />
                          Run Check
                        </Button>
                        {agent.anomalyCount > 0 && (
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleResolveAll(agent.id)}>
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Resolve All
                          </Button>
                        )}
                      </div>
                    </div>

                    {agent.anomalies.length > 0 ? (
                      <div className="space-y-2">
                        {agent.anomalies.map((anomaly: AgentAnomaly) => (
                          <div key={anomaly.id} className="flex items-center justify-between p-2.5 bg-secondary/30 rounded-md">
                            <div className="flex items-center gap-3">
                              <SeverityBadge severity={anomaly.severity} />
                              <div>
                                <span className="text-xs font-medium">{anomaly.anomaly_type.replace(/_/g, ' ')}</span>
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                  Value: {anomaly.metric_value.toFixed(1)} | Threshold: {anomaly.threshold_value.toFixed(1)}
                                  {anomaly.auto_action !== 'none' && <> | Auto-action: <span className="text-red-400">{anomaly.auto_action}</span></>}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(anomaly.created_at).toLocaleString()}
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 text-[10px] px-2"
                                onClick={() => handleResolveAnomaly(anomaly.id)}
                                disabled={resolvingAnomaly === anomaly.id}
                              >
                                {resolvingAnomaly === anomaly.id ? "..." : "Resolve"}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-muted-foreground text-xs">
                        <CheckCircle className="h-6 w-6 mx-auto mb-2 text-emerald-400" />
                        No active anomalies. Agent is operating normally.
                      </div>
                    )}

                    {/* Governance config summary */}
                    <div className="mt-3 pt-3 border-t border-border/50 grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-muted-foreground">Guardrails:</span>{" "}
                        <span className={agent.hasGuardrails ? "text-emerald-400" : "text-amber-400"}>
                          {agent.hasGuardrails ? "Configured" : "Not configured"}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Tool Permissions:</span>{" "}
                        <span className={agent.hasToolPermissions ? "text-emerald-400" : "text-amber-400"}>
                          {agent.hasToolPermissions ? "Configured" : "Not configured"}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Last Active:</span>{" "}
                        <span>{agent.lastActive ? new Date(agent.lastActive).toLocaleString() : "Never"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Success Rate:</span>{" "}
                        <span className={agent.successRate >= 80 ? "text-emerald-400" : agent.successRate >= 50 ? "text-amber-400" : "text-red-400"}>
                          {agent.successRate}%
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
