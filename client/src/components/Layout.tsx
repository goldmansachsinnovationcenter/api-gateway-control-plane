import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Server, Globe, Package, Cpu, Bot } from "lucide-react";

const navItems = [
  { path: "/", label: "Gateways", icon: Server },
  { path: "/apis", label: "APIs", icon: Globe },
  { path: "/products", label: "Products", icon: Package },
  { path: "/mcp", label: "MCP Testing", icon: Cpu },
  { path: "/agents", label: "Agents", icon: Bot },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card flex flex-col">
        <div className="p-6 border-b border-border">
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Cpu className="h-5 w-5 text-primary" />
            <span>API Control Plane</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Gateway & MCP Management</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="text-xs text-muted-foreground">
            <p>Agent Governance Platform</p>
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
