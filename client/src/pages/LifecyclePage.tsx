import { useState, useEffect, useCallback } from "react";
import { governanceApi, apisApi } from "@/lib/api";
import type { ApiLifecycle, Api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Clock, Plus, Trash2, Search, CheckCircle, AlertTriangle,
  XCircle, Archive, RefreshCw,
} from "lucide-react";

const statusConfig: Record<string, { color: string; icon: React.ElementType; bg: string }> = {
  active: { color: "text-emerald-400", icon: CheckCircle, bg: "bg-emerald-500/20 border-emerald-500/30" },
  deprecated: { color: "text-amber-400", icon: AlertTriangle, bg: "bg-amber-500/20 border-amber-500/30" },
  sunset: { color: "text-red-400", icon: XCircle, bg: "bg-red-500/20 border-red-500/30" },
  retired: { color: "text-muted-foreground", icon: Archive, bg: "bg-muted border-border" },
};

export function LifecyclePage() {
  const [lifecycles, setLifecycles] = useState<ApiLifecycle[]>([]);
  const [apis, setApis] = useState<Api[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showAssign, setShowAssign] = useState(false);

  // Assign form
  const [selectedApiId, setSelectedApiId] = useState("");
  const [version, setVersion] = useState("1.0.0");
  const [lifecycleStatus, setLifecycleStatus] = useState("active");
  const [deprecationDate, setDeprecationDate] = useState("");
  const [sunsetDate, setSunsetDate] = useState("");
  const [notes, setNotes] = useState("");

  const fetchLifecycles = useCallback(async () => {
    try { setLifecycles(await governanceApi.listLifecycles()); } catch (err) { console.error(err); }
  }, []);

  const fetchApis = useCallback(async () => {
    try { setApis(await apisApi.list()); } catch (err) { console.error(err); }
  }, []);

  useEffect(() => { fetchLifecycles(); fetchApis(); }, [fetchLifecycles, fetchApis]);

  const trackedApiIds = new Set(lifecycles.map(l => l.api_id));
  const untrackedApis = apis.filter(a => !trackedApiIds.has(a.id));

  const handleAssign = async () => {
    if (!selectedApiId) return;
    try {
      await governanceApi.setLifecycle(selectedApiId, {
        version, status: lifecycleStatus,
        deprecationDate: deprecationDate || undefined,
        sunsetDate: sunsetDate || undefined,
        notes: notes || undefined,
      });
      setShowAssign(false);
      setSelectedApiId(""); setVersion("1.0.0"); setLifecycleStatus("active");
      setDeprecationDate(""); setSunsetDate(""); setNotes("");
      fetchLifecycles();
    } catch (err) { console.error(err); }
  };

  const handleUpdateStatus = async (apiId: string, newStatus: string) => {
    try {
      await governanceApi.setLifecycle(apiId, { status: newStatus });
      fetchLifecycles();
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (apiId: string) => {
    try {
      await governanceApi.deleteLifecycle(apiId);
      fetchLifecycles();
    } catch (err) { console.error(err); }
  };

  const filtered = lifecycles.filter(l => {
    if (search && !l.api_name.toLowerCase().includes(search.toLowerCase()) && !l.path.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== "all" && l.status !== statusFilter) return false;
    return true;
  });

  const counts = {
    active: lifecycles.filter(l => l.status === "active").length,
    deprecated: lifecycles.filter(l => l.status === "deprecated").length,
    sunset: lifecycles.filter(l => l.status === "sunset").length,
    retired: lifecycles.filter(l => l.status === "retired").length,
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Clock className="h-6 w-6 text-primary" />
            API Lifecycle Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Track API versions, deprecation status, and sunset dates
          </p>
        </div>
        <Button onClick={() => setShowAssign(true)}>
          <Plus className="h-4 w-4 mr-2" /> Track API
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Tracked</p>
            <p className="text-2xl font-bold">{lifecycles.length}</p>
          </CardContent>
        </Card>
        {Object.entries(counts).map(([status, count]) => {
          const cfg = statusConfig[status];
          const Icon = cfg.icon;
          return (
            <Card key={status}>
              <CardContent className="p-4">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                  <Icon className={"h-3.5 w-3.5 " + cfg.color} />
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </div>
                <p className={"text-2xl font-bold " + cfg.color}>{count}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Untracked Alert */}
      {untrackedApis.length > 0 && (
        <Card className="mb-4 border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-3 flex items-center gap-3">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
            <span className="text-sm text-amber-400">
              {untrackedApis.length} API{untrackedApis.length !== 1 ? "s" : ""} not tracked in lifecycle management
            </span>
            <Button variant="outline" size="sm" className="ml-auto" onClick={() => setShowAssign(true)}>
              Track Now
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Assign Form */}
      {showAssign && (
        <Card className="mb-4 border-primary/30">
          <CardHeader><CardTitle className="text-base">Track API Lifecycle</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={selectedApiId} onChange={e => setSelectedApiId(e.target.value)}>
              <option value="">Select an API...</option>
              {untrackedApis.map(a => <option key={a.id} value={a.id}>{a.method} {a.path} — {a.name}</option>)}
            </select>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Input placeholder="Version" value={version} onChange={e => setVersion(e.target.value)} />
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={lifecycleStatus} onChange={e => setLifecycleStatus(e.target.value)}>
                <option value="active">Active</option>
                <option value="deprecated">Deprecated</option>
                <option value="sunset">Sunset</option>
                <option value="retired">Retired</option>
              </select>
              <Input type="date" placeholder="Deprecation Date" value={deprecationDate} onChange={e => setDeprecationDate(e.target.value)} />
              <Input type="date" placeholder="Sunset Date" value={sunsetDate} onChange={e => setSunsetDate(e.target.value)} />
            </div>
            <Input placeholder="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} />
            <div className="flex gap-2">
              <Button onClick={handleAssign} size="sm">Save</Button>
              <Button variant="ghost" size="sm" onClick={() => setShowAssign(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search APIs..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-2">
          {["all", "active", "deprecated", "sunset", "retired"].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={"px-3 py-1.5 rounded-md text-sm transition-colors " +
                (statusFilter === s ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80")}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Lifecycle List */}
      <div className="space-y-2">
        {filtered.map(lc => {
          const cfg = statusConfig[lc.status] || statusConfig.active;
          const Icon = cfg.icon;
          return (
            <Card key={lc.id} className="hover:border-primary/20 transition-colors">
              <CardContent className="p-4 flex items-center gap-4">
                <Icon className={"h-5 w-5 shrink-0 " + cfg.color} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium text-sm">{lc.api_name}</h3>
                    <Badge variant="outline" className={"text-xs " + cfg.bg}>{lc.status}</Badge>
                    <Badge variant="outline" className="text-xs">v{lc.version}</Badge>
                    {lc.gateway_name && <Badge variant="outline" className="text-xs">{lc.gateway_name}</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">{lc.method} {lc.path}</p>
                  <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                    {lc.deprecation_date && <span>Deprecation: {lc.deprecation_date}</span>}
                    {lc.sunset_date && <span>Sunset: {lc.sunset_date}</span>}
                    {lc.notes && <span>{lc.notes}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <select
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                    value={lc.status}
                    onChange={e => handleUpdateStatus(lc.api_id, e.target.value)}
                  >
                    <option value="active">Active</option>
                    <option value="deprecated">Deprecated</option>
                    <option value="sunset">Sunset</option>
                    <option value="retired">Retired</option>
                  </select>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(lc.api_id)}>
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Clock className="h-10 w-10 text-muted-foreground mb-2" />
              <p className="text-muted-foreground text-sm">No lifecycle tracking configured. Add APIs to start tracking.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
