import { useState, useEffect, useCallback } from "react";
import { productsApi, plansApi } from "@/lib/api";
import type { Product, Api, Plan, Subscription } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Toggle } from "@/components/ui/toggle";
import { Backdrop } from "@/components/Backdrop";
import {
  Plus, Trash2, Package, Link2, Unlink, Copy, Check, Cpu,
  Shield, Users, BarChart3, Clock, Zap, Key, Pause, Play, X
} from "lucide-react";

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
  const [copiedSubKey, setCopiedSubKey] = useState<string | null>(null);

  const [productPlans, setProductPlans] = useState<Record<string, Plan[]>>({});
  const [productSubscriptions, setProductSubscriptions] = useState<Record<string, Subscription[]>>({});
  const [showCreatePlanDialog, setShowCreatePlanDialog] = useState(false);
  const [showSubscribeDialog, setShowSubscribeDialog] = useState(false);
  const [activePlan, setActivePlan] = useState<Plan | null>(null);
  const [activeTab, setActiveTab] = useState<Record<string, "apis" | "plans" | "usage">>({});

  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");

  const [planName, setPlanName] = useState("");
  const [planDescription, setPlanDescription] = useState("");
  const [planRateMinute, setPlanRateMinute] = useState("");
  const [planRateHour, setPlanRateHour] = useState("");
  const [planRateDay, setPlanRateDay] = useState("");
  const [planQuotaMonth, setPlanQuotaMonth] = useState("");
  const [planBurstLimit, setPlanBurstLimit] = useState("");

  const [subAppName, setSubAppName] = useState("");

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

  const fetchPlans = async (productId: string) => {
    try {
      const plans = await plansApi.listForProduct(productId);
      setProductPlans(prev => ({ ...prev, [productId]: plans }));
    } catch (err) {
      console.error("Failed to fetch plans:", err);
    }
  };

  const fetchSubscriptions = async (productId: string) => {
    try {
      const subs = await plansApi.getProductSubscriptions(productId);
      setProductSubscriptions(prev => ({ ...prev, [productId]: subs }));
    } catch (err) {
      console.error("Failed to fetch subscriptions:", err);
    }
  };

  const getTab = (productId: string) => activeTab[productId] || "apis";
  const setTab = (productId: string, tab: "apis" | "plans" | "usage") => {
    setActiveTab(prev => ({ ...prev, [productId]: tab }));
    if (tab === "plans") fetchPlans(productId);
    if (tab === "usage") {
      fetchPlans(productId);
      fetchSubscriptions(productId);
    }
  };

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
    setBackdropMessage(newState ? "Generating MCP server endpoint..." : "Disabling MCP server...");
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

  const copyToClipboard = async (text: string, type?: string) => {
    await navigator.clipboard.writeText(text);
    if (type === "sub") {
      setCopiedSubKey(text);
      setTimeout(() => setCopiedSubKey(null), 2000);
    } else {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const handleCreatePlan = async () => {
    if (!planName.trim() || !activeProduct) return;
    setShowCreatePlanDialog(false);
    setLoading(true);
    setBackdropMessage("Creating plan...");
    try {
      await plansApi.create(activeProduct.id, {
        name: planName,
        description: planDescription || undefined,
        rateLimitPerMinute: planRateMinute ? parseInt(planRateMinute) : undefined,
        rateLimitPerHour: planRateHour ? parseInt(planRateHour) : undefined,
        rateLimitPerDay: planRateDay ? parseInt(planRateDay) : undefined,
        quotaPerMonth: planQuotaMonth ? parseInt(planQuotaMonth) : undefined,
        throttleBurstLimit: planBurstLimit ? parseInt(planBurstLimit) : undefined,
      });
      await fetchPlans(activeProduct.id);
      setPlanName(""); setPlanDescription("");
      setPlanRateMinute(""); setPlanRateHour(""); setPlanRateDay("");
      setPlanQuotaMonth(""); setPlanBurstLimit("");
    } catch (err) {
      console.error("Failed to create plan:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePlan = async (planId: string, productId: string) => {
    setLoading(true);
    setBackdropMessage("Deleting plan...");
    try {
      await plansApi.delete(planId);
      await fetchPlans(productId);
    } catch (err) {
      console.error("Failed to delete plan:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async () => {
    if (!subAppName.trim() || !activePlan || !activeProduct) return;
    setShowSubscribeDialog(false);
    setLoading(true);
    setBackdropMessage("Creating subscription...");
    try {
      await plansApi.subscribe(activePlan.id, subAppName);
      await Promise.all([fetchPlans(activeProduct.id), fetchSubscriptions(activeProduct.id)]);
      setSubAppName("");
    } catch (err) {
      console.error("Failed to subscribe:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSubStatus = async (subId: string, currentStatus: string, productId: string) => {
    const newStatus = currentStatus === "active" ? "suspended" : "active";
    try {
      await plansApi.updateSubscriptionStatus(subId, newStatus);
      await fetchSubscriptions(productId);
      await fetchPlans(productId);
    } catch (err) {
      console.error("Failed to update subscription:", err);
    }
  };

  const handleDeleteSubscription = async (subId: string, productId: string) => {
    try {
      await plansApi.deleteSubscription(subId);
      await Promise.all([fetchPlans(productId), fetchSubscriptions(productId)]);
    } catch (err) {
      console.error("Failed to delete subscription:", err);
    }
  };

  const methodColors: Record<string, string> = {
    GET: "bg-emerald-500/20 text-emerald-400",
    POST: "bg-blue-500/20 text-blue-400",
    PUT: "bg-amber-500/20 text-amber-400",
    DELETE: "bg-red-500/20 text-red-400",
  };

  const formatLimit = (val: number) => val === 0 ? "Unlimited" : val.toLocaleString();

  const renderApisTab = (product: Product) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-muted-foreground">Assigned APIs ({product.apis.length})</h4>
        <Button variant="outline" size="sm" onClick={() => openAssignDialog(product)}>
          <Link2 className="h-3 w-3" /> Assign API
        </Button>
      </div>
      {product.apis.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">No APIs assigned yet.</p>
      ) : (
        <div className="space-y-1">
          {product.apis.map((api) => (
            <div key={api.id} className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-secondary/50 transition-colors">
              <div className="flex items-center gap-3">
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${methodColors[api.method] || "bg-muted"}`}>{api.method}</span>
                <span className="text-sm">{api.name}</span>
                <code className="text-xs text-muted-foreground">{api.path}</code>
              </div>
              <Button variant="ghost" size="icon" onClick={() => handleUnassignApi(product.id, api.id)} className="h-7 w-7 text-muted-foreground hover:text-destructive">
                <Unlink className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderPlansTab = (product: Product) => {
    const plans = productPlans[product.id] || [];
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-muted-foreground">Rate Limit Plans ({plans.length})</h4>
          <Button variant="outline" size="sm" onClick={() => { setActiveProduct(product); setShowCreatePlanDialog(true); }}>
            <Plus className="h-3 w-3" /> Create Plan
          </Button>
        </div>
        {plans.length === 0 ? (
          <div className="text-center py-8">
            <Shield className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-2">No plans created yet</p>
            <p className="text-xs text-muted-foreground">Create a plan to add rate limiting and subscription management</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {plans.map(plan => (
              <div key={plan.id} className="border border-border rounded-lg p-4 hover:border-primary/50 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h5 className="font-medium text-sm">{plan.name}</h5>
                    {plan.description && <p className="text-xs text-muted-foreground mt-0.5">{plan.description}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setActiveProduct(product); setActivePlan(plan); setShowSubscribeDialog(true); }}>
                      <Users className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => handleDeletePlan(plan.id, product.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Per Minute</span>
                    <span className="font-mono">{formatLimit(plan.rate_limit_per_minute)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Per Hour</span>
                    <span className="font-mono">{formatLimit(plan.rate_limit_per_hour)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Per Day</span>
                    <span className="font-mono">{formatLimit(plan.rate_limit_per_day)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1"><BarChart3 className="h-3 w-3" /> Monthly Quota</span>
                    <span className="font-mono">{formatLimit(plan.quota_per_month)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1"><Zap className="h-3 w-3" /> Burst Limit</span>
                    <span className="font-mono">{formatLimit(plan.throttle_burst_limit)}</span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    <Users className="h-3 w-3 inline mr-1" />
                    {plan.subscriberCount} subscriber{plan.subscriberCount !== 1 ? "s" : ""}
                  </span>
                  <Button variant="outline" size="sm" className="h-6 text-xs" onClick={() => { setActiveProduct(product); setActivePlan(plan); setShowSubscribeDialog(true); }}>
                    <Plus className="h-3 w-3" /> Subscribe
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderUsageTab = (product: Product) => {
    const subs = productSubscriptions[product.id] || [];
    const plans = productPlans[product.id] || [];
    const activeSubs = subs.filter(s => s.status === "active");
    const totalThisMonth = subs.reduce((acc, s) => acc + (s.usage?.currentMonth || 0), 0);
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="border border-border rounded-lg p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Shield className="h-3 w-3" /> Plans</div>
            <p className="text-lg font-bold">{plans.length}</p>
          </div>
          <div className="border border-border rounded-lg p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Users className="h-3 w-3" /> Subscriptions</div>
            <p className="text-lg font-bold">{subs.length} <span className="text-sm text-muted-foreground font-normal">({activeSubs.length} active)</span></p>
          </div>
          <div className="border border-border rounded-lg p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><BarChart3 className="h-3 w-3" /> Requests (Month)</div>
            <p className="text-lg font-bold">{totalThisMonth.toLocaleString()}</p>
          </div>
          <div className="border border-border rounded-lg p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Cpu className="h-3 w-3" /> MCP Status</div>
            <p className="text-lg font-bold">{product.mcp_enabled ? <Badge variant="success">Active</Badge> : <Badge variant="secondary">Disabled</Badge>}</p>
          </div>
        </div>
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-3">Active Subscriptions ({subs.length})</h4>
          {subs.length === 0 ? (
            <div className="text-center py-6">
              <Key className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No subscriptions yet</p>
              <p className="text-xs text-muted-foreground mt-1">Create a plan first, then subscribe applications to it</p>
            </div>
          ) : (
            <div className="space-y-2">
              {subs.map(sub => (
                <div key={sub.id} className="border border-border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{sub.application_name}</span>
                      <Badge variant={sub.status === "active" ? "success" : sub.status === "suspended" ? "warning" : "destructive"}>{sub.status}</Badge>
                      {sub.plan_name && <span className="text-xs text-muted-foreground">on {sub.plan_name}</span>}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleToggleSubStatus(sub.id, sub.status, product.id)} title={sub.status === "active" ? "Suspend" : "Activate"}>
                        {sub.status === "active" ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteSubscription(sub.id, product.id)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <code className="text-xs bg-secondary px-2 py-1 rounded flex-1 break-all">{sub.api_key}</code>
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => copyToClipboard(sub.api_key, "sub")}>
                      {copiedSubKey === sub.api_key ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                  {sub.usage && (
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      <div className="bg-secondary/50 rounded px-2 py-1">
                        <span className="text-muted-foreground">Min: </span>
                        <span className="font-mono">{sub.usage.currentMinute}</span>
                      </div>
                      <div className="bg-secondary/50 rounded px-2 py-1">
                        <span className="text-muted-foreground">Hr: </span>
                        <span className="font-mono">{sub.usage.currentHour}</span>
                      </div>
                      <div className="bg-secondary/50 rounded px-2 py-1">
                        <span className="text-muted-foreground">Day: </span>
                        <span className="font-mono">{sub.usage.currentDay}</span>
                      </div>
                      <div className="bg-secondary/50 rounded px-2 py-1">
                        <span className="text-muted-foreground">Mon: </span>
                        <span className="font-mono">{sub.usage.currentMonth}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      <Backdrop open={loading} message={backdropMessage} />
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">API Products</h1>
          <p className="text-muted-foreground mt-1">Group APIs into products, enable MCP tools, and manage rate-limited plans</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4" /> Create Product
        </Button>
      </div>

      {products.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No products created</h3>
            <p className="text-muted-foreground text-sm mb-4">Create your first API product to group APIs and enable MCP tools</p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4" /> Create Product
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
                      {product.description && <CardDescription className="mt-1">{product.description}</CardDescription>}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary/50 border border-border">
                      <Cpu className="h-4 w-4 text-primary" />
                      <Toggle checked={!!product.mcp_enabled} onChange={() => handleToggleMcp(product)} label="MCP Tools" />
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(product.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {product.mcp_enabled && product.mcpServer && (
                  <div className="mb-4 p-3 rounded-md bg-primary/5 border border-primary/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="success">MCP Active</Badge>
                        <code className="text-xs text-muted-foreground">{product.mcpServer.endpoint}</code>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => { setActiveProduct(product); setShowMcpInfoDialog(true); }}>View Details</Button>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-1 mb-4 border-b border-border">
                  <button className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${getTab(product.id) === "apis" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`} onClick={() => setTab(product.id, "apis")}>
                    APIs ({product.apis.length})
                  </button>
                  <button className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${getTab(product.id) === "plans" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`} onClick={() => setTab(product.id, "plans")}>
                    Plans ({(productPlans[product.id] || []).length})
                  </button>
                  <button className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${getTab(product.id) === "usage" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`} onClick={() => setTab(product.id, "usage")}>
                    Usage & Subscriptions
                  </button>
                </div>
                {getTab(product.id) === "apis" && renderApisTab(product)}
                {getTab(product.id) === "plans" && renderPlansTab(product)}
                {getTab(product.id) === "usage" && renderUsageTab(product)}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Product Dialog */}
      <Dialog open={showCreateDialog} onClose={() => setShowCreateDialog(false)} title="Create API Product">
        <div className="space-y-4">
          <Input label="Product Name" id="prod-name" placeholder="e.g., User Management APIs" value={formName} onChange={(e) => setFormName(e.target.value)} />
          <Textarea label="Description (optional)" id="prod-desc" placeholder="Describe this API product..." value={formDescription} onChange={(e) => setFormDescription(e.target.value)} />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!formName.trim()}>Create Product</Button>
          </div>
        </div>
      </Dialog>

      {/* Assign API Dialog */}
      <Dialog open={showAssignDialog} onClose={() => setShowAssignDialog(false)} title={`Assign API to ${activeProduct?.name || ""}`}>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {availableApis.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No available APIs to assign.</p>
          ) : (
            availableApis.map((api) => (
              <button key={api.id} onClick={() => handleAssignApi(api.id)} className="w-full flex items-center gap-3 p-3 rounded-md hover:bg-secondary/50 transition-colors text-left border border-border">
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${methodColors[api.method] || "bg-muted"}`}>{api.method}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium">{api.name}</p>
                  <p className="text-xs text-muted-foreground">{api.path}</p>
                </div>
                {api.gateway_name && <Badge variant="outline" className="text-xs">{api.gateway_name}</Badge>}
              </button>
            ))
          )}
        </div>
      </Dialog>

      {/* MCP Server Info Dialog */}
      <Dialog open={showMcpInfoDialog} onClose={() => setShowMcpInfoDialog(false)} title="MCP Server Details">
        {activeProduct?.mcpServer && (
          <div className="space-y-4">
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">MCP Endpoint</label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 text-sm bg-secondary px-3 py-2 rounded-md">{window.location.origin}{activeProduct.mcpServer.endpoint}</code>
                  <Button variant="outline" size="icon" onClick={() => copyToClipboard(`${window.location.origin}${activeProduct.mcpServer!.endpoint}`)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">API Key</label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 text-sm bg-secondary px-3 py-2 rounded-md break-all">{activeProduct.mcpServer.api_key}</code>
                  <Button variant="outline" size="icon" onClick={() => copyToClipboard(activeProduct.mcpServer!.api_key)}>
                    {copiedKey ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Status</label>
                <div className="mt-1"><Badge variant="success">{activeProduct.mcpServer.status}</Badge></div>
              </div>
            </div>
          </div>
        )}
      </Dialog>

      {/* Create Plan Dialog */}
      <Dialog open={showCreatePlanDialog} onClose={() => setShowCreatePlanDialog(false)} title={`Create Plan for ${activeProduct?.name || ""}`}>
        <div className="space-y-4">
          <Input label="Plan Name" id="plan-name" placeholder="e.g., Free Tier, Pro, Enterprise" value={planName} onChange={(e) => setPlanName(e.target.value)} />
          <Textarea label="Description (optional)" id="plan-desc" placeholder="Describe this plan..." value={planDescription} onChange={(e) => setPlanDescription(e.target.value)} />
          <div className="border-t border-border pt-4">
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Shield className="h-4 w-4" /> Rate Limits <span className="text-xs text-muted-foreground font-normal">(0 = unlimited)</span>
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Requests / Minute" id="plan-rpm" type="number" placeholder="0" value={planRateMinute} onChange={(e) => setPlanRateMinute(e.target.value)} />
              <Input label="Requests / Hour" id="plan-rph" type="number" placeholder="0" value={planRateHour} onChange={(e) => setPlanRateHour(e.target.value)} />
              <Input label="Requests / Day" id="plan-rpd" type="number" placeholder="0" value={planRateDay} onChange={(e) => setPlanRateDay(e.target.value)} />
              <Input label="Monthly Quota" id="plan-qpm" type="number" placeholder="0" value={planQuotaMonth} onChange={(e) => setPlanQuotaMonth(e.target.value)} />
            </div>
            <div className="mt-3">
              <Input label="Burst Limit (concurrent)" id="plan-burst" type="number" placeholder="0" value={planBurstLimit} onChange={(e) => setPlanBurstLimit(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowCreatePlanDialog(false)}>Cancel</Button>
            <Button onClick={handleCreatePlan} disabled={!planName.trim()}>Create Plan</Button>
          </div>
        </div>
      </Dialog>

      {/* Subscribe Dialog */}
      <Dialog open={showSubscribeDialog} onClose={() => setShowSubscribeDialog(false)} title={`Subscribe to ${activePlan?.name || ""}`}>
        <div className="space-y-4">
          {activePlan && (
            <div className="p-3 rounded-md bg-secondary/50 border border-border text-xs space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Plan:</span> <span className="font-medium">{activePlan.name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Rate Limit (min):</span> <span>{formatLimit(activePlan.rate_limit_per_minute)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Rate Limit (hr):</span> <span>{formatLimit(activePlan.rate_limit_per_hour)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Rate Limit (day):</span> <span>{formatLimit(activePlan.rate_limit_per_day)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Monthly Quota:</span> <span>{formatLimit(activePlan.quota_per_month)}</span></div>
            </div>
          )}
          <Input label="Application Name" id="sub-app" placeholder="e.g., My Agent, Frontend App" value={subAppName} onChange={(e) => setSubAppName(e.target.value)} />
          <p className="text-xs text-muted-foreground">A unique API key will be generated. Use it in the X-API-Key header when calling MCP tools.</p>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowSubscribeDialog(false)}>Cancel</Button>
            <Button onClick={handleSubscribe} disabled={!subAppName.trim()}>
              <Key className="h-4 w-4" /> Subscribe & Generate Key
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
