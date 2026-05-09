import React from "react";

export function EmptyView({ loading }: { loading: boolean }) {
  return (
    <div style={{ padding: "2rem", opacity: 0.6, fontFamily: "var(--vscode-font-family)" }}>
      {loading ? "Analyzing…" : "Open a Python file and run Meridian: Analyze Current File."}
    </div>
  );
}
