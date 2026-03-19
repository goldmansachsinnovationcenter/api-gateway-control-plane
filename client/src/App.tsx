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

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<GatewaysPage />} />
          <Route path="/apis" element={<ApisPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/mcp" element={<McpTestingPage />} />
          <Route path="/agents" element={<AgentsPage />} />
          <Route path="/cloud-agents" element={<CloudAgentsPage />} />
          <Route path="/agentcore" element={<AgentCorePage />} />
          <Route path="/governance" element={<GovernancePage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App
