import { useEffect, useState } from "react";
import { listSymbols } from "../api";

const FALLBACK = ["EURUSD", "USDJPY", "GBPUSD", "AUDUSD", "USDCHF", "EURJPY", "GBPJPY"];

export function useSymbols() {
  const [symbols, setSymbols] = useState<string[]>(FALLBACK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listSymbols()
      .then((s) => { if (s.length > 0) setSymbols(s); })
      .catch(() => { /* MT5未接続時はフォールバックを使用 */ })
      .finally(() => setLoading(false));
  }, []);

  return { symbols, loading };
}
