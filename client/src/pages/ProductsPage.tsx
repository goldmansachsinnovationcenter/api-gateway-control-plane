import { useState, useEffect, useCallback } from "react";
import { productsApi } from "@/lib/api";
import type { Product, Api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Toggle } from "@/components/ui/toggle";
import { Backdrop } from "@/components/Backdrop";
import { Plus, Trash2, Package, Link2, Unlink, Copy, Check, Cpu } from "lucide-react";

export function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showMcpInfoDialog, setShowMcpInfoDialog] = useState(false);
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [availableApis, setAvailableApis] = useState<Api[]>([]);
  const [loading, setLoading] = useState(false);
  const [backdropMessage, setBackdropMessage] = useState("");
  const [copiedKey, setCopiedKey] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");

  const fetchProducts = useCallback(async () => {
    try {
      const data = await productsApi.list();
      setProducts(data);
    } catch (err) {
      console.error("Failed to fetch products:", err);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleCreate = async () => {
    if (!formName.trim()) return;
    setShowCreateDialog(false);
    setLoading(true);
    setBackdropMessage("Creating API product...");

    try {
      await productsApi.create({ name: formName, description: formDescription });
      await fetchProducts();
      setFormName("");
      setFormDescription("");
    } catch (err) {
      console.error("Failed to create product:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    setBackdropMessage("Deleting product...");
    try {
      await productsApi.delete(id);
      await fetchProducts();
    } catch (err) {
      console.error("Failed to delete product:", err);
    } finally {
      setLoading(false);
    }
  };

  const openAssignDialog = async (product: Product) => {
    setActiveProduct(product);
    try {
      const apis = await productsApi.getAvailableApis(product.id);
      setAvailableApis(apis);
      setShowAssignDialog(true);
    } catch (err) {
      console.error("Failed to fetch available APIs:", err);
    }
  };

  const handleAssignApi = async (apiId: string) => {
    if (!activeProduct) return;
    setLoading(true);
    setBackdropMessage("Assigning API to product...");
    setShowAssignDialog(false);

    try {
      await productsApi.assignApi(activeProduct.id, apiId);
      await fetchProducts();
    } catch (err) {
      console.error("Failed to assign API:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleUnassignApi = async (productId: string, apiId: string) => {
    setLoading(true);
    setBackdropMessage("Removing API from product...");
    try {
      await productsApi.unassignApi(productId, apiId);
      await fetchProducts();
    } catch (err) {
      console.error("Failed to unassign API:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleMcp = async (product: Product) => {
    const newState = !product.mcp_enabled;
    setLoading(true);
    setBackdropMessage(
      newState
        ? "Generating MCP server endpoint..."
        : "Disabling MCP server..."
    );

    try {
      const result = await productsApi.toggleMcp(product.id, newState);
      await fetchProducts();
      if (newState && result.mcpServer) {
        const updated = await productsApi.get(product.id);
        setActiveProduct(updated);
        setShowMcpInfoDialog(true);
      }
    } catch (err) {
      console.error("Failed to toggle MCP:", err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const methodColors: Record<string, string> = {
    GET: "bg-emerald-500/20 text-emerald-400",
    POST: "bg-blue-500/20 text-blue-400",
    PUT: "bg-amber-500/20 text-amber-400",
    DELETE: "bg-red-500/20 text-red-400",
  };

  return (
    <div>
      <Backdrop open={loading} message={backdropMessage} />

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">API Products</h1>
          <p className="text-muted-foreground mt-1">
            Group APIs into products and enable MCP tool generation
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4" />
          Create Product
        </Button>
      </div>

      {products.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No products created</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Create your first API product to group APIs and enable MCP tools
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4" />
              Create Product
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {products.map((product) => (
            <Card key={product.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Package className="h-5 w-5 text-primary" />
                    <div>
                      <CardTitle>{product.name}</CardTitle>
                      {product.description && (
                        <CardDescription className="mt-1">
                          {product.description}
                        </CardDescription>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {/* MCP Toggle */}
                    <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary/50 border border-border">
                      <Cpu className="h-4 w-4 text-primary" />
                      <Toggle
                        checked={!!product.mcp_enabled}
                        onChange={() => handleToggleMcp(product)}
                        label="MCP Tools"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(product.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* MCP Server Info */}
                {product.mcp_enabled && product.mcpServer && (
                  <div className="mb-4 p-3 rounded-md bg-primary/5 border border-primary/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="success">MCP Active</Badge>
                        <code className="text-xs text-muted-foreground">
                          {product.mcpServer.endpoint}
                        </code>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setActiveProduct(product);
                          setShowMcpInfoDialog(true);
                        }}
                      >
                        View Details
                      </Button>
                    </div>
                  </div>
                )}

                {/* Assigned APIs */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-muted-foreground">
                      Assigned APIs ({product.apis.length})
                    </h4>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openAssignDialog(product)}
                    >
                      <Link2 className="h-3 w-3" />
                      Assign API
                    </Button>
                  </div>

                  {product.apis.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">
                      No APIs assigned yet. Assign APIs to enable MCP tool generation.
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {product.apis.map((api) => (
                        <div
                          key={api.id}
                          className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-secondary/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`text-xs font-bold px-2 py-0.5 rounded ${
                                methodColors[api.method] || "bg-muted"
                              }`}
                            >
                              {api.method}
                            </span>
                            <span className="text-sm">{api.name}</span>
                            <code className="text-xs text-muted-foreground">{api.path}</code>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleUnassignApi(product.id, api.id)}
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          >
                            <Unlink className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Product Dialog */}
      <Dialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        title="Create API Product"
      >
        <div className="space-y-4">
          <Input
            label="Product Name"
            id="prod-name"
            placeholder="e.g., User Management APIs"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
          />
          <Textarea
            label="Description (optional)"
            id="prod-desc"
            placeholder="Describe this API product..."
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!formName.trim()}>
              Create Product
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Assign API Dialog */}
      <Dialog
        open={showAssignDialog}
        onClose={() => setShowAssignDialog(false)}
        title={`Assign API to ${activeProduct?.name || ""}`}
      >
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {availableApis.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No available APIs to assign. All APIs are already assigned to this product.
            </p>
          ) : (
            availableApis.map((api) => (
              <button
                key={api.id}
                onClick={() => handleAssignApi(api.id)}
                className="w-full flex items-center gap-3 p-3 rounded-md hover:bg-secondary/50 transition-colors text-left border border-border"
              >
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded ${
                    methodColors[api.method] || "bg-muted"
                  }`}
                >
                  {api.method}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium">{api.name}</p>
                  <p className="text-xs text-muted-foreground">{api.path}</p>
                </div>
                {api.gateway_name && (
                  <Badge variant="outline" className="text-xs">
                    {api.gateway_name}
                  </Badge>
                )}
              </button>
            ))
          )}
        </div>
      </Dialog>

      {/* MCP Server Info Dialog */}
      <Dialog
        open={showMcpInfoDialog}
        onClose={() => setShowMcpInfoDialog(false)}
        title="MCP Server Details"
      >
        {activeProduct?.mcpServer && (
          <div className="space-y-4">
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">MCP Endpoint</label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 text-sm bg-secondary px-3 py-2 rounded-md">
                    {window.location.origin}{activeProduct.mcpServer.endpoint}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      copyToClipboard(
                        `${window.location.origin}${activeProduct.mcpServer!.endpoint}`
                      )
                    }
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">API Key</label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 text-sm bg-secondary px-3 py-2 rounded-md break-all">
                    {activeProduct.mcpServer.api_key}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      copyToClipboard(activeProduct.mcpServer!.api_key)
                    }
                  >
                    {copiedKey ? (
                      <Check className="h-4 w-4 text-success" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Status</label>
                <div className="mt-1">
                  <Badge variant="success">{activeProduct.mcpServer.status}</Badge>
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <h4 className="text-sm font-medium mb-2">Usage Example</h4>
              <pre className="text-xs bg-secondary p-3 rounded-md overflow-x-auto">
{`// MCP Client Configuration
{
  "mcpServers": {
    "${activeProduct.name.toLowerCase().replace(/\\s+/g, '-')}": {
      "url": "${window.location.origin}${activeProduct.mcpServer.endpoint}",
      "headers": {
        "X-API-Key": "${activeProduct.mcpServer.api_key}"
      }
    }
  }
}`}
              </pre>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
