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
import { Plus, Trash2, Server, Cloud, Box, Globe, Layers, Zap, Shield, Network } from "lucide-react";

const gatewayTypeOptions = [
  { value: "aws", label: "AWS API Gateway" },
  { value: "azure", label: "Azure API Management" },
  { value: "kong", label: "Kong Gateway" },
  { value: "apigee", label: "Google Apigee" },
  { value: "mulesoft", label: "MuleSoft Anypoint" },
  { value: "tyk", label: "Tyk Gateway" },
  { value: "nginx", label: "NGINX API Gateway" },
  { value: "custom", label: "Custom Gateway" },
];

const gatewayLabels: Record<string, string> = {
  aws: "AWS API Gateway",
  azure: "Azure API Management",
  kong: "Kong Gateway",
  apigee: "Google Apigee",
  mulesoft: "MuleSoft Anypoint",
  tyk: "Tyk Gateway",
  nginx: "NGINX API Gateway",
  custom: "Custom Gateway",
};

const gatewayIcons: Record<string, React.ReactNode> = {
  aws: <Cloud className="h-5 w-5 text-[#FF9900]" />,
  azure: <Globe className="h-5 w-5 text-[#0078D4]" />,
  kong: <Box className="h-5 w-5 text-[#003459]" />,
  apigee: <Zap className="h-5 w-5 text-[#4285F4]" />,
  mulesoft: <Layers className="h-5 w-5 text-[#00A1E0]" />,
  tyk: <Shield className="h-5 w-5 text-[#6C4BEF]" />,
  nginx: <Network className="h-5 w-5 text-[#009639]" />,
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
  const [formAccessKeyId, setFormAccessKeyId] = useState("");
  const [formSecretAccessKey, setFormSecretAccessKey] = useState("");
  const [formStageName, setFormStageName] = useState("");
  // Azure
  const [formSubscriptionId, setFormSubscriptionId] = useState("");
  const [formResourceGroup, setFormResourceGroup] = useState("");
  const [formServiceName, setFormServiceName] = useState("");
  const [formTenantId, setFormTenantId] = useState("");
  const [formClientId, setFormClientId] = useState("");
  const [formClientSecret, setFormClientSecret] = useState("");
  // MuleSoft
  const [formOrganizationId, setFormOrganizationId] = useState("");
  const [formEnvironmentId, setFormEnvironmentId] = useState("");
  const [formAnypointUrl, setFormAnypointUrl] = useState("https://anypoint.mulesoft.com");
  // Apigee
  const [formProjectId, setFormProjectId] = useState("");
  const [formOrganizationName, setFormOrganizationName] = useState("");
  const [formAuthToken, setFormAuthToken] = useState("");
  // Tyk
  const [formDashboardUrl, setFormDashboardUrl] = useState("");
  const [formGatewayUrl, setFormGatewayUrl] = useState("");
  // NGINX
  const [formServerUrl, setFormServerUrl] = useState("");
  const [formConfigPath, setFormConfigPath] = useState("");

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
        if (formAccessKeyId) config.accessKeyId = formAccessKeyId;
        if (formSecretAccessKey) config.secretAccessKey = formSecretAccessKey;
        if (formStageName) config.stageName = formStageName;
      } else if (formType === "azure") {
        config.subscriptionId = formSubscriptionId;
        config.resourceGroup = formResourceGroup;
        config.serviceName = formServiceName;
        config.region = formRegion;
        if (formTenantId) config.tenantId = formTenantId;
        if (formClientId) config.clientId = formClientId;
        if (formClientSecret) config.clientSecret = formClientSecret;
      } else if (formType === "kong") {
        config.adminUrl = formAdminUrl;
        config.apiKey = formApiKey;
      } else if (formType === "mulesoft") {
        config.anypointUrl = formAnypointUrl;
        config.organizationId = formOrganizationId;
        config.environmentId = formEnvironmentId;
        if (formClientId) config.clientId = formClientId;
        if (formClientSecret) config.clientSecret = formClientSecret;
      } else if (formType === "apigee") {
        config.projectId = formProjectId;
        config.organizationName = formOrganizationName;
        config.region = formRegion;
        if (formAuthToken) config.authToken = formAuthToken;
      } else if (formType === "tyk") {
        config.dashboardUrl = formDashboardUrl;
        config.gatewayUrl = formGatewayUrl;
        if (formApiKey) config.apiKey = formApiKey;
      } else if (formType === "nginx") {
        config.serverUrl = formServerUrl;
        config.configPath = formConfigPath;
        if (formApiKey) config.apiKey = formApiKey;
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
    setFormAccessKeyId("");
    setFormSecretAccessKey("");
    setFormStageName("");
    setFormSubscriptionId("");
    setFormResourceGroup("");
    setFormServiceName("");
    setFormTenantId("");
    setFormClientId("");
    setFormClientSecret("");
    setFormOrganizationId("");
    setFormEnvironmentId("");
    setFormAnypointUrl("https://anypoint.mulesoft.com");
    setFormProjectId("");
    setFormOrganizationName("");
    setFormAuthToken("");
    setFormDashboardUrl("");
    setFormGatewayUrl("");
    setFormServerUrl("");
    setFormConfigPath("");
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
                        {gatewayLabels[gw.type] || "Custom Gateway"}
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
                <div className="mt-3 space-y-0.5">
                  {gw.config.region && (
                    <p className="text-xs text-muted-foreground">Region: {gw.config.region}</p>
                  )}
                  {gw.config.subscriptionId && (
                    <p className="text-xs text-muted-foreground">Subscription: {gw.config.subscriptionId}</p>
                  )}
                  {gw.config.adminUrl && (
                    <p className="text-xs text-muted-foreground">Admin: {gw.config.adminUrl}</p>
                  )}
                  {gw.config.anypointUrl && (
                    <p className="text-xs text-muted-foreground">Anypoint: {gw.config.anypointUrl}</p>
                  )}
                  {gw.config.organizationName && (
                    <p className="text-xs text-muted-foreground">Org: {gw.config.organizationName}</p>
                  )}
                  {gw.config.dashboardUrl && (
                    <p className="text-xs text-muted-foreground">Dashboard: {gw.config.dashboardUrl}</p>
                  )}
                  {gw.config.serverUrl && (
                    <p className="text-xs text-muted-foreground">Server: {gw.config.serverUrl}</p>
                  )}
                </div>
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
              <Input
                label="Stage Name (optional, defaults to prod)"
                id="gw-stage"
                placeholder="prod"
                value={formStageName}
                onChange={(e) => setFormStageName(e.target.value)}
              />
              <div className="border-t border-border pt-4 mt-2">
                <p className="text-sm text-muted-foreground mb-3">
                  Provide AWS credentials to connect to a real API Gateway. Leave blank to use demo data.
                </p>
                <Input
                  label="AWS Access Key ID (optional)"
                  id="gw-access-key"
                  placeholder="AKIAIOSFODNN7EXAMPLE"
                  value={formAccessKeyId}
                  onChange={(e) => setFormAccessKeyId(e.target.value)}
                />
                <Input
                  label="AWS Secret Access Key (optional)"
                  id="gw-secret-key"
                  type="password"
                  placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                  value={formSecretAccessKey}
                  onChange={(e) => setFormSecretAccessKey(e.target.value)}
                  className="mt-4"
                />
              </div>
            </>
          )}

          {formType === "azure" && (
            <>
              <Input label="Azure Region" id="gw-az-region" placeholder="eastus" value={formRegion} onChange={(e) => setFormRegion(e.target.value)} />
              <Input label="Subscription ID" id="gw-az-sub" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" value={formSubscriptionId} onChange={(e) => setFormSubscriptionId(e.target.value)} />
              <Input label="Resource Group" id="gw-az-rg" placeholder="my-resource-group" value={formResourceGroup} onChange={(e) => setFormResourceGroup(e.target.value)} />
              <Input label="APIM Service Name" id="gw-az-svc" placeholder="my-apim-service" value={formServiceName} onChange={(e) => setFormServiceName(e.target.value)} />
              <div className="border-t border-border pt-4 mt-2">
                <p className="text-sm text-muted-foreground mb-3">Azure AD credentials (optional — leave blank for demo data)</p>
                <Input label="Tenant ID" id="gw-az-tenant" placeholder="Azure AD tenant ID" value={formTenantId} onChange={(e) => setFormTenantId(e.target.value)} />
                <Input label="Client ID" id="gw-az-client" placeholder="App registration client ID" value={formClientId} onChange={(e) => setFormClientId(e.target.value)} className="mt-4" />
                <Input label="Client Secret" id="gw-az-secret" type="password" placeholder="App registration secret" value={formClientSecret} onChange={(e) => setFormClientSecret(e.target.value)} className="mt-4" />
              </div>
            </>
          )}

          {formType === "kong" && (
            <>
              <Input label="Admin API URL" id="gw-admin-url" placeholder="http://kong-admin:8001" value={formAdminUrl} onChange={(e) => setFormAdminUrl(e.target.value)} />
              <Input label="API Key (optional)" id="gw-api-key" type="password" placeholder="Kong admin API key" value={formApiKey} onChange={(e) => setFormApiKey(e.target.value)} />
            </>
          )}

          {formType === "mulesoft" && (
            <>
              <Input label="Anypoint Platform URL" id="gw-ms-url" placeholder="https://anypoint.mulesoft.com" value={formAnypointUrl} onChange={(e) => setFormAnypointUrl(e.target.value)} />
              <Input label="Organization ID" id="gw-ms-org" placeholder="MuleSoft organization ID" value={formOrganizationId} onChange={(e) => setFormOrganizationId(e.target.value)} />
              <Input label="Environment ID" id="gw-ms-env" placeholder="Environment ID (e.g., Sandbox, Production)" value={formEnvironmentId} onChange={(e) => setFormEnvironmentId(e.target.value)} />
              <div className="border-t border-border pt-4 mt-2">
                <p className="text-sm text-muted-foreground mb-3">Connected App credentials (optional — leave blank for demo data)</p>
                <Input label="Client ID" id="gw-ms-client" placeholder="Connected App client ID" value={formClientId} onChange={(e) => setFormClientId(e.target.value)} />
                <Input label="Client Secret" id="gw-ms-secret" type="password" placeholder="Connected App secret" value={formClientSecret} onChange={(e) => setFormClientSecret(e.target.value)} className="mt-4" />
              </div>
            </>
          )}

          {formType === "apigee" && (
            <>
              <Input label="GCP Project ID" id="gw-ap-project" placeholder="my-gcp-project" value={formProjectId} onChange={(e) => setFormProjectId(e.target.value)} />
              <Input label="Apigee Organization" id="gw-ap-org" placeholder="my-apigee-org" value={formOrganizationName} onChange={(e) => setFormOrganizationName(e.target.value)} />
              <Input label="Region" id="gw-ap-region" placeholder="us-central1" value={formRegion} onChange={(e) => setFormRegion(e.target.value)} />
              <div className="border-t border-border pt-4 mt-2">
                <p className="text-sm text-muted-foreground mb-3">GCP auth token (optional — leave blank for demo data)</p>
                <Input label="Auth Token" id="gw-ap-token" type="password" placeholder="gcloud auth print-access-token" value={formAuthToken} onChange={(e) => setFormAuthToken(e.target.value)} />
              </div>
            </>
          )}

          {formType === "tyk" && (
            <>
              <Input label="Dashboard URL" id="gw-tyk-dash" placeholder="http://tyk-dashboard:3000" value={formDashboardUrl} onChange={(e) => setFormDashboardUrl(e.target.value)} />
              <Input label="Gateway URL" id="gw-tyk-gw" placeholder="http://tyk-gateway:8080" value={formGatewayUrl} onChange={(e) => setFormGatewayUrl(e.target.value)} />
              <Input label="API Key (optional)" id="gw-tyk-key" type="password" placeholder="Tyk dashboard API key" value={formApiKey} onChange={(e) => setFormApiKey(e.target.value)} />
            </>
          )}

          {formType === "nginx" && (
            <>
              <Input label="NGINX Server URL" id="gw-nx-url" placeholder="http://nginx-server:80" value={formServerUrl} onChange={(e) => setFormServerUrl(e.target.value)} />
              <Input label="Config Path (optional)" id="gw-nx-config" placeholder="/etc/nginx/nginx.conf" value={formConfigPath} onChange={(e) => setFormConfigPath(e.target.value)} />
              <Input label="API Key (optional)" id="gw-nx-key" type="password" placeholder="NGINX Plus API key" value={formApiKey} onChange={(e) => setFormApiKey(e.target.value)} />
            </>)}


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
