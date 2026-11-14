// =============================================================================
//  AI-GENERATED FILE  -  written by Claude (Anthropic AI), 2026-11-13,
//  at the request of tonycons. See ../../AI_CONTRIBUTIONS.md for the full log.
//  Human edits: please tag changed lines with   // [EDIT: <your name>]
// =============================================================================
/**
 * Draws one benchmark chart as a standalone SVG file (opens in any browser, and can be
 * placed in a report). No libraries: an SVG is just text.
 *
 * Same look as the website's charts: hairline grid, 2px lines, colors from src/ui/theme.ts.
 * Every number drawn here is also in the CSV files, so the chart is never the only source.
 */
import { writeFileSync } from "node:fs";

export interface ChartSeries {
    label: string;
    kind: "dots" | "line" | "dashed";   // dots = one per map; line = averages; dashed = fitted model
    color: string;
    points: [x: number, y: number][];
}

export interface ChartOptions {
    title: string;
    subtitle?: string;
    xLabel: string;
    yLabel: string;
    logY?: boolean;      // log-scale y axis (for exponential growth)
    yMin?: number;       // where a linear y axis starts (default 0)
    series: ChartSeries[];
}

const W = 920;
const H = 540;
const M = { top: 104, right: 28, bottom: 58, left: 84 };
const INK = "#0b0b0b";
const INK_2 = "#52514e";
const MUTED = "#898781";
const GRID = "#e1e0d9";
const AXIS = "#c3c2b7";
const SURFACE = "#fcfcfb";

export function writeChart(path: string, o: ChartOptions): void {
    const all = o.series.flatMap((s) => s.points);
    const xs = all.map((p) => p[0]);
    const ys = all.map((p) => p[1]);
    const xTicks = niceTicks(Math.min(...xs), Math.max(...xs), 10);
    const x0 = Math.min(xTicks[0], Math.min(...xs));
    const x1 = Math.max(xTicks[xTicks.length - 1], Math.max(...xs));

    let yTicks: number[];
    let yPos: (v: number) => number;
    const plotH = H - M.top - M.bottom;
    if (o.logY) {
        const positive = ys.filter((v) => v > 0);
        const lo = Math.floor(Math.log10(Math.min(...positive)));
        const hi = Math.ceil(Math.log10(Math.max(...positive)));
        yTicks = Array.from({ length: hi - lo + 1 }, (_, k) => 10 ** (lo + k));
        yPos = (v) => M.top + (1 - (Math.log10(v) - lo) / (hi - lo)) * plotH;
    } else {
        const from = o.yMin ?? 0;
        yTicks = niceTicks(from, Math.max(...ys), 6);
        const y0 = Math.min(from, yTicks[0]);
        const y1 = yTicks[yTicks.length - 1];
        yPos = (v) => M.top + (1 - (v - y0) / (y1 - y0)) * plotH;
    }
    const xPos = (v: number): number => M.left + ((v - x0) / (x1 - x0)) * (W - M.left - M.right);
    const f = (v: number): string => v.toFixed(1);

    const out: string[] = [];
    out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif" role="img" aria-label="${esc(o.title)}">`);
    out.push(`<rect width="${W}" height="${H}" fill="${SURFACE}"/>`);
    out.push(`<text x="${M.left}" y="34" font-size="19" font-weight="700" fill="${INK}">${esc(o.title)}</text>`);
    if (o.subtitle) {
        out.push(`<text x="${M.left}" y="56" font-size="12.5" fill="${INK_2}">${esc(o.subtitle)}</text>`);
    }

    // legend: one row under the subtitle
    let lx = M.left;
    for (const s of o.series) {
        const ly = 80;
        if (s.kind === "dots") {
            out.push(`<circle cx="${lx + 8}" cy="${ly - 4}" r="4" fill="${s.color}" fill-opacity="0.6"/>`);
        } else {
            out.push(`<line x1="${lx}" y1="${ly - 4}" x2="${lx + 18}" y2="${ly - 4}" stroke="${s.color}" stroke-width="2"${s.kind === "dashed" ? ' stroke-dasharray="6 4"' : ""}/>`);
        }
        out.push(`<text x="${lx + 25}" y="${ly}" font-size="12.5" fill="${INK_2}">${esc(s.label)}</text>`);
        lx += 25 + s.label.length * 6.6 + 26;
    }

    // grid + y ticks
    for (const v of yTicks) {
        const y = Math.round(yPos(v)) + 0.5;
        const baseline = !o.logY && v === yTicks[0];
        out.push(`<line x1="${M.left}" y1="${y}" x2="${W - M.right}" y2="${y}" stroke="${baseline ? AXIS : GRID}" stroke-width="1"/>`);
        out.push(`<text x="${M.left - 10}" y="${y + 4}" font-size="12" text-anchor="end" fill="${MUTED}">${esc(formatTick(v))}</text>`);
    }
    // x ticks
    for (const v of xTicks) {
        out.push(`<text x="${f(xPos(v))}" y="${H - M.bottom + 20}" font-size="12" text-anchor="middle" fill="${MUTED}">${esc(formatTick(v))}</text>`);
    }
    out.push(`<line x1="${M.left}" y1="${H - M.bottom + 0.5}" x2="${W - M.right}" y2="${H - M.bottom + 0.5}" stroke="${AXIS}" stroke-width="1"/>`);
    out.push(`<text x="${(M.left + W - M.right) / 2}" y="${H - 14}" font-size="13" text-anchor="middle" fill="${INK_2}">${esc(o.xLabel)}</text>`);
    out.push(`<text transform="translate(20 ${M.top + plotH / 2}) rotate(-90)" font-size="13" text-anchor="middle" fill="${INK_2}">${esc(o.yLabel)}</text>`);

    // marks: dots first, then the fitted curve, then the average line on top
    const order = { dots: 0, dashed: 1, line: 2 };
    for (const s of [...o.series].sort((a, b) => order[a.kind] - order[b.kind])) {
        const pts = s.points.filter((p) => !o.logY || p[1] > 0);
        if (s.kind === "dots") {
            for (const [x, y] of pts) {
                out.push(`<circle cx="${f(xPos(x))}" cy="${f(yPos(y))}" r="3.5" fill="${s.color}" fill-opacity="0.45"/>`);
            }
            continue;
        }
        const d = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${f(xPos(x))} ${f(yPos(y))}`).join(" ");
        out.push(`<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"${s.kind === "dashed" ? ' stroke-dasharray="6 4"' : ""}/>`);
        if (s.kind === "line") {
            for (const [x, y] of pts) {
                out.push(`<circle cx="${f(xPos(x))}" cy="${f(yPos(y))}" r="4" fill="${s.color}" stroke="${SURFACE}" stroke-width="2"/>`);
            }
        }
    }
    out.push("</svg>");
    writeFileSync(path, out.join("\n") + "\n", "utf8");
}

/** Round tick values (1, 2, 2.5 or 5 times a power of ten) covering [lo, hi]. */
function niceTicks(lo: number, hi: number, count: number): number[] {
    if (hi <= lo) {
        hi = lo + 1;
    }
    const raw = (hi - lo) / count;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
    const first = Math.floor(lo / step + 1e-9) * step;
    const ticks: number[] = [];
    for (let v = first; v <= hi + step * (1 - 1e-9); v += step) {
        ticks.push(Number(v.toPrecision(12)));
    }
    return ticks;
}

function formatTick(v: number): string {
    if (v === 0) {
        return "0";
    }
    if (Math.abs(v) >= 1000) {
        return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
    }
    return String(Number(v.toPrecision(4)));
}

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
