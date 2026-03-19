import { useState, useEffect, useCallback } from "react";
import { productsApi } from "@/lib/api";
import type { Product, McpTool } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Backdrop } from "@/components/Backdrop";
import { Cpu, Play, ChevronRight, Wrench } from "lucide-react";

export function McpTestingPage() {
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

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

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

    // Generate default args from input schema
    const defaultArgs: Record<string, unknown> = {};
    if (tool.inputSchema.properties) {
      for (const [key, schema] of Object.entries(tool.inputSchema.properties)) {
        const s = schema as Record<string, unknown>;
        if (s.default !== undefined) {
          defaultArgs[key] = s.default;
        } else if (s.type === "string") {
          defaultArgs[key] = s.enum ? (s.enum as string[])[0] : "";
        } else if (s.type === "integer" || s.type === "number") {
          defaultArgs[key] = 0;
        } else if (s.type === "boolean") {
          defaultArgs[key] = false;
        }
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
      const result = await productsApi.testMcpTool(
        selectedProduct.id,
        selectedTool.name,
        args
      );
      setTestResult(JSON.stringify(result, null, 2));
    } catch (err) {
      setTestResult(
        JSON.stringify(
          { error: err instanceof Error ? err.message : "Unknown error" },
          null,
          2
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const methodColors: Record<string, string> = {
    GET: "text-emerald-400",
    POST: "text-blue-400",
    PUT: "text-amber-400",
    DELETE: "text-red-400",
  };

  return (
    <div>
      <Backdrop open={loading} message={backdropMessage} />

      <div className="mb-8">
        <h1 className="text-2xl font-bold">MCP Tool Testing</h1>
        <p className="text-muted-foreground mt-1">
          Test MCP tools generated from your API products
        </p>
      </div>

      {products.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Cpu className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No MCP-enabled products</h3>
            <p className="text-muted-foreground text-sm">
              Enable MCP on a product first to test its tools here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-12 gap-6">
          {/* Product & Tool Selection */}
          <div className="col-span-4 space-y-4">
            {/* Products */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">MCP-Enabled Products</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {products.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => handleSelectProduct(product)}
                    className={`w-full flex items-center justify-between p-3 rounded-md text-left transition-colors ${
                      selectedProduct?.id === product.id
                        ? "bg-primary/10 border border-primary/30"
                        : "hover:bg-secondary/50 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Cpu className="h-4 w-4 text-primary" />
                      <div>
                        <p className="text-sm font-medium">{product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {product.apis.length} APIs
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </CardContent>
            </Card>

            {/* Tools List */}
            {selectedProduct && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Available Tools</CardTitle>
                  <CardDescription>
                    {tools.length} tools generated from APIs
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-1 max-h-96 overflow-y-auto">
                  {tools.map((tool) => (
                    <button
                      key={tool.name}
                      onClick={() => handleSelectTool(tool)}
                      className={`w-full p-3 rounded-md text-left transition-colors ${
                        selectedTool?.name === tool.name
                          ? "bg-primary/10 border border-primary/30"
                          : "hover:bg-secondary/50 border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Wrench className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm font-mono">{tool.name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 ml-5">
                        {tool.description}
                      </p>
                      <div className="flex items-center gap-2 mt-1 ml-5">
                        <span
                          className={`text-xs font-bold ${
                            methodColors[tool._meta.method] || ""
                          }`}
                        >
                          {tool._meta.method}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {tool._meta.path}
                        </span>
                      </div>
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Tool Details & Testing */}
          <div className="col-span-8 space-y-4">
            {selectedTool ? (
              <>
                {/* Tool Details */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="font-mono">
                          {selectedTool.name}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {selectedTool.description}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedTool.annotations.readOnlyHint && (
                          <Badge variant="outline">Read-Only</Badge>
                        )}
                        {selectedTool.annotations.destructiveHint && (
                          <Badge variant="destructive">Destructive</Badge>
                        )}
                        {selectedTool.annotations.idempotentHint && (
                          <Badge variant="secondary">Idempotent</Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Input Schema */}
                    <div className="mb-4">
                      <h4 className="text-sm font-medium mb-2">Input Schema</h4>
                      <div className="bg-secondary rounded-md p-3 space-y-2">
                        {Object.entries(
                          selectedTool.inputSchema.properties || {}
                        ).map(([key, schema]) => {
                          const s = schema as Record<string, unknown>;
                          const isRequired =
                            selectedTool.inputSchema.required?.includes(key);
                          return (
                            <div
                              key={key}
                              className="flex items-center gap-3 text-sm"
                            >
                              <code className="text-primary">{key}</code>
                              <Badge variant="outline" className="text-xs">
                                {String(s.type || "string")}
                              </Badge>
                              {isRequired && (
                                <Badge variant="warning" className="text-xs">
                                  required
                                </Badge>
                              )}
                              {typeof s.description === 'string' && (
                                <span className="text-xs text-muted-foreground">
                                  {s.description}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Test Execution */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Test Tool Execution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <Textarea
                        label="Arguments (JSON)"
                        id="tool-args"
                        value={toolArgs}
                        onChange={(e) => setToolArgs(e.target.value)}
                        className="font-mono text-xs min-h-[120px]"
                      />
                      <Button onClick={handleTestTool} className="w-full">
                        <Play className="h-4 w-4" />
                        Execute Tool
                      </Button>

                      {testResult && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium">Response</h4>
                          <pre className="bg-secondary rounded-md p-4 text-xs font-mono overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap">
                            {testResult}
                          </pre>
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
                  <p className="text-muted-foreground text-sm">
                    Choose a product and tool from the left panel to begin testing
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
