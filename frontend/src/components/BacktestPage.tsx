import { useState } from "react";
import { BacktestForm } from "./BacktestForm";
import { BacktestResult } from "./BacktestResult";

export function BacktestPage() {
  const [jobId, setJobId] = useState<string | null>(null);

  return (
    <main className="main">
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
