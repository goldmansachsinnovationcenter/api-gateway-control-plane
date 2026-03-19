import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { GatewaysPage } from "@/pages/GatewaysPage";
import { ApisPage } from "@/pages/ApisPage";
import { ProductsPage } from "@/pages/ProductsPage";
import { McpTestingPage } from "@/pages/McpTestingPage";

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<GatewaysPage />} />
          <Route path="/apis" element={<ApisPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/mcp" element={<McpTestingPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App
