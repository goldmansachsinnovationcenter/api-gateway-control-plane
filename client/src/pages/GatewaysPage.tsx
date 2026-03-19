import { useState, useEffect, useCallback } from "react";
import { gatewaysApi } from "@/lib/api";
import type { Gateway, GatewayConfig } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Backdrop } from "@/components/Backdrop";
import { Plus, Trash2, Server, Cloud, Box } from "lucide-react";

const gatewayTypeOptions = [
  { value: "aws", label: "AWS API Gateway" },
  { value: "kong", label: "Kong Gateway" },
  { value: "custom", label: "Custom Gateway" },
];

const gatewayIcons: Record<string, React.ReactNode> = {
  aws: <Cloud className="h-5 w-5 text-[#FF9900]" />,
  kong: <Box className="h-5 w-5 text-[#003459]" />,
  custom: <Server className="h-5 w-5 text-muted-foreground" />,
};

export function GatewaysPage() {
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [backdropMessage, setBackdropMessage] = useState("");

  // Form state
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState("aws");
  const [formRegion, setFormRegion] = useState("us-east-1");
  const [formAdminUrl, setFormAdminUrl] = useState("");
  const [formApiKey, setFormApiKey] = useState("");
  const [formAccountId, setFormAccountId] = useState("");
  const [formRestApiId, setFormRestApiId] = useState("");

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

  const handleCreate = async () => {
    if (!formName.trim()) return;
    setShowDialog(false);
    setLoading(true);
    setBackdropMessage("Registering gateway and discovering APIs...");

    try {
      const config: GatewayConfig = {};
      if (formType === "aws") {
        config.region = formRegion;
        config.accountId = formAccountId;
        config.restApiId = formRestApiId;
      } else if (formType === "kong") {
        config.adminUrl = formAdminUrl;
        config.apiKey = formApiKey;
      }

      await gatewaysApi.create({ name: formName, type: formType, config });
      await fetchGateways();
      resetForm();
    } catch (err) {
      console.error("Failed to create gateway:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    setBackdropMessage("Removing gateway...");
    try {
      await gatewaysApi.delete(id);
      await fetchGateways();
    } catch (err) {
      console.error("Failed to delete gateway:", err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormName("");
    setFormType("aws");
    setFormRegion("us-east-1");
    setFormAdminUrl("");
    setFormApiKey("");
    setFormAccountId("");
    setFormRestApiId("");
  };

  return (
    <div>
      <Backdrop open={loading} message={backdropMessage} />

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">API Gateways</h1>
          <p className="text-muted-foreground mt-1">Register and manage your API gateways</p>
        </div>
        <Button onClick={() => setShowDialog(true)}>
          <Plus className="h-4 w-4" />
          Add Gateway
        </Button>
      </div>

      {gateways.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Server className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No gateways registered</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Add your first API gateway to start discovering APIs
            </p>
            <Button onClick={() => setShowDialog(true)}>
              <Plus className="h-4 w-4" />
              Add Gateway
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {gateways.map((gw) => (
            <Card key={gw.id} className="hover:border-primary/30 transition-colors">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {gatewayIcons[gw.type]}
                    <div>
                      <CardTitle>{gw.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {gw.type === "aws" ? "AWS API Gateway" : gw.type === "kong" ? "Kong Gateway" : "Custom Gateway"}
                      </CardDescription>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(gw.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <Badge variant="success">{gw.status}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {gw.apiCount} APIs discovered
                  </span>
                </div>
                {gw.config.region && (
                  <p className="text-xs text-muted-foreground mt-3">
                    Region: {gw.config.region}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onClose={() => setShowDialog(false)} title="Register API Gateway">
        <div className="space-y-4">
          <Input
            label="Gateway Name"
            id="gw-name"
            placeholder="e.g., Production AWS Gateway"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
          />
          <Select
            label="Gateway Type"
            id="gw-type"
            options={gatewayTypeOptions}
            value={formType}
            onChange={(e) => setFormType(e.target.value)}
          />

          {formType === "aws" && (
            <>
              <Input
                label="AWS Region"
                id="gw-region"
                placeholder="us-east-1"
                value={formRegion}
                onChange={(e) => setFormRegion(e.target.value)}
              />
              <Input
                label="AWS Account ID"
                id="gw-account"
                placeholder="123456789012"
                value={formAccountId}
                onChange={(e) => setFormAccountId(e.target.value)}
              />
              <Input
                label="REST API ID (optional)"
                id="gw-rest-api"
                placeholder="abc123def4"
                value={formRestApiId}
                onChange={(e) => setFormRestApiId(e.target.value)}
              />
            </>
          )}

          {formType === "kong" && (
            <>
              <Input
                label="Admin API URL"
                id="gw-admin-url"
                placeholder="http://kong-admin:8001"
                value={formAdminUrl}
                onChange={(e) => setFormAdminUrl(e.target.value)}
              />
              <Input
                label="API Key (optional)"
                id="gw-api-key"
                type="password"
                placeholder="Kong admin API key"
                value={formApiKey}
                onChange={(e) => setFormApiKey(e.target.value)}
              />
            </>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!formName.trim()}>
              Register Gateway
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
