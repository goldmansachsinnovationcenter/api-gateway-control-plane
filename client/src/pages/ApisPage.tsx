import { useState, useEffect, useCallback } from "react";
import { apisApi, gatewaysApi } from "@/lib/api";
import type { Api, Gateway } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ScoreBar } from "@/components/ui/score-bar";
import { Backdrop } from "@/components/Backdrop";
import {
  Eye, Save, Filter, ArrowLeft, BarChart3, Code, FileText,
  Activity, Clock, AlertTriangle, TrendingUp, Users, Zap,
  Hash, Timer, ChevronDown, ChevronRight, Search, Copy, Check,
} from "lucide-react";

const methodColors: Record<string, string> = {
  GET: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  POST: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  PUT: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  DELETE: "bg-red-500/20 text-red-400 border-red-500/30",
  PATCH: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface ApiAnalytics {
  apiId: string;
  apiName: string;
  method: string;
  path: string;
  summary: {
    totalRequests: number;
    totalErrors: number;
    errorRate: number;
    avgLatencyMs: number;
    uptime: number;
    requestsPerSecond: number;
  };
  latencyPercentiles: Record<string, number>;
  statusCodes: Record<string, number>;
  topConsumers: Array<{ name: string; requests: number; avgLatencyMs: number }>;
  hourlyRequests: Array<{ timestamp: string; requests: number; errors: number; avgLatencyMs: number; p95LatencyMs: number; p99LatencyMs: number }>;
  dailyRequests: Array<{ date: string; requests: number; errors: number; avgLatencyMs: number }>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="p-1 rounded hover:bg-accent text-muted-foreground"
      title="Copy"
      onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function formatNum(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export function ApisPage() {
  const [apis, setApis] = useState<Api[]>([]);
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [selectedGateway, setSelectedGateway] = useState<string>("");
  const [selectedApi, setSelectedApi] = useState<Api | null>(null);
  const [specEditorOpen, setSpecEditorOpen] = useState(false);
  const [specContent, setSpecContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [backdropMessage, setBackdropMessage] = useState("");
  const [search, setSearch] = useState("");
  const [detailApi, setDetailApi] = useState<Api | null>(null);

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

  useEffect(() => { fetchGateways(); }, [fetchGateways]);
  useEffect(() => { fetchApis(); }, [fetchApis]);

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

  const filteredApis = apis.filter((api) =>
    !search ||
    api.name.toLowerCase().includes(search.toLowerCase()) ||
    api.path.toLowerCase().includes(search.toLowerCase()) ||
    api.method.toLowerCase().includes(search.toLowerCase())
  );

  // Detail view
  if (detailApi) {
    return (
      <ApiDetailView
        api={detailApi}
        onBack={() => { setDetailApi(null); fetchApis(); }}
        onEditSpec={() => handleViewSpec(detailApi)}
      />
    );
  }

  return (
    <div>
      <Backdrop open={loading} message={backdropMessage} />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            APIs
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            View and manage APIs from your registered gateways
          </p>
        </div>
      </div>

      {/* Search & Gateway filter */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            placeholder="Search APIs by name, path, method..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-background pl-9 pr-3 text-sm"
          />
        </div>
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
        <span className="text-sm text-muted-foreground ml-auto">
          {filteredApis.length} APIs
        </span>
      </div>

      {filteredApis.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileText className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              {apis.length === 0
                ? "No APIs found. Register a gateway first to discover APIs."
                : "No APIs match your search."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredApis.map((api) => (
            <Card
              key={api.id}
              className="hover:border-primary/30 transition-colors cursor-pointer"
              onClick={() => setDetailApi(api)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <span
                      className={`inline-flex items-center justify-center rounded px-2.5 py-1 text-xs font-bold border min-w-[60px] ${
                        methodColors[api.method] || "bg-muted text-muted-foreground"
                      }`}
                    >
                      {api.method}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-sm">{api.name}</h3>
                        {api.gateway_name && (
                          <Badge variant="outline" className="text-xs">
                            {api.gateway_name}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">
                        {api.path}
                      </p>
                    </div>
                    <div className="flex items-center gap-6 w-72">
                      <ScoreBar score={api.security_score} label="Security" className="flex-1" />
                      <ScoreBar score={api.quality_score} label="Quality" className="flex-1" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); handleViewSpec(api); }}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Spec
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); setDetailApi(api); }}
                    >
                      <BarChart3 className="h-4 w-4 mr-1" />
                      Details
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
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

// ─── API Detail View ─────────────────────────────────────────────────────────

function ApiDetailView({
  api,
  onBack,
  onEditSpec,
}: {
  api: Api;
  onBack: () => void;
  onEditSpec: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"schema" | "analytics">("schema");
  const [fullApi, setFullApi] = useState<Api | null>(null);
  const [analytics, setAnalytics] = useState<ApiAnalytics | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  useEffect(() => {
    apisApi.get(api.id).then(setFullApi).catch(console.error);
  }, [api.id]);

  useEffect(() => {
    if (activeTab === "analytics" && !analytics) {
      setLoadingAnalytics(true);
      fetch(`http://localhost:3001/api/apis/${api.id}/analytics`)
        .then(r => r.json())
        .then(setAnalytics)
        .catch(console.error)
        .finally(() => setLoadingAnalytics(false));
    }
  }, [activeTab, api.id, analytics]);

  const tabs = [
    { key: "schema" as const, label: "Schema", icon: Code },
    { key: "analytics" as const, label: "Analytics", icon: BarChart3 },
  ];

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
              <span className={`rounded px-2 py-0.5 text-xs font-bold border ${methodColors[api.method] || ""}`}>
                {api.method}
              </span>
              {api.name}
            </h1>
            <p className="text-sm text-muted-foreground font-mono mt-1">{api.path}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <ScoreBar score={api.security_score} label="Security" className="w-32" />
          <ScoreBar score={api.quality_score} label="Quality" className="w-32" />
          <Button variant="outline" size="sm" onClick={onEditSpec}>
            <Eye className="h-4 w-4 mr-1" /> Edit Spec
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "schema" && fullApi && <SchemaViewer api={fullApi} />}
      {activeTab === "analytics" && (
        loadingAnalytics ? (
          <p className="text-center text-muted-foreground py-12">Loading analytics...</p>
        ) : analytics ? (
          <AnalyticsDashboard analytics={analytics} />
        ) : (
          <p className="text-center text-muted-foreground py-12">Failed to load analytics</p>
        )
      )}
    </div>
  );
}

// ─── Visual Schema Viewer ────────────────────────────────────────────────────

function SchemaViewer({ api }: { api: Api }) {
  const [showRaw, setShowRaw] = useState(false);
  const spec = api.spec;

  if (!spec) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No specification available for this API.
        </CardContent>
      </Card>
    );
  }

  const specObj = typeof spec === "string" ? JSON.parse(spec) : spec;

  // Extract key info from OpenAPI-style spec
  const parameters = (specObj.parameters || specObj.requestParameters || []) as Array<Record<string, unknown>>;
  const responses = (specObj.responses || specObj.responseModels || {}) as Record<string, unknown>;
  const requestBody = specObj.requestBody as Record<string, unknown> | undefined;
  const description = (specObj.description || specObj.summary || api.description || "") as string;
  const tags = (specObj.tags || []) as string[];
  const security = (specObj.security || []) as Array<Record<string, unknown>>;

  return (
    <div className="space-y-4">
      {/* Toggle */}
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={() => setShowRaw(false)}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${!showRaw ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}
        >
          <Code className="h-3.5 w-3.5 inline mr-1" />
          Visual
        </button>
        <button
          onClick={() => setShowRaw(true)}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${showRaw ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}
        >
          <FileText className="h-3.5 w-3.5 inline mr-1" />
          Raw JSON
        </button>
      </div>

      {showRaw ? (
        <Card>
          <CardContent className="p-4">
            <pre className="text-xs font-mono whitespace-pre-wrap overflow-auto max-h-[600px] text-foreground">
              {JSON.stringify(specObj, null, 2)}
            </pre>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Overview */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <InfoRow label="Method" value={api.method} />
                <InfoRow label="Path" value={api.path}>
                  <CopyBtn text={api.path} />
                </InfoRow>
                {description && <InfoRow label="Description" value={description} />}
                {tags.length > 0 && (
                  <div className="flex items-center justify-between text-sm py-1.5 border-b border-border/50">
                    <span className="text-muted-foreground">Tags</span>
                    <div className="flex gap-1.5">
                      {tags.map((t: string) => (
                        <span key={t} className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">{t}</span>
                      ))}
                    </div>
                  </div>
                )}
                {api.gateway_name && <InfoRow label="Gateway" value={api.gateway_name} />}
                <InfoRow label="Security Score" value={`${api.security_score}/100`} />
                <InfoRow label="Quality Score" value={`${api.quality_score}/100`} />
              </div>
            </CardContent>
          </Card>

          {/* Parameters */}
          {parameters.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Hash className="h-4 w-4" /> Parameters ({parameters.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted-foreground">
                        <th className="text-left py-2 pr-4 font-medium">Name</th>
                        <th className="text-left py-2 pr-4 font-medium">In</th>
                        <th className="text-left py-2 pr-4 font-medium">Type</th>
                        <th className="text-left py-2 pr-4 font-medium">Required</th>
                        <th className="text-left py-2 font-medium">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parameters.map((p, i) => (
                        <tr key={i} className="border-b border-border/30">
                          <td className="py-2 pr-4 font-mono text-xs text-primary">{String(p.name || `param_${i}`)}</td>
                          <td className="py-2 pr-4">
                            <span className="text-xs px-1.5 py-0.5 rounded bg-accent">{String(p.in || "query")}</span>
                          </td>
                          <td className="py-2 pr-4 text-xs text-muted-foreground">{String((p.schema as Record<string, unknown>)?.type || p.type || "string")}</td>
                          <td className="py-2 pr-4">
                            {p.required ? (
                              <span className="text-xs text-amber-400">required</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">optional</span>
                            )}
                          </td>
                          <td className="py-2 text-xs text-muted-foreground">{String(p.description || "—")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Request Body */}
          {requestBody && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Request Body</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs font-mono whitespace-pre-wrap bg-accent/50 rounded p-3 max-h-[300px] overflow-auto">
                  {JSON.stringify(requestBody, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}

          {/* Responses */}
          {Object.keys(responses).length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Responses</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(responses).map(([code, resp]) => (
                    <ResponseItem key={code} code={code} response={resp} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Security */}
          {security.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Security</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs font-mono whitespace-pre-wrap bg-accent/50 rounded p-3">
                  {JSON.stringify(security, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}

          {/* Full Spec Properties (fallback for non-OpenAPI) */}
          {parameters.length === 0 && Object.keys(responses).length === 0 && !requestBody && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Specification Properties</CardTitle>
              </CardHeader>
              <CardContent>
                <SpecTree data={specObj} />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function ResponseItem({ code, response }: { code: string; response: unknown }) {
  const [expanded, setExpanded] = useState(code === "200" || code === "201");
  const codeColor = code.startsWith("2") ? "text-emerald-400" : code.startsWith("4") ? "text-amber-400" : code.startsWith("5") ? "text-red-400" : "text-muted-foreground";

  return (
    <div className="border border-border/50 rounded">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 p-2.5 text-sm hover:bg-accent/50 transition-colors"
      >
        {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <span className={`font-mono font-bold ${codeColor}`}>{code}</span>
        <span className="text-xs text-muted-foreground">
          {typeof response === "object" && response !== null && "description" in (response as Record<string, unknown>)
            ? String((response as Record<string, unknown>).description)
            : ""}
        </span>
      </button>
      {expanded && (
        <div className="px-3 pb-3">
          <pre className="text-xs font-mono whitespace-pre-wrap bg-accent/30 rounded p-2 max-h-[200px] overflow-auto">
            {JSON.stringify(response, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function SpecTree({ data, depth = 0 }: { data: unknown; depth?: number }) {
  if (data === null || data === undefined) return <span className="text-muted-foreground text-xs">null</span>;
  if (typeof data !== "object") return <span className="text-xs font-mono">{String(data)}</span>;

  const entries = Object.entries(data as Record<string, unknown>);
  if (entries.length === 0) return <span className="text-muted-foreground text-xs">{"{}"}</span>;

  return (
    <div className={depth > 0 ? "ml-4 pl-3 border-l border-border/40" : ""}>
      {entries.map(([key, val]) => (
        <SpecTreeNode key={key} propKey={key} value={val} depth={depth} />
      ))}
    </div>
  );
}

function SpecTreeNode({ propKey, value, depth }: { propKey: string; value: unknown; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const isObject = typeof value === "object" && value !== null;
  const isArray = Array.isArray(value);

  return (
    <div className="py-0.5">
      <button
        onClick={() => isObject && setExpanded(!expanded)}
        className={`flex items-center gap-1.5 text-xs ${isObject ? "cursor-pointer" : "cursor-default"}`}
      >
        {isObject ? (
          expanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />
        ) : (
          <span className="w-3" />
        )}
        <span className="font-mono text-primary">{propKey}</span>
        {!isObject && (
          <>
            <span className="text-muted-foreground">:</span>
            <span className="font-mono text-foreground">{JSON.stringify(value)}</span>
          </>
        )}
        {isObject && !expanded && (
          <span className="text-muted-foreground">
            {isArray ? `[${(value as unknown[]).length}]` : `{${Object.keys(value as Record<string, unknown>).length}}`}
          </span>
        )}
      </button>
      {isObject && expanded && <SpecTree data={value} depth={depth + 1} />}
    </div>
  );
}

// ─── Analytics Dashboard ─────────────────────────────────────────────────────

function AnalyticsDashboard({ analytics }: { analytics: ApiAnalytics }) {
  const { summary, latencyPercentiles, statusCodes, topConsumers, dailyRequests, hourlyRequests } = analytics;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Card className="bg-blue-500/5 border-blue-500/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Hash className="h-3.5 w-3.5" /> Total Requests
            </div>
            <p className="text-2xl font-bold">{formatNum(summary.totalRequests)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Last 30 days</p>
          </CardContent>
        </Card>
        <Card className="bg-red-500/5 border-red-500/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <AlertTriangle className="h-3.5 w-3.5" /> Error Rate
            </div>
            <p className="text-2xl font-bold">{summary.errorRate}%</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{formatNum(summary.totalErrors)} errors</p>
          </CardContent>
        </Card>
        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Timer className="h-3.5 w-3.5" /> Avg Latency
            </div>
            <p className="text-2xl font-bold">{summary.avgLatencyMs}ms</p>
          </CardContent>
        </Card>
        <Card className="bg-emerald-500/5 border-emerald-500/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <TrendingUp className="h-3.5 w-3.5" /> Uptime
            </div>
            <p className="text-2xl font-bold">{summary.uptime}%</p>
          </CardContent>
        </Card>
        <Card className="bg-purple-500/5 border-purple-500/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Zap className="h-3.5 w-3.5" /> Req/sec
            </div>
            <p className="text-2xl font-bold">{summary.requestsPerSecond}</p>
          </CardContent>
        </Card>
        <Card className="bg-cyan-500/5 border-cyan-500/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Users className="h-3.5 w-3.5" /> Consumers
            </div>
            <p className="text-2xl font-bold">{topConsumers.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Request Volume Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Daily Request Volume (Last 30 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-[3px] h-40">
            {dailyRequests.map((day) => {
              const maxReqs = Math.max(...dailyRequests.map(d => d.requests), 1);
              const height = Math.max((day.requests / maxReqs) * 100, 2);
              const errorPct = day.requests > 0 ? (day.errors / day.requests) * 100 : 0;
              return (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-0.5" title={`${day.date}: ${day.requests.toLocaleString()} requests, ${day.errors} errors, ${day.avgLatencyMs}ms avg`}>
                  <div className="w-full flex flex-col justify-end" style={{ height: "140px" }}>
                    {errorPct > 0 && (
                      <div
                        className="w-full bg-red-500/60 rounded-t-sm"
                        style={{ height: `${Math.max((errorPct / 100) * height * 1.4, 1)}px` }}
                      />
                    )}
                    <div
                      className="w-full bg-blue-500/60 rounded-t-sm"
                      style={{ height: `${height * 1.4}px` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>{dailyRequests[0]?.date}</span>
            <span>{dailyRequests[dailyRequests.length - 1]?.date}</span>
          </div>
          <div className="flex items-center gap-4 text-[10px] text-muted-foreground mt-2">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-blue-500/60" /> Requests</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-red-500/60" /> Errors</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Latency Percentiles */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4" /> Latency Percentiles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(latencyPercentiles).map(([pct, ms]) => {
                const maxMs = Math.max(...Object.values(latencyPercentiles), 1);
                const width = Math.round((ms / maxMs) * 100);
                const color = ms < 100 ? "bg-emerald-500" : ms < 300 ? "bg-amber-500" : "bg-red-500";
                return (
                  <div key={pct}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-mono text-xs">{pct.toUpperCase()}</span>
                      <span className="text-xs text-muted-foreground">{ms}ms</span>
                    </div>
                    <div className="bg-accent rounded-full h-2 overflow-hidden">
                      <div className={`${color} h-full rounded-full transition-all`} style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Status Code Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4" /> Status Code Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(statusCodes).map(([code, count]) => {
                const total = Object.values(statusCodes).reduce((s, c) => s + c, 0);
                const pct = total > 0 ? ((count / total) * 100).toFixed(1) : "0";
                const color = code.startsWith("2") ? "bg-emerald-500" : code.startsWith("4") ? "bg-amber-500" : "bg-red-500";
                return (
                  <div key={code} className="flex items-center gap-3 text-sm">
                    <span className={`font-mono text-xs w-8 ${code.startsWith("2") ? "text-emerald-400" : code.startsWith("4") ? "text-amber-400" : "text-red-400"}`}>{code}</span>
                    <div className="flex-1 bg-accent rounded-full h-2 overflow-hidden">
                      <div className={`${color} h-full rounded-full`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground w-20 text-right">{formatNum(count)} ({pct}%)</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Hourly Traffic (Last 24h) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Hourly Traffic (Last 24 Hours)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-1 h-32">
            {hourlyRequests.map((hr, i) => {
              const maxReqs = Math.max(...hourlyRequests.map(h => h.requests), 1);
              const height = Math.max((hr.requests / maxReqs) * 100, 2);
              return (
                <div
                  key={i}
                  className="flex-1 bg-primary/40 rounded-t hover:bg-primary/60 transition-colors cursor-default"
                  style={{ height: `${height}%` }}
                  title={`${new Date(hr.timestamp).toLocaleTimeString()}: ${hr.requests} requests, ${hr.avgLatencyMs}ms avg, P95: ${hr.p95LatencyMs}ms`}
                />
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>24h ago</span>
            <span>Now</span>
          </div>
        </CardContent>
      </Card>

      {/* Top Consumers */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4" /> Top Consumers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {topConsumers.map((consumer) => {
              const maxReqs = Math.max(...topConsumers.map(c => c.requests), 1);
              const pct = Math.round((consumer.requests / maxReqs) * 100);
              return (
                <div key={consumer.name} className="flex items-center gap-3 text-sm">
                  <span className="w-44 truncate font-mono text-xs">{consumer.name}</span>
                  <div className="flex-1 bg-accent rounded-full h-2 overflow-hidden">
                    <div className="bg-primary h-full rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground w-16 text-right">{formatNum(consumer.requests)}</span>
                  <span className="text-xs text-muted-foreground w-14 text-right">{consumer.avgLatencyMs}ms</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
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
