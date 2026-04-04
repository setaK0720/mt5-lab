import { useState } from "react";
import { BacktestForm } from "./BacktestForm";
import { BacktestResult } from "./BacktestResult";
import { ChartPanel } from "./ChartPanel";

export function AnalysisPage() {
  const [jobId, setJobId] = useState<string | null>(null);

  return (
    <main className="main">
      <section className="section">
        <h2>価格チャート</h2>
        <ChartPanel />
      </section>
      <section className="section">
        <h2>バックテスト</h2>
        <div className="backtest-layout">
          <BacktestForm onJobStarted={(id) => setJobId(id)} />
          <BacktestResult jobId={jobId} />
        </div>
      </section>
    </main>
  );
}
