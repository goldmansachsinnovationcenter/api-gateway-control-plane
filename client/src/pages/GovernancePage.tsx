import { useState, useEffect, useCallback } from "react";
import { apisApi, gatewaysApi, governanceApi } from "@/lib/api";
import type { Api, Gateway, RemediationSuggestion, DataClassification } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ScoreBar } from "@/components/ui/score-bar";
import { Backdrop } from "@/components/Backdrop";
import {
  Shield, Eye, Save, Search, Filter, AlertTriangle,
  CheckCircle, XCircle, TrendingUp, BarChart3, Globe,
  ArrowUpDown, ChevronDown, ChevronRight, Tag, Lightbulb,
  Lock, FileWarning,
} from "lucide-react";

function getScoreLevel(score: number): { label: string; color: string; icon: React.ElementType } {
  if (score >= 80) return { label: "Good", color: "text-emerald-400", icon: CheckCircle };
  if (score >= 60) return { label: "Fair", color: "text-amber-400", icon: AlertTriangle };
  return { label: "Poor", color: "text-red-400", icon: XCircle };
}

type SortField = "name" | "security" | "quality" | "overall";
type SortDir = "asc" | "desc";

const methodColors: Record<string, string> = {
  GET: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  POST: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  PUT: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  DELETE: "bg-red-500/20 text-red-400 border-red-500/30",
  PATCH: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

export function GovernancePage() {
  const [apis, setApis] = useState<Api[]>([]);
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [selectedGateway, setSelectedGateway] = useState<string>("");
  const [search, setSearch] = useState("");
  const [scoreFilter, setScoreFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("overall");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selectedApi, setSelectedApi] = useState<Api | null>(null);
  const [specEditorOpen, setSpecEditorOpen] = useState(false);
  const [specContent, setSpecContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [backdropMessage, setBackdropMessage] = useState("");
  const [expandedApi, setExpandedApi] = useState<string | null>(null);
  const [remediations, setRemediations] = useState<Record<string, RemediationSuggestion[]>>({});
  const [classifications, setClassifications] = useState<Record<string, DataClassification>>({});
  const [classifyApiId, setClassifyApiId] = useState<string | null>(null);
  const [classifyForm, setClassifyForm] = useState({ classification: "internal", piiFlag: false, financialFlag: false, notes: "" });

  const fetchApis = useCallback(async () => {
    try {
      const data = await apisApi.list(selectedGateway || undefined);
      setApis(data);
    } catch (err) {
      console.error("Failed to fetch APIs:", err);
    }
  }, [selectedGateway]);

  const fetchGateways = useCallback(async () => {
    try {
      const data = await gatewaysApi.list();
      setGateways(data);
    } catch (err) {
      console.error("Failed to fetch gateways:", err);
    }
  }, []);

  useEffect(() => {
    fetchGateways();
  }, [fetchGateways]);

  useEffect(() => {
    fetchApis();
  }, [fetchApis]);

  const fetchRemediations = useCallback(async (apiId: string) => {
    if (remediations[apiId]) return;
    try {
      const data = await governanceApi.getRemediations(apiId);
      setRemediations(prev => ({ ...prev, [apiId]: data }));
    } catch (err) { console.error(err); }
  }, [remediations]);

  const fetchClassification = useCallback(async (apiId: string) => {
    if (classifications[apiId]) return;
    try {
      const data = await governanceApi.getClassification(apiId);
      if (data) setClassifications(prev => ({ ...prev, [apiId]: data }));
    } catch (err) { console.error(err); }
  }, [classifications]);

  const handleExpandApi = (apiId: string) => {
    const isExpanding = expandedApi !== apiId;
    setExpandedApi(isExpanding ? apiId : null);
    if (isExpanding) {
      fetchRemediations(apiId);
      fetchClassification(apiId);
    }
  };

  const handleClassify = async () => {
    if (!classifyApiId) return;
    try {
      const data = await governanceApi.setClassification(classifyApiId, classifyForm);
      setClassifications(prev => ({ ...prev, [classifyApiId]: data }));
      setClassifyApiId(null);
      setClassifyForm({ classification: "internal", piiFlag: false, financialFlag: false, notes: "" });
    } catch (err) { console.error(err); }
  };

  const handleViewSpec = async (api: Api) => {
    try {
      const full = await apisApi.get(api.id);
      setSelectedApi(full);
      setSpecContent(JSON.stringify(full.spec, null, 2));
      setSpecEditorOpen(true);
    } catch (err) {
      console.error("Failed to fetch API spec:", err);
    }
  };

  const handleSaveSpec = async () => {
    if (!selectedApi) return;
    setSpecEditorOpen(false);
    setLoading(true);
    setBackdropMessage("Saving API specification...");

    try {
      const parsed = JSON.parse(specContent);
      await apisApi.updateSpec(selectedApi.id, parsed);
      await fetchApis();
    } catch (err) {
      console.error("Failed to save spec:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const filteredApis = apis
    .filter((api) => {
      if (search && !api.name.toLowerCase().includes(search.toLowerCase()) &&
          !api.path.toLowerCase().includes(search.toLowerCase())) return false;
      const overall = Math.round((api.security_score + api.quality_score) / 2);
      if (scoreFilter === "good" && overall < 80) return false;
      if (scoreFilter === "fair" && (overall < 60 || overall >= 80)) return false;
      if (scoreFilter === "poor" && overall >= 60) return false;
      return true;
    })
    .sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;
      switch (sortField) {
        case "name": aVal = a.name.toLowerCase(); bVal = b.name.toLowerCase(); break;
        case "security": aVal = a.security_score; bVal = b.security_score; break;
        case "quality": aVal = a.quality_score; bVal = b.quality_score; break;
        case "overall":
        default:
          aVal = (a.security_score + a.quality_score) / 2;
          bVal = (b.security_score + b.quality_score) / 2;
      }
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

  const totalApis = apis.length;
  const avgSecurity = totalApis > 0 ? Math.round(apis.reduce((s, a) => s + a.security_score, 0) / totalApis) : 0;
  const avgQuality = totalApis > 0 ? Math.round(apis.reduce((s, a) => s + a.quality_score, 0) / totalApis) : 0;
  const avgOverall = Math.round((avgSecurity + avgQuality) / 2);
  const goodCount = apis.filter(a => (a.security_score + a.quality_score) / 2 >= 80).length;
  const fairCount = apis.filter(a => { const o = (a.security_score + a.quality_score) / 2; return o >= 60 && o < 80; }).length;
  const poorCount = apis.filter(a => (a.security_score + a.quality_score) / 2 < 60).length;

  return (
    <div>
      <Backdrop open={loading} message={backdropMessage} />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            API Governance
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Monitor and improve API security and quality scores across all gateways
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Globe className="h-3.5 w-3.5" /> Total APIs
            </div>
            <p className="text-2xl font-bold">{totalApis}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Shield className="h-3.5 w-3.5" /> Avg Security
            </div>
            <p className={"text-2xl font-bold " + getScoreLevel(avgSecurity).color}>{avgSecurity}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <TrendingUp className="h-3.5 w-3.5" /> Avg Quality
            </div>
            <p className={"text-2xl font-bold " + getScoreLevel(avgQuality).color}>{avgQuality}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-400" /> Good
            </div>
            <p className="text-2xl font-bold text-emerald-400">{goodCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400" /> Fair
            </div>
            <p className="text-2xl font-bold text-amber-400">{fairCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <XCircle className="h-3.5 w-3.5 text-red-400" /> Poor
            </div>
            <p className="text-2xl font-bold text-red-400">{poorCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Overall Score Bar */}
      {totalApis > 0 && (
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center gap-6">
              <div className="flex-1">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="font-medium">Overall Governance Score</span>
                  <span className={"text-lg font-bold " + getScoreLevel(avgOverall).color}>{avgOverall}%</span>
                </div>
                <div className="h-3 rounded-full bg-muted overflow-hidden">
                  <div
                    className={"h-full rounded-full transition-all duration-700 " + (avgOverall >= 80 ? "bg-emerald-500" : avgOverall >= 60 ? "bg-amber-500" : "bg-red-500")}
                    style={{ width: avgOverall + "%" }}
                  />
                </div>
              </div>
              <div className="flex gap-4 text-sm">
                <div className="text-center">
                  <p className="text-muted-foreground text-xs">Security</p>
                  <p className={"font-bold " + getScoreLevel(avgSecurity).color}>{avgSecurity}%</p>
                </div>
                <div className="text-center">
                  <p className="text-muted-foreground text-xs">Quality</p>
                  <p className={"font-bold " + getScoreLevel(avgQuality).color}>{avgQuality}%</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gateway filter */}
      <div className="flex items-center gap-3 mb-4">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedGateway("")}
            className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
              selectedGateway === ""
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            All Gateways
          </button>
          {gateways.map((gw) => (
            <button
              key={gw.id}
              onClick={() => setSelectedGateway(gw.id)}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                selectedGateway === gw.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {gw.name}
            </button>
          ))}
        </div>
      </div>

      {/* Search & Score Filter */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search APIs by name or path..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={scoreFilter}
          onChange={(e) => setScoreFilter(e.target.value)}
        >
          <option value="all">All Scores</option>
          <option value="good">Good (80%+)</option>
          <option value="fair">Fair (60-79%)</option>
          <option value="poor">Poor (&lt;60%)</option>
        </select>
        <span className="text-sm text-muted-foreground">
          {filteredApis.length} of {apis.length} APIs
        </span>
      </div>

      {/* Sort Controls */}
      <div className="flex items-center gap-2 mb-4 text-xs">
        <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">Sort by:</span>
        {(["overall", "security", "quality", "name"] as SortField[]).map((field) => (
          <button
            key={field}
            onClick={() => handleSort(field)}
            className={"px-2.5 py-1 rounded text-xs transition-colors " + (
              sortField === field
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            )}
          >
            {field.charAt(0).toUpperCase() + field.slice(1)}
            {sortField === field && (sortDir === "asc" ? " \u2191" : " \u2193")}
          </button>
        ))}
      </div>

      {/* API List */}
      {filteredApis.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Shield className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              {apis.length === 0
                ? "No APIs found. Register a gateway first to discover APIs."
                : "No APIs match your filters."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredApis.map((api) => {
            const overall = Math.round((api.security_score + api.quality_score) / 2);
            const level = getScoreLevel(overall);
            const LevelIcon = level.icon;
            const isExpanded = expandedApi === api.id;

            return (
              <Card key={api.id} className="hover:border-primary/20 transition-colors">
                <CardContent className="p-0">
                  <button
                    className="w-full flex items-center gap-4 p-4 text-left"
                    onClick={() => handleExpandApi(api.id)}
                  >
                    <div className={"flex flex-col items-center justify-center w-14 " + level.color}>
                      <LevelIcon className="h-5 w-5 mb-0.5" />
                      <span className="text-xs font-bold">{overall}%</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={"inline-flex items-center justify-center rounded px-2 py-0.5 text-xs font-bold border min-w-[52px] " + (methodColors[api.method] || "bg-muted text-muted-foreground")}
                        >
                          {api.method}
                        </span>
                        <h3 className="font-medium text-sm truncate">{api.name}</h3>
                        {api.gateway_name && (
                          <Badge variant="outline" className="text-xs shrink-0">
                            {api.gateway_name}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">{api.path}</p>
                    </div>

                    <div className="flex items-center gap-4 w-64 shrink-0">
                      <ScoreBar score={api.security_score} label="Security" className="flex-1" />
                      <ScoreBar score={api.quality_score} label="Quality" className="flex-1" />
                    </div>

                    <div className="shrink-0">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-border px-4 py-4 bg-secondary/20">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div>
                          <span className="text-xs text-muted-foreground">Security Score</span>
                          <div className="flex items-center gap-2 mt-1">
                            <Shield className={"h-4 w-4 " + getScoreLevel(api.security_score).color} />
                            <span className={"text-lg font-bold " + getScoreLevel(api.security_score).color}>
                              {api.security_score}%
                            </span>
                            <span className={"text-xs " + getScoreLevel(api.security_score).color}>
                              {getScoreLevel(api.security_score).label}
                            </span>
                          </div>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Quality Score</span>
                          <div className="flex items-center gap-2 mt-1">
                            <BarChart3 className={"h-4 w-4 " + getScoreLevel(api.quality_score).color} />
                            <span className={"text-lg font-bold " + getScoreLevel(api.quality_score).color}>
                              {api.quality_score}%
                            </span>
                            <span className={"text-xs " + getScoreLevel(api.quality_score).color}>
                              {getScoreLevel(api.quality_score).label}
                            </span>
                          </div>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Gateway</span>
                          <p className="text-sm font-medium mt-1">{api.gateway_name || "Unknown"}</p>
                          <p className="text-xs text-muted-foreground">{api.gateway_type || "N/A"}</p>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Status</span>
                          <p className="text-sm font-medium mt-1">{api.status}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(api.updated_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Shield className="h-4 w-4" /> Security Analysis
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="text-xs space-y-2">
                            <div className="flex items-center justify-between">
                              <span>Authentication Required</span>
                              {api.security_score >= 70 ? (
                                <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5 text-red-400" />
                              )}
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Input Validation</span>
                              {api.security_score >= 60 ? (
                                <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                              ) : (
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                              )}
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Rate Limiting</span>
                              {api.security_score >= 80 ? (
                                <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5 text-red-400" />
                              )}
                            </div>
                            <div className="flex items-center justify-between">
                              <span>HTTPS Enforcement</span>
                              {api.security_score >= 50 ? (
                                <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5 text-red-400" />
                              )}
                            </div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <BarChart3 className="h-4 w-4" /> Quality Analysis
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="text-xs space-y-2">
                            <div className="flex items-center justify-between">
                              <span>API Description</span>
                              {api.quality_score >= 60 ? (
                                <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5 text-red-400" />
                              )}
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Request/Response Examples</span>
                              {api.quality_score >= 70 ? (
                                <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                              ) : (
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                              )}
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Error Responses Documented</span>
                              {api.quality_score >= 80 ? (
                                <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5 text-red-400" />
                              )}
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Schema Completeness</span>
                              {api.quality_score >= 50 ? (
                                <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5 text-red-400" />
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Data Classification */}
                      <Card className="mb-4">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Tag className="h-4 w-4" /> Data Classification
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          {classifications[api.id] ? (
                            <div className="flex items-center gap-3 flex-wrap">
                              <Badge variant="outline" className={"text-xs " + (
                                classifications[api.id].classification === "restricted" ? "bg-red-500/20 text-red-400 border-red-500/30" :
                                classifications[api.id].classification === "confidential" ? "bg-orange-500/20 text-orange-400 border-orange-500/30" :
                                classifications[api.id].classification === "internal" ? "bg-blue-500/20 text-blue-400 border-blue-500/30" :
                                "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                              )}>
                                {classifications[api.id].classification.toUpperCase()}
                              </Badge>
                              {classifications[api.id].pii_flag ? (
                                <Badge variant="outline" className="text-xs bg-red-500/10 text-red-400 border-red-500/20">
                                  <Lock className="h-3 w-3 mr-1" /> PII
                                </Badge>
                              ) : null}
                              {classifications[api.id].financial_flag ? (
                                <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-400 border-amber-500/20">
                                  <FileWarning className="h-3 w-3 mr-1" /> Financial
                                </Badge>
                              ) : null}
                              {classifications[api.id].notes && (
                                <span className="text-xs text-muted-foreground">{classifications[api.id].notes}</span>
                              )}
                              <Button variant="ghost" size="sm" className="text-xs" onClick={() => {
                                setClassifyApiId(api.id);
                                const c = classifications[api.id];
                                setClassifyForm({ classification: c.classification, piiFlag: !!c.pii_flag, financialFlag: !!c.financial_flag, notes: c.notes || "" });
                              }}>Edit</Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">Not classified</span>
                              <Button variant="outline" size="sm" className="text-xs" onClick={() => setClassifyApiId(api.id)}>
                                <Tag className="h-3 w-3 mr-1" /> Classify
                              </Button>
                            </div>
                          )}

                          {classifyApiId === api.id && (
                            <div className="mt-3 p-3 rounded border border-border bg-background space-y-2">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                <select className="h-8 rounded-md border border-input bg-background px-2 text-xs" value={classifyForm.classification} onChange={e => setClassifyForm(f => ({ ...f, classification: e.target.value }))}>
                                  <option value="public">Public</option>
                                  <option value="internal">Internal</option>
                                  <option value="confidential">Confidential</option>
                                  <option value="restricted">Restricted</option>
                                </select>
                                <label className="flex items-center gap-1.5 text-xs">
                                  <input type="checkbox" checked={classifyForm.piiFlag} onChange={e => setClassifyForm(f => ({ ...f, piiFlag: e.target.checked }))} />
                                  Contains PII
                                </label>
                                <label className="flex items-center gap-1.5 text-xs">
                                  <input type="checkbox" checked={classifyForm.financialFlag} onChange={e => setClassifyForm(f => ({ ...f, financialFlag: e.target.checked }))} />
                                  Financial Data
                                </label>
                                <Input placeholder="Notes" className="h-8 text-xs" value={classifyForm.notes} onChange={e => setClassifyForm(f => ({ ...f, notes: e.target.value }))} />
                              </div>
                              <div className="flex gap-2">
                                <Button size="sm" className="text-xs h-7" onClick={handleClassify}>Save</Button>
                                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setClassifyApiId(null)}>Cancel</Button>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Remediation Suggestions */}
                      {remediations[api.id] && remediations[api.id].length > 0 && (
                        <Card className="mb-4">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Lightbulb className="h-4 w-4 text-amber-400" /> Remediation Suggestions
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            {remediations[api.id].map((rem, idx) => (
                              <div key={idx} className="flex items-start gap-3 p-2 rounded border border-border">
                                <div className="shrink-0 mt-0.5">
                                  {rem.severity === "high" ? (
                                    <XCircle className="h-4 w-4 text-red-400" />
                                  ) : rem.severity === "medium" ? (
                                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                                  ) : (
                                    <CheckCircle className="h-4 w-4 text-blue-400" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium">{rem.title}</span>
                                    <Badge variant="outline" className={"text-[10px] " + (
                                      rem.category === "security" ? "bg-red-500/10 text-red-400 border-red-500/20" :
                                      rem.category === "quality" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                                      "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                    )}>{rem.category}</Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-0.5">{rem.description}</p>
                                  <p className="text-xs text-primary/80 mt-1">{rem.action}</p>
                                </div>
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      )}

                      <div className="flex justify-end">
                        <Button variant="outline" size="sm" onClick={() => handleViewSpec(api)}>
                          <Eye className="h-4 w-4 mr-1" />
                          View & Edit Spec
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={specEditorOpen}
        onClose={() => setSpecEditorOpen(false)}
        title={`API Specification - ${selectedApi?.name || ""}`}
        className="max-w-3xl"
      >
        <div className="space-y-4">
          {selectedApi && (
            <div className="flex items-center gap-3 text-sm">
              <span
                className={`rounded px-2 py-0.5 text-xs font-bold border ${
                  methodColors[selectedApi.method] || ""
                }`}
              >
                {selectedApi.method}
              </span>
              <code className="text-muted-foreground">{selectedApi.path}</code>
            </div>
          )}
          <Textarea
            label="OpenAPI Specification (JSON)"
            id="spec-editor"
            value={specContent}
            onChange={(e) => setSpecContent(e.target.value)}
            className="font-mono text-xs min-h-[400px]"
          />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setSpecEditorOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSpec}>
              <Save className="h-4 w-4" />
              Save Specification
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
