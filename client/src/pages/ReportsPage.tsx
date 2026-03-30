import { useState } from "react";
import { governanceApi } from "@/lib/api";
import type { GovernanceReport } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText, Download, BarChart3, Shield, Clock,
  AlertTriangle, CheckCircle, Loader2, Eye,
} from "lucide-react";

const reportTypes = [
  { value: "executive_summary", label: "Executive Summary", icon: BarChart3, description: "High-level overview of API governance status" },
  { value: "compliance", label: "Compliance Report", icon: Shield, description: "Policy compliance status and violation details" },
  { value: "risk", label: "Risk Assessment", icon: AlertTriangle, description: "Risk analysis across all APIs and gateways" },
  { value: "lifecycle", label: "Lifecycle Report", icon: Clock, description: "API version tracking, deprecation, and sunset status" },
  { value: "full", label: "Full Governance Report", icon: FileText, description: "Comprehensive report combining all governance data" },
];

export function ReportsPage() {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [report, setReport] = useState<GovernanceReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"formatted" | "json">("formatted");

  const handleGenerate = async (type: string) => {
    setLoading(true);
    setSelectedType(type);
    try {
      const data = await governanceApi.generateReport(type);
      setReport(data);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleExport = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `governance-report-${report.type}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    if (!report) return;
    let csv = "";
    const flatten = (obj: Record<string, unknown>, prefix = ""): Array<[string, string]> => {
      const rows: Array<[string, string]> = [];
      for (const [key, val] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (val && typeof val === "object" && !Array.isArray(val)) {
          rows.push(...flatten(val as Record<string, unknown>, fullKey));
        } else {
          rows.push([fullKey, String(val)]);
        }
      }
      return rows;
    };
    const rows = flatten(report as unknown as Record<string, unknown>);
    csv = "Key,Value\n" + rows.map(([k, v]) => `"${k}","${v}"`).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `governance-report-${report.type}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderOverview = (data: Record<string, unknown>) => {
    if (!data) return null;
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(data).map(([key, val]) => (
          <Card key={key}>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground mb-0.5">{key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase())}</p>
              <p className="text-lg font-bold">{String(val)}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const renderSection = (title: string, data: unknown) => {
    if (!data || (typeof data === "object" && Object.keys(data as object).length === 0)) return null;
    return (
      <div className="mb-4">
        <h3 className="text-sm font-semibold mb-2">{title}</h3>
        {typeof data === "object" && !Array.isArray(data) ? (
          renderOverview(data as Record<string, unknown>)
        ) : Array.isArray(data) ? (
          <div className="text-xs bg-background rounded p-3 overflow-x-auto max-h-60 border">
            <pre>{JSON.stringify(data, null, 2)}</pre>
          </div>
        ) : (
          <p className="text-sm">{String(data)}</p>
        )}
      </div>
    );
  };

  const renderFormattedReport = () => {
    if (!report) return null;
    const { type, generatedAt, title, ...rest } = report;
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">{title}</h2>
            <p className="text-xs text-muted-foreground">Generated: {new Date(generatedAt).toLocaleString()}</p>
          </div>
          <Badge variant="outline" className="text-xs">{type}</Badge>
        </div>
        {Object.entries(rest).map(([key, val]) => (
          <div key={key}>
            {renderSection(
              key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase()),
              val
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            Governance Reports
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Generate and export compliance, risk, and lifecycle reports
          </p>
        </div>
      </div>

      {/* Report Type Selector */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-6">
        {reportTypes.map(rt => {
          const Icon = rt.icon;
          const isSelected = selectedType === rt.value;
          return (
            <Card
              key={rt.value}
              className={"cursor-pointer transition-all hover:border-primary/30 " +
                (isSelected ? "border-primary/50 bg-primary/5" : "")}
              onClick={() => handleGenerate(rt.value)}
            >
              <CardContent className="p-4 flex flex-col items-center text-center">
                <Icon className={"h-8 w-8 mb-2 " + (isSelected ? "text-primary" : "text-muted-foreground")} />
                <h3 className="text-sm font-medium mb-1">{rt.label}</h3>
                <p className="text-xs text-muted-foreground">{rt.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Loading */}
      {loading && (
        <Card className="mb-6">
          <CardContent className="flex items-center justify-center py-12 gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-muted-foreground">Generating report...</span>
          </CardContent>
        </Card>
      )}

      {/* Report Output */}
      {report && !loading && (
        <Card>
          <CardContent className="p-6">
            {/* Toolbar */}
            <div className="flex items-center gap-2 mb-4 border-b border-border pb-3">
              <div className="flex gap-1">
                <button
                  onClick={() => setViewMode("formatted")}
                  className={"px-3 py-1.5 rounded text-xs transition-colors " +
                    (viewMode === "formatted" ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-accent")}
                >
                  <Eye className="h-3.5 w-3.5 inline mr-1" /> Formatted
                </button>
                <button
                  onClick={() => setViewMode("json")}
                  className={"px-3 py-1.5 rounded text-xs transition-colors " +
                    (viewMode === "json" ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-accent")}
                >
                  {"{ }"} JSON
                </button>
              </div>
              <div className="ml-auto flex gap-2">
                <Button variant="outline" size="sm" onClick={handleExport}>
                  <Download className="h-3.5 w-3.5 mr-1" /> JSON
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportCsv}>
                  <Download className="h-3.5 w-3.5 mr-1" /> CSV
                </Button>
              </div>
            </div>

            {viewMode === "formatted" ? (
              renderFormattedReport()
            ) : (
              <pre className="text-xs bg-background rounded p-4 overflow-auto max-h-[600px] border">
                {JSON.stringify(report, null, 2)}
              </pre>
            )}
          </CardContent>
        </Card>
      )}

      {/* No report yet */}
      {!report && !loading && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileText className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Select a report type above to generate</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
