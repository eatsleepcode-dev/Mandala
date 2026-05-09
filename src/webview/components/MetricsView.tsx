import React from "react";

type Block = {
  name: string;
  type: string;
  complexity: number;
  rank: string;
  lineno: number;
};

type Metrics = {
  file: string;
  raw: { loc: number; sloc: number; comments: number; blank: number };
  maintainability: { score: number; rank: string };
  complexity: Block[];
};

const RANK_COLORS: Record<string, string> = {
  A: "#4caf50",
  B: "#8bc34a",
  C: "#ffc107",
  D: "#ff9800",
  E: "#f44336",
  F: "#b71c1c",
};

function RankBadge({ rank }: { rank: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: "1.4em",
        textAlign: "center",
        borderRadius: "3px",
        fontWeight: "bold",
        color: "#fff",
        backgroundColor: RANK_COLORS[rank] ?? "#888",
      }}
    >
      {rank}
    </span>
  );
}

export function MetricsView({ metrics }: { metrics: Metrics }) {
  const { file, raw, maintainability, complexity } = metrics;
  const base = file.split(/[\\/]/).pop() ?? file;

  return (
    <div style={{ padding: "1rem", fontFamily: "var(--vscode-font-family)", fontSize: "13px", color: "var(--vscode-foreground)" }}>
      <h2 style={{ margin: "0 0 0.75rem", fontSize: "15px" }}>{base}</h2>

      <section style={{ marginBottom: "1rem" }}>
        <h3 style={{ margin: "0 0 0.4rem", fontSize: "13px", opacity: 0.7 }}>RAW METRICS</h3>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <tbody>
            {[
              ["Lines of code", raw.loc],
              ["Source lines", raw.sloc],
              ["Comments", raw.comments],
              ["Blank", raw.blank],
            ].map(([label, value]) => (
              <tr key={label as string}>
                <td style={{ padding: "2px 8px 2px 0", opacity: 0.8 }}>{label}</td>
                <td style={{ padding: "2px 0", fontVariantNumeric: "tabular-nums" }}>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={{ marginBottom: "1rem" }}>
        <h3 style={{ margin: "0 0 0.4rem", fontSize: "13px", opacity: 0.7 }}>MAINTAINABILITY</h3>
        <span><RankBadge rank={maintainability.rank} /> {maintainability.score}</span>
      </section>

      <section>
        <h3 style={{ margin: "0 0 0.4rem", fontSize: "13px", opacity: 0.7 }}>COMPLEXITY</h3>
        {complexity.length === 0 ? (
          <span style={{ opacity: 0.5 }}>No blocks found.</span>
        ) : (
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr style={{ opacity: 0.6 }}>
                <th style={{ textAlign: "left", padding: "2px 8px 2px 0", fontWeight: "normal" }}>Name</th>
                <th style={{ textAlign: "left", padding: "2px 8px 2px 0", fontWeight: "normal" }}>Line</th>
                <th style={{ textAlign: "left", padding: "2px 8px 2px 0", fontWeight: "normal" }}>CC</th>
                <th style={{ textAlign: "left", padding: "2px 0", fontWeight: "normal" }}>Rank</th>
              </tr>
            </thead>
            <tbody>
              {complexity.map((b) => (
                <tr key={`${b.name}-${b.lineno}`}>
                  <td style={{ padding: "2px 8px 2px 0" }}>
                    <span style={{ opacity: 0.5, fontSize: "11px", marginRight: "4px" }}>{b.type}</span>
                    {b.name}
                  </td>
                  <td style={{ padding: "2px 8px 2px 0", fontVariantNumeric: "tabular-nums", opacity: 0.7 }}>{b.lineno}</td>
                  <td style={{ padding: "2px 8px 2px 0", fontVariantNumeric: "tabular-nums" }}>{b.complexity}</td>
                  <td style={{ padding: "2px 0" }}><RankBadge rank={b.rank} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
