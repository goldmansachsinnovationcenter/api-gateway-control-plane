import { useState, useEffect, useCallback } from "react";
import { governanceApi } from "@/lib/api";
import type { CompliancePolicy, PolicyViolation } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Shield, Plus, Trash2, Play, CheckCircle, XCircle,
  AlertTriangle, Search, Eye, EyeOff, RefreshCw,
} from "lucide-react";

const RULE_TYPES = [
  { value: "min_security_score", label: "Minimum Security Score", configLabel: "Threshold (%)" },
  { value: "min_quality_score", label: "Minimum Quality Score", configLabel: "Threshold (%)" },
  { value: "require_auth", label: "Require Authentication", configLabel: null },
  { value: "require_description", label: "Require API Description", configLabel: null },
  { value: "require_https", label: "Require HTTPS", configLabel: null },
  { value: "naming_convention", label: "Path Naming Convention", configLabel: "Regex Pattern" },
  { value: "max_path_depth", label: "Max Path Depth", configLabel: "Max Depth" },
];

const severityColors: Record<string, string> = {
  critical: "bg-red-500/20 text-red-400 border-red-500/30",
  high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  medium: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  low: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

export function PoliciesPage() {
  const [policies, setPolicies] = useState<CompliancePolicy[]>([]);
  const [violations, setViolations] = useState<PolicyViolation[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [violationFilter, setViolationFilter] = useState<string>("open");
  const [evaluating, setEvaluating] = useState(false);
  const [activeTab, setActiveTab] = useState<"policies" | "violations">("policies");

  // Create form state
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newRuleType, setNewRuleType] = useState("min_security_score");
  const [newSeverity, setNewSeverity] = useState("medium");
  const [newThreshold, setNewThreshold] = useState("70");

  const fetchPolicies = useCallback(async () => {
    try {
      setPolicies(await governanceApi.listPolicies());
    } catch (err) { console.error(err); }
  }, []);

  const fetchViolations = useCallback(async () => {
    try {
      setViolations(await governanceApi.listViolations(undefined, violationFilter !== "all" ? violationFilter : undefined));
    } catch (err) { console.error(err); }
  }, [violationFilter]);

  useEffect(() => { fetchPolicies(); fetchViolations(); }, [fetchPolicies, fetchViolations]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const ruleType = RULE_TYPES.find(r => r.value === newRuleType);
    const ruleConfig: Record<string, unknown> = {};
    if (ruleType?.configLabel) {
      if (newRuleType === "naming_convention") ruleConfig.pattern = newThreshold;
      else if (newRuleType === "max_path_depth") ruleConfig.maxDepth = parseInt(newThreshold);
      else ruleConfig.threshold = parseInt(newThreshold);
    }
    try {
      await governanceApi.createPolicy({
        name: newName, description: newDesc, ruleType: newRuleType,
        ruleConfig, severity: newSeverity,
      });
      setNewName(""); setNewDesc(""); setShowCreate(false);
      fetchPolicies();
    } catch (err) { console.error(err); }
  };

  const handleEvaluate = async () => {
    setEvaluating(true);
    try {
      await governanceApi.evaluatePolicies();
      await fetchViolations();
      await fetchPolicies();
    } catch (err) { console.error(err); }
    setEvaluating(false);
  };

  const handleToggle = async (policy: CompliancePolicy) => {
    try {
      await governanceApi.updatePolicy(policy.id, { enabled: !policy.enabled });
      fetchPolicies();
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id: string) => {
    try {
      await governanceApi.deletePolicy(id);
      fetchPolicies(); fetchViolations();
    } catch (err) { console.error(err); }
  };

  const handleResolve = async (id: string) => {
    try {
      await governanceApi.resolveViolation(id);
      fetchViolations(); fetchPolicies();
    } catch (err) { console.error(err); }
  };

  const handleDismiss = async (id: string) => {
    try {
      await governanceApi.dismissViolation(id);
      fetchViolations(); fetchPolicies();
    } catch (err) { console.error(err); }
  };

  const filteredPolicies = policies.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase())
  );

  const openCount = violations.filter(v => v.status === "open").length;
  const criticalCount = violations.filter(v => v.status === "open" && v.severity === "critical").length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Compliance Policies
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Define and enforce governance rules across all APIs
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleEvaluate} disabled={evaluating}>
            <Play className="h-4 w-4 mr-2" />
            {evaluating ? "Evaluating..." : "Run Evaluation"}
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-2" /> New Policy
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Total Policies</p>
            <p className="text-2xl font-bold">{policies.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Enabled</p>
            <p className="text-2xl font-bold text-emerald-400">{policies.filter(p => p.enabled).length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Open Violations</p>
            <p className="text-2xl font-bold text-amber-400">{openCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Critical</p>
            <p className="text-2xl font-bold text-red-400">{criticalCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 border-b border-border pb-2">
        <button
          onClick={() => setActiveTab("policies")}
          className={"px-4 py-2 text-sm font-medium rounded-t-md transition-colors " +
            (activeTab === "policies" ? "bg-primary/10 text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground")}
        >
          Policies ({policies.length})
        </button>
        <button
          onClick={() => setActiveTab("violations")}
          className={"px-4 py-2 text-sm font-medium rounded-t-md transition-colors " +
            (activeTab === "violations" ? "bg-primary/10 text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground")}
        >
          Violations ({openCount})
        </button>
      </div>

      {activeTab === "policies" && (
        <>
          <div className="relative max-w-md mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search policies..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>

          {/* Create Policy Form */}
          {showCreate && (
            <Card className="mb-4 border-primary/30">
              <CardHeader><CardTitle className="text-base">Create Policy</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Input placeholder="Policy name" value={newName} onChange={e => setNewName(e.target.value)} />
                <Input placeholder="Description (optional)" value={newDesc} onChange={e => setNewDesc(e.target.value)} />
                <div className="grid grid-cols-3 gap-3">
                  <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={newRuleType} onChange={e => setNewRuleType(e.target.value)}>
                    {RULE_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                  <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={newSeverity} onChange={e => setNewSeverity(e.target.value)}>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                  {RULE_TYPES.find(r => r.value === newRuleType)?.configLabel && (
                    <Input
                      placeholder={RULE_TYPES.find(r => r.value === newRuleType)?.configLabel}
                      value={newThreshold}
                      onChange={e => setNewThreshold(e.target.value)}
                    />
                  )}
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleCreate} size="sm">Create</Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Policy List */}
          <div className="space-y-2">
            {filteredPolicies.map(policy => (
              <Card key={policy.id} className="hover:border-primary/20 transition-colors">
                <CardContent className="p-4 flex items-center gap-4">
                  <button onClick={() => handleToggle(policy)} className="shrink-0">
                    {policy.enabled ? (
                      <Eye className="h-5 w-5 text-emerald-400" />
                    ) : (
                      <EyeOff className="h-5 w-5 text-muted-foreground" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-sm">{policy.name}</h3>
                      <Badge variant="outline" className={"text-xs " + (severityColors[policy.severity] || "")}>
                        {policy.severity}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {RULE_TYPES.find(r => r.value === policy.rule_type)?.label || policy.rule_type}
                      </Badge>
                    </div>
                    {policy.description && <p className="text-xs text-muted-foreground mt-0.5">{policy.description}</p>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {policy.violationCount > 0 && (
                      <Badge variant="outline" className="text-xs bg-red-500/10 text-red-400 border-red-500/30">
                        {policy.violationCount} violation{policy.violationCount !== 1 ? "s" : ""}
                      </Badge>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(policy.id)}>
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredPolicies.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Shield className="h-10 w-10 text-muted-foreground mb-2" />
                  <p className="text-muted-foreground text-sm">No policies yet. Create one to start enforcing governance rules.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}

      {activeTab === "violations" && (
        <>
          <div className="flex gap-2 mb-4">
            {["all", "open", "resolved", "dismissed"].map(status => (
              <button
                key={status}
                onClick={() => setViolationFilter(status)}
                className={"px-3 py-1.5 rounded-md text-sm transition-colors " +
                  (violationFilter === status ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80")}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {violations.map(v => (
              <Card key={v.id} className="hover:border-primary/20 transition-colors">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="shrink-0">
                    {v.status === "open" ? (
                      <AlertTriangle className={"h-5 w-5 " + (v.severity === "critical" ? "text-red-400" : v.severity === "high" ? "text-orange-400" : "text-amber-400")} />
                    ) : v.status === "resolved" ? (
                      <CheckCircle className="h-5 w-5 text-emerald-400" />
                    ) : (
                      <XCircle className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{v.policy_name}</span>
                      <Badge variant="outline" className={"text-xs " + (severityColors[v.severity] || "")}>{v.severity}</Badge>
                      <Badge variant="outline" className="text-xs">{v.method} {v.path}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {(v.violation_details as Record<string, string>)?.message || "Policy violation detected"}
                    </p>
                    <p className="text-xs text-muted-foreground">API: {v.api_name}</p>
                  </div>
                  {v.status === "open" && (
                    <div className="flex gap-1 shrink-0">
                      <Button variant="outline" size="sm" onClick={() => handleResolve(v.id)}>
                        <CheckCircle className="h-3.5 w-3.5 mr-1" /> Resolve
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDismiss(v.id)}>
                        Dismiss
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            {violations.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CheckCircle className="h-10 w-10 text-emerald-400 mb-2" />
                  <p className="text-muted-foreground text-sm">No violations found. Run an evaluation to check for policy compliance.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}
