import React from "react";

export function ErrorView({ text }: { text: string }) {
  return (
    <div style={{ padding: "2rem", color: "var(--vscode-errorForeground)", fontFamily: "var(--vscode-font-family)" }}>
      <strong>Error</strong>
      <pre style={{ marginTop: "0.5rem", whiteSpace: "pre-wrap" }}>{text}</pre>
    </div>
  );
}
