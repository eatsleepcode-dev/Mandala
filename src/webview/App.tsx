import React, { useEffect, useState } from "react";
import { MetricsView } from "./components/MetricsView";
import { ErrorView } from "./components/ErrorView";
import { EmptyView } from "./components/EmptyView";

type Metrics = {
  file: string;
  raw: { loc: number; sloc: number; comments: number; blank: number };
  maintainability: { score: number; rank: string };
  complexity: { name: string; type: string; complexity: number; rank: string; lineno: number }[];
};

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "data"; metrics: Metrics }
  | { status: "error"; text: string };

declare function acquireVsCodeApi(): {
  postMessage(msg: unknown): void;
};

const vscode = acquireVsCodeApi();

export function App() {
  const [state, setState] = useState<State>({ status: "idle" });

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.command === "metrics") {
        setState({ status: "data", metrics: msg.data });
      } else if (msg.command === "error") {
        setState({ status: "error", text: msg.text });
      } else if (msg.command === "loading") {
        setState({ status: "loading" });
      }
    };

    window.addEventListener("message", handler);
    vscode.postMessage({ command: "ready" });
    return () => window.removeEventListener("message", handler);
  }, []);

  if (state.status === "idle" || state.status === "loading") {
    return <EmptyView loading={state.status === "loading"} />;
  }
  if (state.status === "error") {
    return <ErrorView text={state.text} />;
  }
  return <MetricsView metrics={state.metrics} />;
}
