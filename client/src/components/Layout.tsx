import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Server, Package, Cpu, Bot, Cloud, Boxes, Shield,
  ChevronDown, ChevronRight, Monitor, Globe, FileText,
  Clock, Activity, BarChart3, Tag, Zap, Building2,
} from "lucide-react";

// Collapsible nav section
function NavSection({
  label,
  icon: Icon,
  defaultOpen = false,
  children,
  isActive,
}: {
  label: string;
  icon: React.ElementType;
  defaultOpen?: boolean;
  children: React.ReactNode;
  isActive?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
          isActive
            ? "text-primary"
            : "text-muted-foreground hover:text-foreground hover:bg-accent"
        )}
      >
        <Icon className="h-4 w-4" />
        <span className="flex-1 text-left">{label}</span>
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 opacity-60" />
        )}
      </button>
      {open && <div className="ml-4 pl-3 border-l border-border/50 space-y-0.5 mt-0.5">{children}</div>}
    </div>
  );
}

// Sub-section (nested collapsible)
function NavSubSection({
  label,
  icon: Icon,
  defaultOpen = false,
  children,
  isActive,
}: {
  label: string;
  icon: React.ElementType;
  defaultOpen?: boolean;
  children: React.ReactNode;
  isActive?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs font-medium transition-colors",
          isActive
            ? "text-primary"
            : "text-muted-foreground hover:text-foreground hover:bg-accent"
        )}
      >
        <Icon className="h-3.5 w-3.5" />
        <span className="flex-1 text-left">{label}</span>
        {open ? (
          <ChevronDown className="h-3 w-3 opacity-60" />
        ) : (
          <ChevronRight className="h-3 w-3 opacity-60" />
        )}
      </button>
      {open && <div className="ml-3 pl-2.5 border-l border-border/40 space-y-0.5 mt-0.5">{children}</div>}
    </div>
  );
}

function NavLink({
  path,
  label,
  icon: Icon,
  currentPath,
  size = "normal",
}: {
  path: string;
  label: string;
  icon: React.ElementType;
  currentPath: string;
  size?: "normal" | "small";
}) {
  const isActive = currentPath === path;
  return (
    <Link
      to={path}
      className={cn(
        "flex items-center gap-3 rounded-md font-medium transition-colors",
        size === "small" ? "gap-2.5 px-2.5 py-2 text-xs" : "px-3 py-2.5 text-sm",
        isActive
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-accent"
      )}
    >
      <Icon className={size === "small" ? "h-3.5 w-3.5" : "h-4 w-4"} />
      {label}
    </Link>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const path = location.pathname;

  const isAgentsActive = path === "/agents" || path === "/cloud-agents" || path === "/agentcore" || path === "/agent-hub" || path === "/salesforce-agents" || path === "/copilot-agents" || path === "/devin-agents" || path === "/claude-agents";
  const isCloudActive = path === "/cloud-agents" || path === "/agentcore" || path === "/salesforce-agents" || path === "/copilot-agents" || path === "/claude-agents";
  const isDevinActive = path === "/devin-agents";
  const isAwsActive = path === "/cloud-agents" || path === "/agentcore" || path === "/claude-agents";
  const isSalesforceActive = path === "/salesforce-agents";
  const isCopilotActive = path === "/copilot-agents";
  const isGovernanceActive = path === "/governance" || path === "/governance/policies" || path === "/governance/lifecycle" || path === "/governance/audit-log" || path === "/governance/risk" || path === "/governance/reports";

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card flex flex-col">
        <div className="p-6 border-b border-border">
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Cpu className="h-5 w-5 text-primary" />
            <span>GSIC API Control Plane</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Gateway, MCP & Agent Governance</p>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {/* Top-level links */}
          <NavLink path="/" label="Gateways" icon={Server} currentPath={path} />
          <NavLink path="/apis" label="APIs" icon={Globe} currentPath={path} />
          <NavLink path="/products" label="Products" icon={Package} currentPath={path} />
          <NavLink path="/mcp" label="MCP and Tools" icon={Cpu} currentPath={path} />

          {/* Agents Section */}
          <NavSection label="Agents" icon={Bot} defaultOpen={isAgentsActive} isActive={isAgentsActive}>
            <NavLink path="/agent-hub" label="Agent Hub" icon={Zap} currentPath={path} size="small" />
            <NavLink path="/agents" label="Local Agents" icon={Monitor} currentPath={path} size="small" />

            <NavSubSection label="Cloud Agents" icon={Cloud} defaultOpen={isCloudActive} isActive={isCloudActive}>
              <NavSubSection label="AWS" icon={Globe} defaultOpen={isAwsActive} isActive={isAwsActive}>
                <NavLink path="/cloud-agents" label="Bedrock" icon={Cloud} currentPath={path} size="small" />
                <NavLink path="/agentcore" label="AgentCore" icon={Boxes} currentPath={path} size="small" />
                <NavLink path="/claude-agents" label="Claude" icon={Cpu} currentPath={path} size="small" />
              </NavSubSection>
              <NavLink path="/salesforce-agents" label="Salesforce" icon={Cloud} currentPath={path} size="small" />
              <NavLink path="/copilot-agents" label="Microsoft" icon={Building2} currentPath={path} size="small" />
              <NavLink path="/devin-agents" label="Devin" icon={Bot} currentPath={path} size="small" />
            </NavSubSection>
          </NavSection>

          {/* Governance Section */}
          <NavSection label="Governance" icon={Shield} defaultOpen={isGovernanceActive} isActive={isGovernanceActive}>
            <NavLink path="/governance" label="APIs" icon={Globe} currentPath={path} size="small" />
            <NavLink path="/governance/policies" label="Policies" icon={Shield} currentPath={path} size="small" />
            <NavLink path="/governance/lifecycle" label="Lifecycle" icon={Clock} currentPath={path} size="small" />
            <NavLink path="/governance/audit-log" label="Audit Log" icon={FileText} currentPath={path} size="small" />
            <NavLink path="/governance/risk" label="Risk Assessment" icon={Activity} currentPath={path} size="small" />
            <NavLink path="/governance/reports" label="Reports" icon={BarChart3} currentPath={path} size="small" />
          </NavSection>
        </nav>

        <div className="p-4 border-t border-border">
          <div className="text-xs text-muted-foreground">
            <p>GSIC API Control Plane</p>
            <p className="mt-1">v1.0.0</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
