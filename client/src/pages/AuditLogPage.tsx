import { useState, useEffect, useCallback } from "react";
import { governanceApi } from "@/lib/api";
import type { AuditLogEntry, AuditLogStats } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FileText, Clock, Activity, ChevronDown, ChevronRight,
  RefreshCw, Filter,
} from "lucide-react";

const actionColors: Record<string, string> = {
  created: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  updated: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  deleted: "bg-red-500/20 text-red-400 border-red-500/30",
  resolved: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  dismissed: "bg-muted text-muted-foreground border-border",
};

const entityLabels: Record<string, string> = {
  compliance_policy: "Policy",
  policy_violation: "Violation",
  api_lifecycle: "Lifecycle",
  data_classification: "Classification",
  api_standard: "Standard",
};

export function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [stats, setStats] = useState<AuditLogStats | null>(null);
  const [entityFilter, setEntityFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [limit, setLimit] = useState(50);

  const fetchLogs = useCallback(async () => {
    try {
      setLogs(await governanceApi.listAuditLogs({
        entityType: entityFilter || undefined,
        action: actionFilter || undefined,
        limit,
      }));
    } catch (err) { console.error(err); }
  }, [entityFilter, actionFilter, limit]);

  const fetchStats = useCallback(async () => {
    try { setStats(await governanceApi.getAuditLogStats()); } catch (err) { console.error(err); }
  }, []);

  useEffect(() => { fetchLogs(); fetchStats(); }, [fetchLogs, fetchStats]);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return "just now";
    if (diff < 3600000) return Math.floor(diff / 60000) + "m ago";
    if (diff < 86400000) return Math.floor(diff / 3600000) + "h ago";
    return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            Audit Log
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Track all governance changes and actions
          </p>
        </div>
        <button onClick={() => { fetchLogs(); fetchStats(); }} className="p-2 rounded-md hover:bg-accent transition-colors">
          <RefreshCw className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <Activity className="h-3.5 w-3.5" /> Total Events
              </div>
              <p className="text-2xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <Clock className="h-3.5 w-3.5" /> Today
              </div>
              <p className="text-2xl font-bold text-primary">{stats.today}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">This Week</p>
              <p className="text-2xl font-bold">{stats.thisWeek}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Entity Types</p>
              <p className="text-2xl font-bold">{stats.byType.length}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Distribution */}
      {stats && stats.byAction.length > 0 && (
        <Card className="mb-6">
          <CardContent className="p-4">
            <p className="text-sm font-medium mb-3">Action Distribution</p>
            <div className="flex gap-4 flex-wrap">
              {stats.byAction.map(a => (
                <div key={a.action} className="flex items-center gap-2">
                  <Badge variant="outline" className={"text-xs " + (actionColors[a.action] || "")}>
                    {a.action}
                  </Badge>
                  <span className="text-sm font-medium">{a.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={entityFilter} onChange={e => setEntityFilter(e.target.value)}>
          <option value="">All Entities</option>
          {Object.entries(entityLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={actionFilter} onChange={e => setActionFilter(e.target.value)}>
          <option value="">All Actions</option>
          <option value="created">Created</option>
          <option value="updated">Updated</option>
          <option value="deleted">Deleted</option>
          <option value="resolved">Resolved</option>
          <option value="dismissed">Dismissed</option>
        </select>
        <span className="text-xs text-muted-foreground ml-auto">{logs.length} entries</span>
      </div>

      {/* Log Entries */}
      <div className="space-y-1">
        {logs.map(log => {
          const isExpanded = expandedLog === log.id;
          return (
            <div key={log.id}
              className="group rounded-md border border-border hover:border-primary/20 transition-colors"
            >
              <button
                className="w-full flex items-center gap-3 p-3 text-left"
                onClick={() => setExpandedLog(isExpanded ? null : log.id)}
              >
                <div className="shrink-0">
                  {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                </div>
                <Badge variant="outline" className={"text-xs " + (actionColors[log.action] || "")}>
                  {log.action}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {entityLabels[log.entity_type] || log.entity_type}
                </Badge>
                <span className="text-sm flex-1 truncate">
                  {log.entity_type.replace(/_/g, " ")} <span className="text-muted-foreground font-mono text-xs">{log.entity_id.slice(0, 8)}</span>
                </span>
                <span className="text-xs text-muted-foreground shrink-0">{formatTime(log.created_at)}</span>
              </button>
              {isExpanded && (
                <div className="border-t border-border px-4 py-3 bg-secondary/20">
                  <div className="grid grid-cols-2 gap-4 text-xs mb-2">
                    <div>
                      <span className="text-muted-foreground">Entity ID:</span>
                      <span className="ml-2 font-mono">{log.entity_id}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Actor:</span>
                      <span className="ml-2">{log.actor}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Timestamp:</span>
                      <span className="ml-2">{new Date(log.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                  {Object.keys(log.changes).length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Changes:</p>
                      <pre className="text-xs bg-background rounded p-2 overflow-x-auto max-h-40">
                        {JSON.stringify(log.changes, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {logs.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-10 w-10 text-muted-foreground mb-2" />
              <p className="text-muted-foreground text-sm">No audit log entries yet. Actions will be recorded as you use governance features.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Load More */}
      {logs.length >= limit && (
        <div className="text-center mt-4">
          <button onClick={() => setLimit(l => l + 50)} className="text-sm text-primary hover:underline">
            Load more...
          </button>
        </div>
      )}
    </div>
  );
}
