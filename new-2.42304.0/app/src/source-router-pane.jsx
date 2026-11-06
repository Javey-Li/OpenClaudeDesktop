import React, { useCallback, useEffect, useState } from "react";
import "./source-router-pane.css";
import { ROUTER_COLUMNS } from "./router-board-model.mjs";

// Router pane: the per-project routers' view of the owner's work, in three
// columns. Refreshes on open and every minute while open.
export function SourceRouterPane({ load, headerCenter, controls }) {
  const [board, setBoard] = useState(null);
  const [failed, setFailed] = useState("");
  const refresh = useCallback(() => {
    Promise.resolve(load?.()).then((result) => {
      if (result?.ok) { setBoard(result); setFailed(""); }
      else setFailed(result?.error || "总管的数据读不出来。");
    }, () => setFailed("总管的数据读不出来。"));
  }, [load]);
  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  return <aside className="source-file-panel detail-panel psa-router" aria-label="总管">
    <header className="source-pane-header" data-pane-header="router">
      <span className="psa-router-title">总管</span>{headerCenter}{controls}
    </header>
    <div className="psa-router-body">
      {failed ? <p className="psa-router-note">{failed}</p> : !board ? <p className="psa-router-note">正在读…</p> :
        ROUTER_COLUMNS.map((column) => {
          const rows = board[column.key] ?? [];
          return <section key={column.key} className="psa-router-column">
            <h3>{column.title}<span>{rows.length}</span></h3>
            {rows.length === 0 ? <p className="psa-router-note">{column.empty}</p> :
              <ol>{rows.map((row) => <li key={row.id}>
                <div className="psa-router-row-title">{row.title}</div>
                {row.detail && <div className="psa-router-row-detail">{row.detail}</div>}
                <div className="psa-router-row-meta">{[row.project, row.who].filter(Boolean).join(" · ")}</div>
              </li>)}</ol>}
          </section>;
        })}
    </div>
  </aside>;
}
