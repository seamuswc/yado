/**
 * Small inline-SVG charts for the admin dashboard. Single series per chart, so no legend is needed;
 * the title names the series. Marks: thin bars with 4px rounded tops anchored to the baseline,
 * 2px lines, recessive grid, text in ink tokens. Hover shows a native tooltip per mark.
 */
const BLUE = "#2a78d6"; // sequential hue (reference palette, light mode)
const INK = "#1c1917";
const MUTED = "#6b6560";
const GRID = "#e7e2dd";

export type Point = { label: string; value: number; hint?: string };

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  const m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return m * p;
}

export function BarChart({ data, format = (v) => String(v), height = 160 }: { data: Point[]; format?: (v: number) => string; height?: number }) {
  const w = 480, padL = 44, padR = 8, padT = 8, padB = 24;
  const innerW = w - padL - padR, innerH = height - padT - padB;
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  const slot = innerW / Math.max(data.length, 1);
  const barW = Math.min(28, slot * 0.6);
  const ticks = [...new Set([0, 0.5, 1].map((f) => f * max).map((v) => (max >= 2 ? Math.round(v) : v)))];
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full h-auto" role="img" aria-label="bar chart">
      {ticks.map((tk) => {
        const y = padT + innerH - (tk / max) * innerH;
        return (
          <g key={tk}>
            <line x1={padL} x2={w - padR} y1={y} y2={y} stroke={GRID} strokeWidth={1} />
            <text x={padL - 6} y={y + 3} fontSize={10} textAnchor="end" fill={MUTED}>{format(tk)}</text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const h = max ? (d.value / max) * innerH : 0;
        const x = padL + i * slot + (slot - barW) / 2;
        const y = padT + innerH - h;
        const r = Math.min(4, h / 2);
        return (
          <g key={d.label}>
            <title>{d.hint ?? `${d.label}: ${format(d.value)}`}</title>
            {/* hit target wider than the mark */}
            <rect x={padL + i * slot} y={padT} width={slot} height={innerH} fill="transparent" />
            {h > 0 && (
              <path d={`M${x},${y + r} a${r},${r} 0 0 1 ${r},-${r} h${barW - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${h - r} h-${barW} z`} fill={BLUE} />
            )}
            <text x={x + barW / 2} y={height - 8} fontSize={10} textAnchor="middle" fill={MUTED}>{d.label}</text>
          </g>
        );
      })}
      <line x1={padL} x2={w - padR} y1={padT + innerH} y2={padT + innerH} stroke={INK} strokeOpacity={0.3} strokeWidth={1} />
    </svg>
  );
}

export function LineChart({ data, format = (v) => String(v), height = 120, threshold }: { data: Point[]; format?: (v: number) => string; height?: number; threshold?: number }) {
  const w = 480, padL = 44, padR = 8, padT = 8, padB = 20;
  const innerW = w - padL - padR, innerH = height - padT - padB;
  const max = niceMax(Math.max(...data.map((d) => d.value), threshold ?? 0, 0));
  const step = data.length > 1 ? innerW / (data.length - 1) : 0;
  const pts = data.map((d, i) => [padL + i * step, padT + innerH - (d.value / max) * innerH] as const);
  const path = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const labelEvery = Math.max(1, Math.ceil(data.length / 6));
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full h-auto" role="img" aria-label="line chart">
      {[0, 0.5, 1].map((f) => {
        const y = padT + innerH - f * innerH;
        return <g key={f}><line x1={padL} x2={w - padR} y1={y} y2={y} stroke={GRID} /><text x={padL - 6} y={y + 3} fontSize={10} textAnchor="end" fill={MUTED}>{format(f * max)}</text></g>;
      })}
      {threshold !== undefined && (
        <line x1={padL} x2={w - padR} y1={padT + innerH - (threshold / max) * innerH} y2={padT + innerH - (threshold / max) * innerH} stroke="#ec835a" strokeDasharray="4 3" strokeWidth={1.5} />
      )}
      {data.length > 0 && <path d={path} fill="none" stroke={BLUE} strokeWidth={2} strokeLinejoin="round" />}
      {pts.map(([x, y], i) => (
        <g key={i}>
          <title>{data[i].hint ?? `${data[i].label}: ${format(data[i].value)}`}</title>
          <rect x={x - step / 2} y={padT} width={Math.max(step, 6)} height={innerH} fill="transparent" />
          <circle cx={x} cy={y} r={3} fill={BLUE} stroke="#fff" strokeWidth={2} />
          {i % labelEvery === 0 && <text x={x} y={height - 6} fontSize={10} textAnchor="middle" fill={MUTED}>{data[i].label}</text>}
        </g>
      ))}
    </svg>
  );
}

export function Stat({ label, value, delta, hint }: { label: string; value: string; delta?: number | null; hint?: string }) {
  const up = (delta ?? 0) > 0;
  return (
    <div className="rounded-2xl bg-card border border-line p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-2xl font-bold tracking-tight mt-1">{value}</p>
      {delta !== undefined && delta !== null && Number.isFinite(delta) && (
        <p className={`text-xs mt-1 ${up ? "text-emerald-700" : delta < 0 ? "text-red-700" : "text-muted"}`}>{up ? "▲" : delta < 0 ? "▼" : "•"} {Math.abs(delta).toFixed(0)}% vs last week</p>
      )}
      {hint && <p className="text-xs text-muted mt-1">{hint}</p>}
    </div>
  );
}
