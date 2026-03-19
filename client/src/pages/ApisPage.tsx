import { useState, useEffect, useCallback } from "react";
import { apisApi, gatewaysApi } from "@/lib/api";
import type { Api, Gateway } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ScoreBar } from "@/components/ui/score-bar";
import { Backdrop } from "@/components/Backdrop";
import { Eye, Save, Filter } from "lucide-react";

const methodColors: Record<string, string> = {
  GET: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  POST: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  PUT: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  DELETE: "bg-red-500/20 text-red-400 border-red-500/30",
  PATCH: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

export function ApisPage() {
  const [apis, setApis] = useState<Api[]>([]);
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [selectedGateway, setSelectedGateway] = useState<string>("");
  const [selectedApi, setSelectedApi] = useState<Api | null>(null);
  const [specEditorOpen, setSpecEditorOpen] = useState(false);
  const [specContent, setSpecContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [backdropMessage, setBackdropMessage] = useState("");

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

  return (
    <div>
      <Backdrop open={loading} message={backdropMessage} />

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">APIs</h1>
          <p className="text-muted-foreground mt-1">
            View and manage APIs from your registered gateways
          </p>
        </div>
      </div>

      {/* Gateway filter */}
      <div className="flex items-center gap-3 mb-6">
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

      {apis.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <p className="text-muted-foreground">
              No APIs found. Register a gateway first to discover APIs.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {apis.map((api) => (
            <Card key={api.id} className="hover:border-primary/20 transition-colors">
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
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleViewSpec(api)}
                    className="ml-4"
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View Spec
                  </Button>
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
