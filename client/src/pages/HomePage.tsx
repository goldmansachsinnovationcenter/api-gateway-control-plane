import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { dashboardApi } from "@/lib/api";
import type { DashboardData } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Cpu, Server, Globe, Package, Bot, Shield, Key, Users,
  Activity, AlertTriangle, ArrowRight, Clock, Zap,
  BarChart3, Cloud, FileText, RefreshCw, Layers,
} from "lucide-react";

function StatCard({ icon: Icon, label, value, color, link, sub }: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  color: string;
  link?: string;
  sub?: string;
}) {
  const content = (
    <div className="bg-secondary/50 rounded-lg p-4 hover:bg-secondary/70 transition-colors group">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${color}`} />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        {link && <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />}
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
  if (link) return <Link to={link}>{content}</Link>;
  return content;
}

function QuickAction({ icon: Icon, label, description, link, color }: {
  icon: React.ElementType;
  label: string;
  description: string;
  link: string;
  color: string;
}) {
  return (
    <Link to={link} className="flex items-center gap-3 p-3 bg-secondary/30 rounded-md hover:bg-secondary/50 transition-colors group">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-[10px] text-muted-foreground">{description}</p>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  );
}

export function HomePage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchData = async () => {
    setLoading(true);
    try {
      const result = await dashboardApi.getData();
      setData(result);
      setLastRefresh(new Date());
    } catch (err) {
      console.error("Failed to load dashboard:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const gatewayTypeLabels: Record<string, string> = {
    aws: "AWS API Gateway",
    azure: "Azure APIM",
    kong: "Kong",
    mulesoft: "MuleSoft",
    apigee: "Google Apigee",
    tyk: "Tyk",
    nginx: "NGINX",
    custom: "Custom",
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Cpu className="h-8 w-8 text-primary" />
            GSIC API Control Plane
          </h1>
          <p className="text-muted-foreground mt-2">
            Gateway management, MCP tool generation, agent orchestration & governance
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-muted-foreground">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </span>
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 rounded-md hover:bg-secondary transition-colors"
          >
            <RefreshCw className={`h-4 w-4 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading && !data && (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-6 gap-3">
            <StatCard icon={Server} label="Gateways" value={data.counts.gateways} color="text-blue-400" link="/gateways" />
            <StatCard icon={Globe} label="APIs" value={data.counts.apis} color="text-emerald-400" link="/apis" />
            <StatCard icon={Package} label="Products" value={data.counts.products} color="text-amber-400" link="/products" />
            <StatCard icon={Bot} label="Agents" value={data.agentStats.total + data.counts.cloudAgents} color="text-purple-400" link="/agent-hub" sub={`${data.agentStats.total} local, ${data.counts.cloudAgents} cloud`} />
            <StatCard icon={Shield} label="Policies" value={data.counts.policies} color="text-red-400" link="/governance/policies" />
            <StatCard icon={Users} label="Users" value={data.counts.users} color="text-cyan-400" link="/settings" />
          </div>

          <div className="grid grid-cols-3 gap-4">
            {/* Left Column — Platform Health */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    Platform Health
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* API Health */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-muted-foreground">API Security Score</span>
                        <span className="text-sm font-bold text-emerald-400">{data.apiHealth.avgSecurityScore}/100</span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-emerald-400 h-full rounded-full transition-all"
                          style={{ width: `${data.apiHealth.avgSecurityScore}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-muted-foreground">API Quality Score</span>
                        <span className="text-sm font-bold text-blue-400">{data.apiHealth.avgQualityScore}/100</span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-blue-400 h-full rounded-full transition-all"
                          style={{ width: `${data.apiHealth.avgQualityScore}%` }}
                        />
                      </div>
                    </div>

                    {/* Agent Health */}
                    <div className="pt-2 border-t border-border">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-muted-foreground">Agent Status</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="text-center p-2 bg-secondary/30 rounded">
                          <p className="text-lg font-bold text-emerald-400">{data.agentStats.enabled}</p>
                          <p className="text-[10px] text-muted-foreground">Enabled</p>
                        </div>
                        <div className="text-center p-2 bg-secondary/30 rounded">
                          <p className="text-lg font-bold text-blue-400">{data.agentStats.active}</p>
                          <p className="text-[10px] text-muted-foreground">Active</p>
                        </div>
                        <div className="text-center p-2 bg-secondary/30 rounded">
                          <p className={`text-lg font-bold ${data.agentStats.anomalies > 0 ? 'text-red-400' : 'text-gray-400'}`}>{data.agentStats.anomalies}</p>
                          <p className="text-[10px] text-muted-foreground">Anomalies</p>
                        </div>
                      </div>
                    </div>

                    {/* Violations */}
                    {data.counts.violations > 0 && (
                      <div className="flex items-center gap-2 p-2 bg-red-500/10 rounded-md border border-red-500/20">
                        <AlertTriangle className="h-4 w-4 text-red-400" />
                        <span className="text-xs text-red-400 font-medium">{data.counts.violations} policy violation{data.counts.violations !== 1 ? 's' : ''} detected</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Gateway Breakdown */}
              {data.gatewayTypes.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Layers className="h-4 w-4 text-primary" />
                      Gateway Providers
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {data.gatewayTypes.map(gt => (
                        <div key={gt.type} className="flex items-center justify-between p-2 bg-secondary/30 rounded">
                          <span className="text-xs font-medium">{gatewayTypeLabels[gt.type] || gt.type}</span>
                          <Badge variant="outline" className="text-[10px]">{gt.count}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Center Column — Quick Actions */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" />
                    Quick Actions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <QuickAction
                      icon={Server}
                      label="Register Gateway"
                      description="Connect AWS, Azure, Kong, or other API gateways"
                                            link="/gateways"
                                            color="bg-blue-500"
                    />
                    <QuickAction
                      icon={Globe}
                      label="Browse APIs"
                      description="View and manage discovered API endpoints"
                      link="/apis"
                      color="bg-emerald-500"
                    />
                    <QuickAction
                      icon={Cpu}
                      label="MCP & Tools"
                      description="Test MCP tools and connect to MCP servers"
                      link="/mcp"
                      color="bg-purple-500"
                    />
                    <QuickAction
                      icon={Bot}
                      label="Agent Hub"
                      description="View all agents across providers"
                      link="/agent-hub"
                      color="bg-amber-500"
                    />
                    <QuickAction
                      icon={Shield}
                      label="Governance"
                      description="Policies, risk assessment, and compliance"
                      link="/governance"
                      color="bg-red-500"
                    />
                    <QuickAction
                      icon={Key}
                      label="Settings"
                      description="Users, API keys, and configuration"
                      link="/settings"
                      color="bg-cyan-500"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Resource Summary */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    Resources
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center justify-between p-2 bg-secondary/30 rounded">
                      <span className="text-[10px] text-muted-foreground">Plans</span>
                      <span className="text-sm font-bold">{data.counts.plans}</span>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-secondary/30 rounded">
                      <span className="text-[10px] text-muted-foreground">API Keys</span>
                      <span className="text-sm font-bold">{data.counts.apiKeys}</span>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-secondary/30 rounded">
                      <span className="text-[10px] text-muted-foreground">Webhooks</span>
                      <span className="text-sm font-bold">{data.counts.webhooks}</span>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-secondary/30 rounded">
                      <span className="text-[10px] text-muted-foreground">Cloud Agents</span>
                      <span className="text-sm font-bold">{data.counts.cloudAgents}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column — Recent Activity */}
            <div className="space-y-4">
              {/* Recent Gateways */}
              {data.recent.gateways.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Server className="h-4 w-4 text-primary" />
                        Recent Gateways
                      </CardTitle>
                      <Link to="/gateways" className="text-[10px] text-primary hover:underline">View all</Link>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {data.recent.gateways.map((gw, i) => (
                        <div key={i} className="flex items-center justify-between p-2 bg-secondary/30 rounded">
                          <div className="flex items-center gap-2">
                            <Cloud className="h-3.5 w-3.5 text-blue-400" />
                            <div>
                              <p className="text-xs font-medium">{String(gw.name)}</p>
                              <p className="text-[10px] text-muted-foreground">{String(gw.type)}</p>
                            </div>
                          </div>
                          <Badge variant={gw.status === 'active' ? 'default' : 'outline'} className="text-[10px]">
                            {String(gw.status)}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Recent APIs */}
              {data.recent.apis.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Globe className="h-4 w-4 text-primary" />
                        Recent APIs
                      </CardTitle>
                      <Link to="/apis" className="text-[10px] text-primary hover:underline">View all</Link>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1.5">
                      {data.recent.apis.map((api, i) => (
                        <div key={i} className="flex items-center justify-between p-2 bg-secondary/20 rounded">
                          <div className="flex items-center gap-2 min-w-0">
                            <Badge variant="outline" className="text-[10px] shrink-0">{String(api.method)}</Badge>
                            <span className="text-xs truncate">{String(api.path)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Recent Audit */}
              {data.recent.audit.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        Recent Activity
                      </CardTitle>
                      <Link to="/settings" className="text-[10px] text-primary hover:underline">Audit log</Link>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1.5">
                      {data.recent.audit.map((entry, i) => (
                        <div key={i} className="flex items-center justify-between p-2 bg-secondary/20 rounded">
                          <div className="flex items-center gap-2">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs">{String(entry.action)}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {entry.created_at ? new Date(String(entry.created_at)).toLocaleTimeString() : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
