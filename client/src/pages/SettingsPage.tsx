import { useState, useEffect, useCallback } from "react";
import { settingsApi } from "@/lib/api";
import type { SettingsUser, SettingsApiKey, AppSetting, SettingsWebhook, SettingsAuditEntry, SystemInfo } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { Backdrop } from "@/components/Backdrop";
import {
  Settings, Users, Key, Bell, Shield, Palette, Database,
  Plus, Trash2, Edit2, RefreshCw, Copy, Check, X,
  Eye, EyeOff, AlertTriangle, Clock, Server,
  FileText, Activity, ChevronDown, ChevronRight,
  Webhook, TestTube2, Save,
} from "lucide-react";

type SettingsTab = 'general' | 'users' | 'apikeys' | 'notifications' | 'security' | 'appearance' | 'data' | 'webhooks' | 'audit' | 'system';

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    admin: "bg-red-500/10 text-red-400 border-red-500/30",
    editor: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    operator: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    viewer: "bg-gray-500/10 text-gray-400 border-gray-500/30",
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${colors[role] || colors.viewer}`}>{role}</span>;
}

function StatusDot({ status }: { status: string }) {
  const color = status === 'active' ? 'bg-emerald-400' : status === 'inactive' ? 'bg-gray-400' : 'bg-red-400';
  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />;
}

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  // Data states
  const [users, setUsers] = useState<SettingsUser[]>([]);
  const [userStats, setUserStats] = useState<{ total: number; active: number; inactive: number; admins: number; mfaEnabled: number } | null>(null);
  const [apiKeys, setApiKeys] = useState<SettingsApiKey[]>([]);
  const [appSettings, setAppSettings] = useState<Record<string, AppSetting[]>>({});
  const [webhooks, setWebhooks] = useState<SettingsWebhook[]>([]);
  const [auditLog, setAuditLog] = useState<SettingsAuditEntry[]>([]);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(false);

  // Form states
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showCreateApiKey, setShowCreateApiKey] = useState(false);
  const [showCreateWebhook, setShowCreateWebhook] = useState(false);
  const [editingUser, setEditingUser] = useState<SettingsUser | null>(null);

  // User form
  const [formUserName, setFormUserName] = useState("");
  const [formUserEmail, setFormUserEmail] = useState("");
  const [formUserRole, setFormUserRole] = useState("viewer");

  // API Key form
  const [formKeyName, setFormKeyName] = useState("");
  const [formKeyScopes, setFormKeyScopes] = useState("read");
  const [formKeyRateLimit, setFormKeyRateLimit] = useState("1000");
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Webhook form
  const [formWebhookName, setFormWebhookName] = useState("");
  const [formWebhookUrl, setFormWebhookUrl] = useState("");
  const [formWebhookEvents, setFormWebhookEvents] = useState("");

  // Settings edit state
  const [editedSettings, setEditedSettings] = useState<Record<string, string>>({});
  const [savingSettings, setSavingSettings] = useState(false);

  const fetchTabData = useCallback(async (tab: SettingsTab) => {
    setLoading(true);
    try {
      switch (tab) {
        case 'general':
        case 'security':
        case 'notifications':
        case 'appearance':
        case 'data': {
          const settings = await settingsApi.getAllSettings();
          setAppSettings(settings);
          break;
        }
        case 'users': {
          const [u, stats] = await Promise.all([settingsApi.listUsers(), settingsApi.getUserStats()]);
          setUsers(u);
          setUserStats(stats);
          break;
        }
        case 'apikeys': {
          const keys = await settingsApi.listApiKeys();
          setApiKeys(keys);
          break;
        }
        case 'webhooks': {
          const wh = await settingsApi.listWebhooks();
          setWebhooks(wh);
          break;
        }
        case 'audit': {
          const logs = await settingsApi.getAuditLog(100);
          setAuditLog(logs);
          break;
        }
        case 'system': {
          const info = await settingsApi.getSystemInfo();
          setSystemInfo(info);
          break;
        }
      }
    } catch (err) {
      console.error("Failed to load settings data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTabData(activeTab);
  }, [activeTab, fetchTabData]);

  // ==================== HANDLERS ====================

  const handleCreateUser = async () => {
    if (!formUserEmail || !formUserName) return;
    try {
      await settingsApi.createUser({ email: formUserEmail, name: formUserName, role: formUserRole });
      setShowCreateUser(false);
      setFormUserName(""); setFormUserEmail(""); setFormUserRole("viewer");
      await fetchTabData('users');
    } catch (err) {
      console.error("Failed to create user:", err);
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    try {
      await settingsApi.updateUser(editingUser.id, {
        name: formUserName,
        email: formUserEmail,
        role: formUserRole as SettingsUser['role'],
      });
      setEditingUser(null);
      setFormUserName(""); setFormUserEmail(""); setFormUserRole("viewer");
      await fetchTabData('users');
    } catch (err) {
      console.error("Failed to update user:", err);
    }
  };

  const handleDeleteUser = async (id: string) => {
    try {
      await settingsApi.deleteUser(id);
      await fetchTabData('users');
    } catch (err) {
      console.error("Failed to delete user:", err);
    }
  };

  const handleToggleUserStatus = async (user: SettingsUser) => {
    try {
      await settingsApi.updateUser(user.id, { status: user.status === 'active' ? 'inactive' : 'active' });
      await fetchTabData('users');
    } catch (err) {
      console.error("Failed to toggle user status:", err);
    }
  };

  const handleCreateApiKey = async () => {
    if (!formKeyName) return;
    try {
      const result = await settingsApi.createApiKey({
        name: formKeyName,
        scopes: formKeyScopes.split(',').map(s => s.trim()),
        rateLimit: parseInt(formKeyRateLimit) || 1000,
      });
      setNewlyCreatedKey(result.key);
      setFormKeyName(""); setFormKeyScopes("read"); setFormKeyRateLimit("1000");
      await fetchTabData('apikeys');
    } catch (err) {
      console.error("Failed to create API key:", err);
    }
  };

  const handleRevokeApiKey = async (id: string) => {
    try {
      await settingsApi.revokeApiKey(id);
      await fetchTabData('apikeys');
    } catch (err) {
      console.error("Failed to revoke API key:", err);
    }
  };

  const handleDeleteApiKey = async (id: string) => {
    try {
      await settingsApi.deleteApiKey(id);
      await fetchTabData('apikeys');
    } catch (err) {
      console.error("Failed to delete API key:", err);
    }
  };

  const handleCopyKey = () => {
    if (newlyCreatedKey) {
      navigator.clipboard.writeText(newlyCreatedKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const handleCreateWebhook = async () => {
    if (!formWebhookName || !formWebhookUrl) return;
    try {
      await settingsApi.createWebhook({
        name: formWebhookName,
        url: formWebhookUrl,
        events: formWebhookEvents ? formWebhookEvents.split(',').map(s => s.trim()) : [],
      });
      setShowCreateWebhook(false);
      setFormWebhookName(""); setFormWebhookUrl(""); setFormWebhookEvents("");
      await fetchTabData('webhooks');
    } catch (err) {
      console.error("Failed to create webhook:", err);
    }
  };

  const handleTestWebhook = async (id: string) => {
    try {
      await settingsApi.testWebhook(id);
      await fetchTabData('webhooks');
    } catch (err) {
      console.error("Failed to test webhook:", err);
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    try {
      await settingsApi.deleteWebhook(id);
      await fetchTabData('webhooks');
    } catch (err) {
      console.error("Failed to delete webhook:", err);
    }
  };

  const handleSettingChange = (key: string, value: string) => {
    setEditedSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveSettings = async (category: string) => {
    const updates = Object.entries(editedSettings)
      .filter(([k]) => k.startsWith(category + '.'))
      .map(([key, value]) => ({ key, value }));
    if (updates.length === 0) return;
    setSavingSettings(true);
    try {
      await settingsApi.updateSettingsBatch(updates);
      setEditedSettings(prev => {
        const next = { ...prev };
        for (const u of updates) delete next[u.key];
        return next;
      });
      await fetchTabData(activeTab);
    } catch (err) {
      console.error("Failed to save settings:", err);
    } finally {
      setSavingSettings(false);
    }
  };

  const getSettingValue = (setting: AppSetting) => {
    return editedSettings[setting.key] !== undefined ? editedSettings[setting.key] : setting.value;
  };

  const hasUnsavedChanges = (category: string) => {
    return Object.keys(editedSettings).some(k => k.startsWith(category + '.'));
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  // ==================== TAB NAVIGATION ====================

  const tabs: Array<{ id: SettingsTab; label: string; icon: React.ElementType }> = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'users', label: 'Users & Roles', icon: Users },
    { id: 'apikeys', label: 'API Keys', icon: Key },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'webhooks', label: 'Webhooks', icon: Webhook },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'data', label: 'Data & Storage', icon: Database },
    { id: 'audit', label: 'Audit Log', icon: FileText },
    { id: 'system', label: 'System Info', icon: Server },
  ];

  // ==================== SETTINGS CATEGORY RENDERER ====================

  const renderSettingsCategory = (category: string, title: string, icon: React.ElementType) => {
    const Icon = icon;
    const settings = appSettings[category] || [];
    if (settings.length === 0) return null;

    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Icon className="h-4 w-4 text-primary" />
              {title}
            </CardTitle>
            {hasUnsavedChanges(category) && (
              <Button size="sm" onClick={() => handleSaveSettings(category)} disabled={savingSettings}>
                <Save className="h-3.5 w-3.5 mr-1" />
                {savingSettings ? 'Saving...' : 'Save Changes'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {settings.map(setting => {
              const keyLabel = setting.key.split('.').slice(1).join(' ').replace(/_/g, ' ');
              const isBool = setting.value === 'true' || setting.value === 'false';
              const isNumber = !isNaN(Number(setting.value)) && setting.value !== '';

              return (
                <div key={setting.key} className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <label className="text-sm font-medium capitalize">{keyLabel}</label>
                    {setting.description && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">{setting.description}</p>
                    )}
                  </div>
                  <div className="w-64 flex-shrink-0">
                    {isBool ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={getSettingValue(setting) === 'true'}
                          onChange={(e) => handleSettingChange(setting.key, e.target.checked ? 'true' : 'false')}
                          className="h-4 w-4 rounded border-border bg-background"
                        />
                        <span className="text-xs text-muted-foreground">
                          {getSettingValue(setting) === 'true' ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    ) : isNumber ? (
                      <Input
                        type="number"
                        value={getSettingValue(setting)}
                        onChange={(e) => handleSettingChange(setting.key, e.target.value)}
                        className="h-8 text-sm"
                      />
                    ) : (
                      <Input
                        value={getSettingValue(setting)}
                        onChange={(e) => handleSettingChange(setting.key, e.target.value)}
                        className="h-8 text-sm"
                        placeholder={setting.description || ''}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  };

  // ==================== RENDER ====================

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6 text-primary" />
            Settings
          </h1>
          <p className="text-muted-foreground mt-1">Manage application configuration, users, security, and more</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-border pb-2 mb-6 overflow-x-auto">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                activeTab === tab.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* ==================== GENERAL TAB ==================== */}
      {!loading && activeTab === 'general' && renderSettingsCategory('general', 'General Settings', Settings)}

      {/* ==================== SECURITY TAB ==================== */}
      {!loading && activeTab === 'security' && renderSettingsCategory('security', 'Security Settings', Shield)}

      {/* ==================== NOTIFICATIONS TAB ==================== */}
      {!loading && activeTab === 'notifications' && renderSettingsCategory('notifications', 'Notification Settings', Bell)}

      {/* ==================== APPEARANCE TAB ==================== */}
      {!loading && activeTab === 'appearance' && renderSettingsCategory('appearance', 'Appearance Settings', Palette)}

      {/* ==================== DATA TAB ==================== */}
      {!loading && activeTab === 'data' && renderSettingsCategory('data', 'Data & Storage Settings', Database)}

      {/* ==================== USERS TAB ==================== */}
      {!loading && activeTab === 'users' && (
        <div className="space-y-4">
          {/* User Stats */}
          {userStats && (
            <div className="grid grid-cols-5 gap-3">
              <div className="bg-secondary/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Total Users</span>
                </div>
                <p className="text-xl font-bold">{userStats.total}</p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Check className="h-4 w-4 text-emerald-400" />
                  <span className="text-xs text-muted-foreground">Active</span>
                </div>
                <p className="text-xl font-bold text-emerald-400">{userStats.active}</p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <X className="h-4 w-4 text-gray-400" />
                  <span className="text-xs text-muted-foreground">Inactive</span>
                </div>
                <p className="text-xl font-bold text-gray-400">{userStats.inactive}</p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="h-4 w-4 text-red-400" />
                  <span className="text-xs text-muted-foreground">Admins</span>
                </div>
                <p className="text-xl font-bold text-red-400">{userStats.admins}</p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Key className="h-4 w-4 text-amber-400" />
                  <span className="text-xs text-muted-foreground">MFA Enabled</span>
                </div>
                <p className="text-xl font-bold text-amber-400">{userStats.mfaEnabled}</p>
              </div>
            </div>
          )}

          {/* User List */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Users
                </CardTitle>
                <Button size="sm" onClick={() => { setShowCreateUser(true); setFormUserName(""); setFormUserEmail(""); setFormUserRole("viewer"); }}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add User
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {users.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">No users found</p>
              ) : (
                <div className="space-y-2">
                  {users.map(user => (
                    <div key={user.id} className="flex items-center justify-between p-3 bg-secondary/30 rounded-md">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{user.name}</span>
                            <RoleBadge role={user.role} />
                            <StatusDot status={user.status} />
                          </div>
                          <span className="text-xs text-muted-foreground">{user.email}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {user.mfa_enabled ? (
                          <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30">MFA</Badge>
                        ) : null}
                        <span className="text-[10px] text-muted-foreground">
                          {user.last_login ? `Last login: ${new Date(user.last_login).toLocaleDateString()}` : 'Never logged in'}
                        </span>
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleToggleUserStatus(user)}>
                          {user.status === 'active' ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => {
                          setEditingUser(user); setFormUserName(user.name); setFormUserEmail(user.email); setFormUserRole(user.role);
                        }}>
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 text-xs text-red-400" onClick={() => handleDeleteUser(user.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ==================== API KEYS TAB ==================== */}
      {!loading && activeTab === 'apikeys' && (
        <div className="space-y-4">
          {/* Newly created key alert */}
          {newlyCreatedKey && (
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-400" />
                  <div>
                    <p className="text-sm font-medium text-amber-400">API Key Created — Copy it now!</p>
                    <p className="text-xs text-muted-foreground mt-0.5">This key will not be shown again.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-secondary px-3 py-1.5 rounded font-mono">{newlyCreatedKey}</code>
                  <Button size="sm" variant="outline" onClick={handleCopyKey}>
                    {copiedKey ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setNewlyCreatedKey(null)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Key className="h-4 w-4 text-primary" />
                    API Keys
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">Manage API keys for programmatic access</CardDescription>
                </div>
                <Button size="sm" onClick={() => { setShowCreateApiKey(true); setFormKeyName(""); setFormKeyScopes("read"); setFormKeyRateLimit("1000"); }}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Create API Key
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {apiKeys.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">No API keys created</p>
              ) : (
                <div className="space-y-2">
                  {apiKeys.map(key => (
                    <div key={key.id} className="flex items-center justify-between p-3 bg-secondary/30 rounded-md">
                      <div className="flex items-center gap-3">
                        <Key className={`h-4 w-4 ${key.status === 'active' ? 'text-primary' : 'text-gray-500'}`} />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{key.name}</span>
                            <Badge variant={key.status === 'active' ? 'default' : 'destructive'} className="text-[10px]">{key.status}</Badge>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            <code className="text-[10px] text-muted-foreground font-mono">{key.key_prefix}••••••••</code>
                            <span className="text-[10px] text-muted-foreground">
                              Scopes: {key.scopes.join(', ')}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              Rate: {key.rate_limit}/min
                            </span>
                            {key.user_name && (
                              <span className="text-[10px] text-muted-foreground">Owner: {key.user_name}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">
                          Created {new Date(key.created_at).toLocaleDateString()}
                        </span>
                        {key.status === 'active' && (
                          <Button variant="outline" size="sm" className="h-7 text-xs text-amber-400" onClick={() => handleRevokeApiKey(key.id)}>
                            Revoke
                          </Button>
                        )}
                        <Button variant="outline" size="sm" className="h-7 text-xs text-red-400" onClick={() => handleDeleteApiKey(key.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ==================== WEBHOOKS TAB ==================== */}
      {!loading && activeTab === 'webhooks' && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Webhook className="h-4 w-4 text-primary" />
                  Webhooks
                </CardTitle>
                <CardDescription className="text-xs mt-1">Configure event-driven notifications to external services</CardDescription>
              </div>
              <Button size="sm" onClick={() => { setShowCreateWebhook(true); setFormWebhookName(""); setFormWebhookUrl(""); setFormWebhookEvents(""); }}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Webhook
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {webhooks.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">No webhooks configured</p>
            ) : (
              <div className="space-y-2">
                {webhooks.map(wh => (
                  <div key={wh.id} className="flex items-center justify-between p-3 bg-secondary/30 rounded-md">
                    <div className="flex items-center gap-3">
                      <Webhook className={`h-4 w-4 ${wh.status === 'active' ? 'text-primary' : 'text-gray-500'}`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{wh.name}</span>
                          <Badge variant={wh.status === 'active' ? 'default' : 'outline'} className="text-[10px]">{wh.status}</Badge>
                          {wh.failure_count > 0 && (
                            <Badge variant="destructive" className="text-[10px]">{wh.failure_count} failures</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <code className="text-[10px] text-muted-foreground">{wh.url}</code>
                          {wh.events.length > 0 && (
                            <span className="text-[10px] text-muted-foreground">Events: {wh.events.join(', ')}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {wh.last_triggered && (
                        <span className="text-[10px] text-muted-foreground">
                          Last: {new Date(wh.last_triggered).toLocaleString()}
                        </span>
                      )}
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleTestWebhook(wh.id)}>
                        <TestTube2 className="h-3 w-3 mr-1" />
                        Test
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 text-xs text-red-400" onClick={() => handleDeleteWebhook(wh.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ==================== AUDIT LOG TAB ==================== */}
      {!loading && activeTab === 'audit' && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Settings Audit Log
                </CardTitle>
                <CardDescription className="text-xs mt-1">Track all changes to settings, users, and API keys</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => fetchTabData('audit')}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {auditLog.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">No audit entries yet</p>
            ) : (
              <div className="space-y-1.5">
                {auditLog.map(entry => (
                  <div key={entry.id} className="flex items-center justify-between p-2.5 bg-secondary/20 rounded-md">
                    <div className="flex items-center gap-3">
                      <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium">{entry.action}</span>
                          {entry.category && <Badge variant="outline" className="text-[10px]">{entry.category}</Badge>}
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          by {entry.user_name} | {JSON.stringify(entry.details).slice(0, 100)}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {new Date(entry.created_at).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ==================== SYSTEM INFO TAB ==================== */}
      {!loading && activeTab === 'system' && systemInfo && (
        <div className="space-y-4">
          {/* System Stats */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-secondary/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <Server className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">Version</span>
              </div>
              <p className="text-lg font-bold">{systemInfo.version}</p>
              <p className="text-[10px] text-muted-foreground">{systemInfo.environment}</p>
            </div>
            <div className="bg-secondary/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-emerald-400" />
                <span className="text-xs text-muted-foreground">Uptime</span>
              </div>
              <p className="text-lg font-bold">{formatUptime(systemInfo.uptime)}</p>
              <p className="text-[10px] text-muted-foreground">Node {systemInfo.nodeVersion}</p>
            </div>
            <div className="bg-secondary/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <Activity className="h-4 w-4 text-amber-400" />
                <span className="text-xs text-muted-foreground">Memory</span>
              </div>
              <p className="text-lg font-bold">{formatBytes(systemInfo.memoryUsage.heapUsed)}</p>
              <p className="text-[10px] text-muted-foreground">of {formatBytes(systemInfo.memoryUsage.heapTotal)} heap</p>
            </div>
            <div className="bg-secondary/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <Database className="h-4 w-4 text-blue-400" />
                <span className="text-xs text-muted-foreground">Database</span>
              </div>
              <p className="text-lg font-bold">{formatBytes(systemInfo.databaseSize)}</p>
              <p className="text-[10px] text-muted-foreground">{systemInfo.platform}</p>
            </div>
          </div>

          {/* Table Counts */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Database className="h-4 w-4 text-primary" />
                Database Tables
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(systemInfo.tableCounts).map(([table, count]) => (
                  <div key={table} className="flex items-center justify-between p-2.5 bg-secondary/30 rounded-md">
                    <span className="text-xs font-medium">{table}</span>
                    <Badge variant="outline" className="text-[10px]">{count} rows</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Memory breakdown */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Memory Usage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { label: 'RSS (Resident Set)', value: systemInfo.memoryUsage.rss },
                  { label: 'Heap Total', value: systemInfo.memoryUsage.heapTotal },
                  { label: 'Heap Used', value: systemInfo.memoryUsage.heapUsed },
                  { label: 'External', value: systemInfo.memoryUsage.external },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{item.label}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-40 bg-secondary rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-primary h-full rounded-full"
                          style={{ width: `${Math.min(100, (item.value / systemInfo.memoryUsage.rss) * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium w-20 text-right">{formatBytes(item.value)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ==================== DIALOGS ==================== */}

      {/* Create User Dialog */}
      {(showCreateUser || editingUser) && (
        <>
          <Backdrop onClick={() => { setShowCreateUser(false); setEditingUser(null); }} />
          <Dialog>
            <h2 className="text-lg font-semibold mb-4">{editingUser ? 'Edit User' : 'Add User'}</h2>
            <button onClick={() => { setShowCreateUser(false); setEditingUser(null); }} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
            <div className="space-y-4">
              <Input label="Full Name" placeholder="John Doe" value={formUserName} onChange={(e) => setFormUserName(e.target.value)} />
              <Input label="Email" type="email" placeholder="john@company.com" value={formUserEmail} onChange={(e) => setFormUserEmail(e.target.value)} />
              <Select
                label="Role"
                value={formUserRole}
                onChange={(e) => setFormUserRole(e.target.value)}
                options={[
                  { value: 'viewer', label: 'Viewer — Read-only access' },
                  { value: 'operator', label: 'Operator — Run agents and tools' },
                  { value: 'editor', label: 'Editor — Create and modify resources' },
                  { value: 'admin', label: 'Admin — Full access' },
                ]}
              />
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => { setShowCreateUser(false); setEditingUser(null); }}>Cancel</Button>
                <Button className="flex-1" onClick={editingUser ? handleUpdateUser : handleCreateUser} disabled={!formUserName || !formUserEmail}>
                  {editingUser ? 'Update User' : 'Add User'}
                </Button>
              </div>
            </div>
          </Dialog>
        </>
      )}

      {/* Create API Key Dialog */}
      {showCreateApiKey && (
        <>
          <Backdrop onClick={() => setShowCreateApiKey(false)} />
          <Dialog>
            <h2 className="text-lg font-semibold mb-4">Create API Key</h2>
            <button onClick={() => setShowCreateApiKey(false)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
            <div className="space-y-4">
              <Input label="Key Name" placeholder="Production API Key" value={formKeyName} onChange={(e) => setFormKeyName(e.target.value)} />
              <Input label="Scopes (comma-separated)" placeholder="read, write, admin" value={formKeyScopes} onChange={(e) => setFormKeyScopes(e.target.value)} />
              <Input label="Rate Limit (requests/min)" type="number" value={formKeyRateLimit} onChange={(e) => setFormKeyRateLimit(e.target.value)} />
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowCreateApiKey(false)}>Cancel</Button>
                <Button className="flex-1" onClick={handleCreateApiKey} disabled={!formKeyName}>
                  Create Key
                </Button>
              </div>
            </div>
          </Dialog>
        </>
      )}

      {/* Create Webhook Dialog */}
      {showCreateWebhook && (
        <>
          <Backdrop onClick={() => setShowCreateWebhook(false)} />
          <Dialog>
            <h2 className="text-lg font-semibold mb-4">Add Webhook</h2>
            <button onClick={() => setShowCreateWebhook(false)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
            <div className="space-y-4">
              <Input label="Webhook Name" placeholder="Slack Notification" value={formWebhookName} onChange={(e) => setFormWebhookName(e.target.value)} />
              <Input label="URL" placeholder="https://hooks.slack.com/..." value={formWebhookUrl} onChange={(e) => setFormWebhookUrl(e.target.value)} />
              <Input label="Events (comma-separated)" placeholder="agent.error, agent.disabled, api.violation" value={formWebhookEvents} onChange={(e) => setFormWebhookEvents(e.target.value)} />
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowCreateWebhook(false)}>Cancel</Button>
                <Button className="flex-1" onClick={handleCreateWebhook} disabled={!formWebhookName || !formWebhookUrl}>
                  Add Webhook
                </Button>
              </div>
            </div>
          </Dialog>
        </>
      )}
    </div>
  );
}
