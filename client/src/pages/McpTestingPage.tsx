import { useState, useEffect, useCallback } from "react";
import { productsApi, mcpDiscoveryApi } from "@/lib/api";
import type { Product, McpTool, McpDiscoveredTool, McpConnection } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Backdrop } from "@/components/Backdrop";
import {
  Cpu, Play, ChevronRight, Wrench, Globe, Plus, Trash2,
  Server, Link2, CheckCircle, XCircle, Copy, Check, Save,
} from "lucide-react";

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="p-1 rounded hover:bg-secondary transition-colors"
      title="Copy"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
    </button>
  );
}

function ApiToolsTab() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [tools, setTools] = useState<McpTool[]>([]);
  const [selectedTool, setSelectedTool] = useState<McpTool | null>(null);
  const [toolArgs, setToolArgs] = useState("{}");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [backdropMessage, setBackdropMessage] = useState("");

  const fetchProducts = useCallback(async () => {
    try {
      const data = await productsApi.list();
      setProducts(data.filter((p) => p.mcp_enabled));
    } catch (err) {
      console.error("Failed to fetch products:", err);
    }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const handleSelectProduct = async (product: Product) => {
    setSelectedProduct(product);
    setSelectedTool(null);
    setTestResult(null);
    setToolArgs("{}");
    try {
      const mcpTools = await productsApi.getMcpTools(product.id);
      setTools(mcpTools);
    } catch (err) {
      console.error("Failed to fetch MCP tools:", err);
    }
  };

  const handleSelectTool = (tool: McpTool) => {
    setSelectedTool(tool);
    setTestResult(null);
    const defaultArgs: Record<string, unknown> = {};
    if (tool.inputSchema.properties) {
      for (const [key, schema] of Object.entries(tool.inputSchema.properties)) {
        const s = schema as Record<string, unknown>;
        if (s.default !== undefined) defaultArgs[key] = s.default;
        else if (s.type === "string") defaultArgs[key] = s.enum ? (s.enum as string[])[0] : "";
        else if (s.type === "integer" || s.type === "number") defaultArgs[key] = 0;
        else if (s.type === "boolean") defaultArgs[key] = false;
      }
    }
    setToolArgs(JSON.stringify(defaultArgs, null, 2));
  };

  const handleTestTool = async () => {
    if (!selectedProduct || !selectedTool) return;
    setLoading(true);
    setBackdropMessage("Executing MCP tool call...");
    try {
      const args = JSON.parse(toolArgs);
      const result = await productsApi.testMcpTool(selectedProduct.id, selectedTool.name, args);
      setTestResult(JSON.stringify(result, null, 2));
    } catch (err) {
      setTestResult(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }, null, 2));
    } finally {
      setLoading(false);
    }
  };

  const methodColors: Record<string, string> = {
    GET: "text-emerald-400", POST: "text-blue-400",
    PUT: "text-amber-400", DELETE: "text-red-400",
  };

  if (products.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Cpu className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No MCP-enabled products</h3>
          <p className="text-muted-foreground text-sm">Enable MCP on a product first to test its tools here.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Backdrop open={loading} message={backdropMessage} />
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">MCP-Enabled Products</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {products.map((product) => (
                <button key={product.id} onClick={() => handleSelectProduct(product)}
                  className={`w-full flex items-center justify-between p-3 rounded-md text-left transition-colors ${
                    selectedProduct?.id === product.id ? "bg-primary/10 border border-primary/30" : "hover:bg-secondary/50 border border-transparent"
                  }`}>
                  <div className="flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-sm font-medium">{product.name}</p>
                      <p className="text-xs text-muted-foreground">{product.apis.length} APIs</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </CardContent>
          </Card>
          {selectedProduct && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Available Tools</CardTitle>
                <CardDescription>{tools.length} tools generated from APIs</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1 max-h-96 overflow-y-auto">
                {tools.map((tool) => (
                  <button key={tool.name} onClick={() => handleSelectTool(tool)}
                    className={`w-full p-3 rounded-md text-left transition-colors ${
                      selectedTool?.name === tool.name ? "bg-primary/10 border border-primary/30" : "hover:bg-secondary/50 border border-transparent"
                    }`}>
                    <div className="flex items-center gap-2">
                      <Wrench className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm font-mono">{tool.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 ml-5">{tool.description}</p>
                    <div className="flex items-center gap-2 mt-1 ml-5">
                      <span className={`text-xs font-bold ${methodColors[tool._meta.method] || ""}`}>{tool._meta.method}</span>
                      <span className="text-xs text-muted-foreground font-mono">{tool._meta.path}</span>
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
        <div className="col-span-8 space-y-4">
          {selectedTool ? (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="font-mono">{selectedTool.name}</CardTitle>
                      <CardDescription className="mt-1">{selectedTool.description}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedTool.annotations.readOnlyHint && <Badge variant="outline">Read-Only</Badge>}
                      {selectedTool.annotations.destructiveHint && <Badge variant="destructive">Destructive</Badge>}
                      {selectedTool.annotations.idempotentHint && <Badge variant="secondary">Idempotent</Badge>}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <h4 className="text-sm font-medium mb-2">Input Schema</h4>
                    <div className="bg-secondary rounded-md p-3 space-y-2">
                      {Object.entries(selectedTool.inputSchema.properties || {}).map(([key, schema]) => {
                        const s = schema as Record<string, unknown>;
                        const isRequired = selectedTool.inputSchema.required?.includes(key);
                        return (
                          <div key={key} className="flex items-center gap-3 text-sm">
                            <code className="text-primary">{key}</code>
                            <Badge variant="outline" className="text-xs">{String(s.type || "string")}</Badge>
                            {isRequired && <Badge variant="warning" className="text-xs">required</Badge>}
                            {typeof s.description === 'string' && <span className="text-xs text-muted-foreground">{s.description}</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-sm">Test Tool Execution</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Textarea label="Arguments (JSON)" id="tool-args" value={toolArgs}
                      onChange={(e) => setToolArgs(e.target.value)} className="font-mono text-xs min-h-[120px]" />
                    <Button onClick={handleTestTool} className="w-full"><Play className="h-4 w-4" />Execute Tool</Button>
                    {testResult && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium">Response</h4>
                          <CopyBtn text={testResult} />
                        </div>
                        <pre className="bg-secondary rounded-md p-4 text-xs font-mono overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap">{testResult}</pre>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-24">
                <Wrench className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Select a tool to test</h3>
                <p className="text-muted-foreground text-sm">Choose a product and tool from the left panel to begin testing</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function McpToolsTab() {
  const [serverUrl, setServerUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [serverInfo, setServerInfo] = useState<{ name: string; version: string } | null>(null);
  const [discoveredTools, setDiscoveredTools] = useState<McpDiscoveredTool[]>([]);
  const [selectedTool, setSelectedTool] = useState<McpDiscoveredTool | null>(null);
  const [toolArgs, setToolArgs] = useState("{}");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [connections, setConnections] = useState<McpConnection[]>([]);
  const [saveName, setSaveName] = useState("");
  const [saveDescription, setSaveDescription] = useState("");
  const [showSave, setShowSave] = useState(false);

  const fetchConnections = useCallback(async () => {
    try {
      const data = await mcpDiscoveryApi.listConnections();
      setConnections(data);
    } catch (err) {
      console.error("Failed to fetch connections:", err);
    }
  }, []);

  useEffect(() => { fetchConnections(); }, [fetchConnections]);

  const handleDiscover = async () => {
    if (!serverUrl.trim()) return;
    setDiscovering(true);
    setSelectedTool(null);
    setTestResult(null);
    try {
      const result = await mcpDiscoveryApi.discover(serverUrl.trim(), apiKey || undefined);
      setServerInfo(result.serverInfo);
      setDiscoveredTools(result.tools);
    } catch (err) {
      console.error("Discovery failed:", err);
      setServerInfo(null);
      setDiscoveredTools([]);
    } finally {
      setDiscovering(false);
    }
  };

  const handleSelectTool = (tool: McpDiscoveredTool) => {
    setSelectedTool(tool);
    setTestResult(null);
    const defaultArgs: Record<string, unknown> = {};
    if (tool.inputSchema.properties) {
      for (const [key, schema] of Object.entries(tool.inputSchema.properties)) {
        const s = schema as Record<string, unknown>;
        if (s.default !== undefined) defaultArgs[key] = s.default;
        else if (s.type === "string") defaultArgs[key] = s.enum ? (s.enum as string[])[0] : "";
        else if (s.type === "integer" || s.type === "number") defaultArgs[key] = 0;
        else if (s.type === "boolean") defaultArgs[key] = false;
      }
    }
    setToolArgs(JSON.stringify(defaultArgs, null, 2));
  };

  const handleCallTool = async () => {
    if (!selectedTool) return;
    setLoading(true);
    try {
      const args = JSON.parse(toolArgs);
      const result = await mcpDiscoveryApi.callTool(serverUrl.trim(), selectedTool.name, args, apiKey || undefined);
      if (result.success && result.content) {
        const textParts = result.content.filter((c: { type: string; text: string }) => c.type === "text").map((c: { type: string; text: string }) => c.text);
        setTestResult(textParts.join("\n"));
      } else {
        setTestResult(JSON.stringify({ error: result.error || "Tool call failed" }, null, 2));
      }
    } catch (err) {
      setTestResult(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }, null, 2));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConnection = async () => {
    if (!saveName.trim() || !serverUrl.trim()) return;
    try {
      await mcpDiscoveryApi.saveConnection(saveName.trim(), serverUrl.trim(), apiKey || undefined, saveDescription || undefined);
      await fetchConnections();
      setShowSave(false);
      setSaveName("");
      setSaveDescription("");
    } catch (err) {
      console.error("Failed to save connection:", err);
    }
  };

  const handleDeleteConnection = async (id: string) => {
    try {
      await mcpDiscoveryApi.deleteConnection(id);
      await fetchConnections();
    } catch (err) {
      console.error("Failed to delete connection:", err);
    }
  };

  const handleLoadConnection = (conn: McpConnection) => {
    setServerUrl(conn.url);
    setApiKey(conn.api_key || "");
    setServerInfo(null);
    setDiscoveredTools([]);
    setSelectedTool(null);
    setTestResult(null);
  };

  const hasError = testResult ? testResult.includes('"error"') : false;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            Connect to MCP Server
          </CardTitle>
          <CardDescription>Enter an MCP server URL to discover available tools via JSON-RPC</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Server URL *</label>
                <input type="text" value={serverUrl} onChange={(e) => setServerUrl(e.target.value)}
                  placeholder="http://localhost:3001/mcp/product-id"
                  className="w-full px-3 py-2 bg-secondary rounded-md text-sm border border-border focus:border-primary focus:outline-none" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">API Key (optional)</label>
                <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Bearer token or API key"
                  className="w-full px-3 py-2 bg-secondary rounded-md text-sm border border-border focus:border-primary focus:outline-none" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleDiscover} disabled={discovering || !serverUrl.trim()}>
                {discovering ? (
                  <><div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> Discovering...</>
                ) : (
                  <><Link2 className="h-4 w-4" /> Discover Tools</>
                )}
              </Button>
              {serverUrl.trim() && (
                <Button variant="outline" size="sm" onClick={() => setShowSave(!showSave)}>
                  <Save className="h-3.5 w-3.5" /> Save Connection
                </Button>
              )}
            </div>
            {showSave && (
              <div className="bg-secondary/50 rounded-md p-4 space-y-3 border border-border">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Name *</label>
                    <input type="text" value={saveName} onChange={(e) => setSaveName(e.target.value)}
                      placeholder="My MCP Server"
                      className="w-full px-3 py-2 bg-background rounded-md text-sm border border-border focus:border-primary focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
                    <input type="text" value={saveDescription} onChange={(e) => setSaveDescription(e.target.value)}
                      placeholder="Optional description"
                      className="w-full px-3 py-2 bg-background rounded-md text-sm border border-border focus:border-primary focus:outline-none" />
                  </div>
                </div>
                <Button size="sm" onClick={handleSaveConnection} disabled={!saveName.trim()}>
                  <Plus className="h-3.5 w-3.5" /> Save
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {connections.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Server className="h-4 w-4 text-muted-foreground" />
              Saved Connections
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {connections.map((conn) => (
                <div key={conn.id} className="flex items-center justify-between p-3 bg-secondary/50 rounded-md border border-border">
                  <button onClick={() => handleLoadConnection(conn)} className="flex-1 text-left flex items-center gap-3 hover:opacity-80 transition-opacity">
                    <Server className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-sm font-medium">{conn.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{conn.url}</p>
                    </div>
                    {conn.tool_count > 0 && (
                      <Badge variant="outline" className="text-xs">{conn.tool_count} tools</Badge>
                    )}
                  </button>
                  <button onClick={() => handleDeleteConnection(conn.id)}
                    className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {serverInfo && (
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-4 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                  Connected
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Server</span>
                    <span className="font-medium">{serverInfo.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Version</span>
                    <span className="font-mono text-xs">{serverInfo.version}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tools</span>
                    <Badge variant="outline">{discoveredTools.length}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Discovered Tools</CardTitle>
                <CardDescription>{discoveredTools.length} tools available</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1 max-h-[500px] overflow-y-auto">
                {discoveredTools.map((tool) => (
                  <button key={tool.name} onClick={() => handleSelectTool(tool)}
                    className={`w-full p-3 rounded-md text-left transition-colors ${
                      selectedTool?.name === tool.name ? "bg-primary/10 border border-primary/30" : "hover:bg-secondary/50 border border-transparent"
                    }`}>
                    <div className="flex items-center gap-2">
                      <Wrench className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm font-mono">{tool.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 ml-5 line-clamp-2">{tool.description}</p>
                  </button>
                ))}
                {discoveredTools.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">No tools discovered from this server</p>
                )}
              </CardContent>
            </Card>
          </div>
          <div className="col-span-8 space-y-4">
            {selectedTool ? (
              <>
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="font-mono">{selectedTool.name}</CardTitle>
                        <CardDescription className="mt-1">{selectedTool.description}</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedTool.annotations?.readOnlyHint && <Badge variant="outline">Read-Only</Badge>}
                        {selectedTool.annotations?.destructiveHint && <Badge variant="destructive">Destructive</Badge>}
                        {selectedTool.annotations?.idempotentHint && <Badge variant="secondary">Idempotent</Badge>}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4">
                      <h4 className="text-sm font-medium mb-2">Input Schema</h4>
                      <div className="bg-secondary rounded-md p-3 space-y-2">
                        {Object.entries(selectedTool.inputSchema.properties || {}).map(([key, schema]) => {
                          const s = schema as Record<string, unknown>;
                          const isRequired = selectedTool.inputSchema.required?.includes(key);
                          return (
                            <div key={key} className="flex items-center gap-3 text-sm">
                              <code className="text-primary">{key}</code>
                              <Badge variant="outline" className="text-xs">{String(s.type || "string")}</Badge>
                              {isRequired && <Badge variant="warning" className="text-xs">required</Badge>}
                              {typeof s.description === "string" && (
                                <span className="text-xs text-muted-foreground">{s.description}</span>
                              )}
                            </div>
                          );
                        })}
                        {(!selectedTool.inputSchema.properties || Object.keys(selectedTool.inputSchema.properties).length === 0) && (
                          <p className="text-xs text-muted-foreground">No input parameters</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-sm">Execute Tool</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <Textarea label="Arguments (JSON)" id="mcp-tool-args" value={toolArgs}
                        onChange={(e) => setToolArgs(e.target.value)} className="font-mono text-xs min-h-[120px]" />
                      <Button onClick={handleCallTool} disabled={loading} className="w-full">
                        {loading ? (
                          <><div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> Executing...</>
                        ) : (
                          <><Play className="h-4 w-4" /> Execute Tool</>
                        )}
                      </Button>
                      {testResult && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium flex items-center gap-2">
                              Response
                              {!hasError ? (
                                <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5 text-red-400" />
                              )}
                            </h4>
                            <CopyBtn text={testResult} />
                          </div>
                          <pre className="bg-secondary rounded-md p-4 text-xs font-mono overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap">{testResult}</pre>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-24">
                  <Wrench className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">Select a tool to test</h3>
                  <p className="text-muted-foreground text-sm">Choose a discovered tool from the left panel to execute it</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {!serverInfo && connections.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Globe className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Discover MCP Tools</h3>
            <p className="text-muted-foreground text-sm text-center max-w-md">
              Enter any MCP server URL above to connect and discover its available tools.
              You can test tools from your own products or any external MCP server.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function McpTestingPage() {
  const [activeTab, setActiveTab] = useState<"api" | "mcp">("api");

  const tabs = [
    { key: "api" as const, label: "API Tools", icon: Cpu, description: "Tools auto-generated from your API products" },
    { key: "mcp" as const, label: "MCP Tools", icon: Globe, description: "Discover tools from any MCP server" },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">MCP and Tools</h1>
        <p className="text-muted-foreground mt-1">Test tools from API products or discover tools from external MCP servers</p>
      </div>

      <div className="flex gap-4 mb-6">
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-3 px-5 py-3 rounded-lg border transition-all ${
              activeTab === tab.key
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-border/80"
            }`}>
            <tab.icon className="h-5 w-5" />
            <div className="text-left">
              <p className="text-sm font-medium">{tab.label}</p>
              <p className="text-xs opacity-70">{tab.description}</p>
            </div>
          </button>
        ))}
      </div>

      {activeTab === "api" ? <ApiToolsTab /> : <McpToolsTab />}
    </div>
  );
}
