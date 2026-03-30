import { useState, useEffect, useCallback } from "react";
import { governanceApi } from "@/lib/api";
import type { RiskAssessment } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle, Shield, TrendingUp, CheckCircle, XCircle,
  Search, BarChart3, Activity,
} from "lucide-react";

const riskColors: Record<string, { text: string; bg: string; bar: string }> = {
  low: { text: "text-emerald-400", bg: "bg-emerald-500/20 border-emerald-500/30", bar: "bg-emerald-500" },
  medium: { text: "text-amber-400", bg: "bg-amber-500/20 border-amber-500/30", bar: "bg-amber-500" },
  high: { text: "text-red-400", bg: "bg-red-500/20 border-red-500/30", bar: "bg-red-500" },
};

const methodColors: Record<string, string> = {
  GET: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  POST: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  PUT: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  DELETE: "bg-red-500/20 text-red-400 border-red-500/30",
  PATCH: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

export function RiskDashboardPage() {
  const [risk, setRisk] = useState<RiskAssessment | null>(null);
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<string>("all");

  const fetchRisk = useCallback(async () => {
    try { setRisk(await governanceApi.getRiskAssessment()); } catch (err) { console.error(err); }
  }, []);

  useEffect(() => { fetchRisk(); }, [fetchRisk]);

  if (!risk) return <div className="flex items-center justify-center py-20 text-muted-foreground">Loading risk assessment...</div>;

  const filteredApis = (risk.apiRisks || []).filter(a => {
    if (search && !a.name.toLowerCase().includes(search.toLowerCase()) && !a.path.toLowerCase().includes(search.toLowerCase())) return false;
    if (riskFilter !== "all" && a.risk !== riskFilter) return false;
    return true;
  });

  const riskCfg = riskColors[risk.overallRisk] || riskColors.medium;
  const highCount = risk.apiRisks?.filter(a => a.risk === "high").length || 0;
  const mediumCount = risk.apiRisks?.filter(a => a.risk === "medium").length || 0;
  const lowCount = risk.apiRisks?.filter(a => a.risk === "low").length || 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            Risk Assessment
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Aggregate risk analysis across all APIs and gateways
          </p>
        </div>
      </div>

      {/* Overall Risk */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex items-center gap-8">
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-2">Overall Risk</p>
              <div className={"text-4xl font-bold " + riskCfg.text}>
                {risk.riskScore}%
              </div>
              <Badge variant="outline" className={"mt-2 " + riskCfg.bg}>
                {risk.overallRisk.toUpperCase()} RISK
              </Badge>
            </div>
            <div className="flex-1">
              <div className="h-4 rounded-full bg-muted overflow-hidden mb-3">
                <div className={"h-full rounded-full transition-all duration-700 " + riskCfg.bar} style={{ width: risk.riskScore + "%" }} />
              </div>
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Total APIs</p>
                  <p className="font-bold">{risk.totalApis}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Open Violations</p>
                  <p className="font-bold text-amber-400">{risk.openViolations}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Deprecated APIs</p>
                  <p className="font-bold">{risk.deprecatedApis}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Unclassified</p>
                  <p className="font-bold">{risk.unclassifiedApis}</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Risk Categories */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        {(risk.categories || []).map(cat => {
          const cfg = riskColors[cat.risk] || riskColors.medium;
          return (
            <Card key={cat.name}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{cat.name}</span>
                  <Badge variant="outline" className={"text-xs " + cfg.bg}>{cat.risk}</Badge>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden mb-2">
                  <div className={"h-full rounded-full " + cfg.bar} style={{ width: cat.score + "%" }} />
                </div>
                <div className="flex items-center justify-between">
                  <span className={"text-lg font-bold " + cfg.text}>{cat.score}%</span>
                  <span className="text-xs text-muted-foreground">{cat.details}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Risk Distribution */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="border-red-500/20">
          <CardContent className="p-4 flex items-center gap-3">
            <XCircle className="h-6 w-6 text-red-400" />
            <div>
              <p className="text-xs text-muted-foreground">High Risk</p>
              <p className="text-2xl font-bold text-red-400">{highCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-500/20">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-amber-400" />
            <div>
              <p className="text-xs text-muted-foreground">Medium Risk</p>
              <p className="text-2xl font-bold text-amber-400">{mediumCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-emerald-500/20">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="h-6 w-6 text-emerald-400" />
            <div>
              <p className="text-xs text-muted-foreground">Low Risk</p>
              <p className="text-2xl font-bold text-emerald-400">{lowCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* API Risk List */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search APIs..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-2">
          {["all", "high", "medium", "low"].map(level => (
            <button key={level} onClick={() => setRiskFilter(level)}
              className={"px-3 py-1.5 rounded-md text-sm transition-colors " +
                (riskFilter === level ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80")}
            >
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {filteredApis.map(api => {
          const cfg = riskColors[api.risk] || riskColors.medium;
          return (
            <Card key={api.id} className="hover:border-primary/20 transition-colors">
              <CardContent className="p-4 flex items-center gap-4">
                <div className={"flex flex-col items-center justify-center w-14 " + cfg.text}>
                  <span className="text-lg font-bold">{api.overall}%</span>
                  <Badge variant="outline" className={"text-[10px] " + cfg.bg}>{api.risk}</Badge>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={"inline-flex items-center justify-center rounded px-2 py-0.5 text-xs font-bold border min-w-[52px] " + (methodColors[api.method] || "bg-muted")}>
                      {api.method}
                    </span>
                    <h3 className="font-medium text-sm truncate">{api.name}</h3>
                    {api.gateway_name && <Badge variant="outline" className="text-xs">{api.gateway_name}</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">{api.path}</p>
                  {api.factors.length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {api.factors.map((f, i) => (
                        <Badge key={i} variant="outline" className="text-[10px] bg-red-500/10 text-red-400 border-red-500/20">
                          {f}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3 w-48 shrink-0">
                  <div className="flex-1">
                    <p className="text-[10px] text-muted-foreground mb-0.5">Security</p>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className={"h-full rounded-full " + (api.security_score >= 80 ? "bg-emerald-500" : api.security_score >= 60 ? "bg-amber-500" : "bg-red-500")}
                        style={{ width: api.security_score + "%" }} />
                    </div>
                    <p className="text-xs font-medium mt-0.5">{api.security_score}%</p>
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] text-muted-foreground mb-0.5">Quality</p>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className={"h-full rounded-full " + (api.quality_score >= 80 ? "bg-emerald-500" : api.quality_score >= 60 ? "bg-amber-500" : "bg-red-500")}
                        style={{ width: api.quality_score + "%" }} />
                    </div>
                    <p className="text-xs font-medium mt-0.5">{api.quality_score}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filteredApis.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <BarChart3 className="h-10 w-10 text-muted-foreground mb-2" />
              <p className="text-muted-foreground text-sm">
                {risk.totalApis === 0 ? "No APIs found. Register a gateway to start risk assessment." : "No APIs match your filter."}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
