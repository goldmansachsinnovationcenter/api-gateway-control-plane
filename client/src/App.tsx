import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { GatewaysPage } from "@/pages/GatewaysPage";
import { ApisPage } from "@/pages/ApisPage";
import { ProductsPage } from "@/pages/ProductsPage";
import { McpTestingPage } from "@/pages/McpTestingPage";
import { AgentsPage } from "@/pages/AgentsPage";
import { CloudAgentsPage } from "@/pages/CloudAgentsPage";
import { AgentCorePage } from "@/pages/AgentCorePage";
import { GovernancePage } from "@/pages/GovernancePage";
import { PoliciesPage } from "@/pages/PoliciesPage";
import { LifecyclePage } from "@/pages/LifecyclePage";
import { AuditLogPage } from "@/pages/AuditLogPage";
import { RiskDashboardPage } from "@/pages/RiskDashboardPage";
import { ReportsPage } from "@/pages/ReportsPage";
import { AgentHubPage } from "@/pages/AgentHubPage";
import { SalesforceAgentsPage } from "@/pages/SalesforceAgentsPage";
import { CopilotAgentsPage } from "@/pages/CopilotAgentsPage";
import { DevinAgentsPage } from "@/pages/DevinAgentsPage";
import { ClaudeAgentsPage } from "@/pages/ClaudeAgentsPage";
import { AgentGovernanceDashboard } from "@/pages/AgentGovernanceDashboard";
import { SettingsPage } from "@/pages/SettingsPage";

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<GatewaysPage />} />
          <Route path="/apis" element={<ApisPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/mcp" element={<McpTestingPage />} />
          <Route path="/agent-hub" element={<AgentHubPage />} />
          <Route path="/agents" element={<AgentsPage />} />
          <Route path="/cloud-agents" element={<CloudAgentsPage />} />
          <Route path="/agentcore" element={<AgentCorePage />} />
          <Route path="/salesforce-agents" element={<SalesforceAgentsPage />} />
          <Route path="/copilot-agents" element={<CopilotAgentsPage />} />
          <Route path="/devin-agents" element={<DevinAgentsPage />} />
          <Route path="/claude-agents" element={<ClaudeAgentsPage />} />
          <Route path="/agent-governance" element={<AgentGovernanceDashboard />} />
          <Route path="/governance" element={<GovernancePage />} />
          <Route path="/governance/policies" element={<PoliciesPage />} />
          <Route path="/governance/lifecycle" element={<LifecyclePage />} />
          <Route path="/governance/audit-log" element={<AuditLogPage />} />
          <Route path="/governance/risk" element={<RiskDashboardPage />} />
          <Route path="/governance/reports" element={<ReportsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App
