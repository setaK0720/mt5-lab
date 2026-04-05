import { useState } from "react";
import { AnalysisPage } from "./components/AnalysisPage";
import { DataManagerPage } from "./components/DataManagerPage";
import { ResearchPage } from "./components/ResearchPage";
import { Sidebar } from "./components/Sidebar";

type Page = "analysis" | "research" | "data";

export default function App() {
  const [page, setPage] = useState<Page>("analysis");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function handleNavigate(p: Page) {
    setPage(p);
    setSidebarOpen(false);
  }

  return (
    <div className="app">
      <Sidebar
        currentPage={page}
        onNavigate={handleNavigate}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen((v) => !v)}
      />
      <div className="app-body">
        {page === "analysis" && <AnalysisPage />}
        {page === "research" && <ResearchPage />}
        {page === "data"     && <DataManagerPage />}
      </div>
    </div>
  );
}
