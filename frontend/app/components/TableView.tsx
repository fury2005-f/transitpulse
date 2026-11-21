import { disclosure } from "../lib";

// Every chart has a table twin, so no value is readable only by color or hover.
export default function TableView({ caption, head, rows }: { caption: string; head: string[]; rows: (string | number)[][] }) {
  return (
    <details className="mt-4 text-sm">
      <summary className={disclosure}>Show the numbers as a table</summary>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-max text-left tabular-nums">
          <caption className="sr-only">{caption}</caption>
          <thead className="text-ink-2">
            <tr className="border-b border-line">
              {head.map((h) => (
                <th key={h} scope="col" className="py-2 pr-4 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-line last:border-0">
                {r.map((cell, j) => (
                  <td key={j} className="py-2 pr-4">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
