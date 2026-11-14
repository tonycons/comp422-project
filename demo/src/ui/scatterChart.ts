// =============================================================================
//  AI-GENERATED FILE  -  written by Claude (Anthropic AI), 2026-11-12,
//  at the request of George Rule. See ../../../AI_CONTRIBUTIONS.md for the full log.
//  Human edits: please tag changed lines with   // [EDIT: <your name>]
// =============================================================================
/**
 * One chart of "something vs. map size n" for the scaling section:
 *   - every measured map as a faint dot (the project's scatterplot),
 *   - the average for each n as a solid line with dots,
 *   - optionally the theory trendline (dashed), e.g. a * n^2 * 2^n + b,
 *   - or bars instead of dots (for percentages).
 * Linear or log y axis. Hover / arrow keys snap a crosshair to each n and show a
 * tooltip; the same numbers are also in a table under the chart.
 */
import { fmtTick } from "./format";
import { COLORS, fitCanvas } from "./theme";

export interface ChartPoint {
    x: number;
    y: number;
}

export interface ChartSeries {
    name: string;
    color: string;
    kind: "scatter" | "bars";
    points: ChartPoint[];
    /** Theory trendline: y = fit(x). Drawn dashed over the series' x range. */
    fit?: { label: string; at: (x: number) => number } | null;
    /** End-of-line label override (default: the series name). */
    label?: string;
}

export interface ChartOptions {
    height?: number;
    logY?: boolean;
    xLabel: string;
    yLabel: string;
    /** Format a y value for the tooltip ("12.3 ms", "45 cal"). */
    formatY: (v: number) => string;
    /** Room for direct labels at the right (0 = none; the legend still names everything). */
    labelSpace?: number;
    yMin?: number;
    yMax?: number;
}

const NARROW = 520;

export class ScatterChart {
    private ctx!: CanvasRenderingContext2D;
    private width = 0;
    private height: number;
    private series: ChartSeries[] = [];
    private xs: number[] = [];   // every x that has data (the crosshair snaps here)
    private xMin = 0;
    private xMax = 1;
    private yLo = 0;             // in axis units (log10 when logY)
    private yHi = 1;
    private yTicks: number[] = [];
    private hoverX: number | null = null;
    private m = { top: 12, right: 16, bottom: 42, left: 58 };

    constructor(
        private readonly canvas: HTMLCanvasElement,
        private readonly tooltip: HTMLElement,
        private readonly opts: ChartOptions,
    ) {
        this.height = opts.height ?? 260;
        canvas.addEventListener("pointermove", (e) => this.onPointer(e));
        canvas.addEventListener("pointerleave", () => this.setHover(null));
        canvas.addEventListener("blur", () => this.setHover(null));
        canvas.addEventListener("keydown", (e) => this.onKey(e));
    }

    setSeries(series: ChartSeries[]): void {
        this.series = series;
        const all = series.flatMap((s) => s.points);
        this.xs = [...new Set(all.map((p) => p.x))].sort((a, b) => a - b);
        this.xMin = this.xs[0] ?? 0;
        this.xMax = this.xs.at(-1) ?? 1;
        if (this.xMax === this.xMin) {
            this.xMax = this.xMin + 1;
        }
        const ys = all.map((p) => p.y).filter((y) => !this.opts.logY || y > 0);
        if (this.opts.logY) {
            const lo = Math.floor(Math.log10(Math.min(...ys, 1)));
            const hi = Math.ceil(Math.log10(Math.max(...ys, 10 ** (lo + 1))));
            this.yLo = lo;
            this.yHi = Math.max(hi, lo + 1);
            this.yTicks = Array.from({ length: this.yHi - this.yLo + 1 }, (_, k) => this.yLo + k);
        } else {
            const lo = this.opts.yMin ?? Math.min(0, ...ys);
            const hi = this.opts.yMax ?? Math.max(...ys, lo + 1);
            [this.yLo, this.yHi, this.yTicks] = niceScale(lo, hi, 5);
            if (this.opts.yMax !== undefined) {
                this.yHi = this.opts.yMax;
                this.yTicks = this.yTicks.filter((t) => t <= this.opts.yMax! + 1e-9);
            }
        }
        if (this.hoverX !== null && !this.xs.includes(this.hoverX)) {
            this.setHover(null);
        }
    }

    resize(): void {
        this.width = this.canvas.clientWidth;
        const narrow = this.width < NARROW;
        this.m.right = narrow ? 16 : (this.opts.labelSpace ?? 16);
        this.m.left = narrow ? 50 : 58;
        this.ctx = fitCanvas(this.canvas, this.width, this.height);
    }

    // --- scales
    private x(v: number): number {
        return this.m.left + ((v - this.xMin) / (this.xMax - this.xMin)) * (this.width - this.m.left - this.m.right);
    }
    private axisY(v: number): number {
        return this.opts.logY ? Math.log10(Math.max(v, 1e-12)) : v;
    }
    private y(v: number): number {
        const a = this.axisY(v);
        const h = this.height - this.m.top - this.m.bottom;
        return this.m.top + (1 - (a - this.yLo) / (this.yHi - this.yLo)) * h;
    }

    draw(): void {
        const ctx = this.ctx;
        if (!ctx) {
            return;
        }
        ctx.clearRect(0, 0, this.width, this.height);
        const plotL = this.m.left;
        const plotR = this.width - this.m.right;
        const plotB = this.height - this.m.bottom;

        // grid + y ticks
        ctx.font = "12px system-ui, sans-serif";
        ctx.textBaseline = "middle";
        ctx.textAlign = "right";
        const maxAbs = Math.max(Math.abs(this.yLo), Math.abs(this.yHi));
        for (const t of this.yTicks) {
            const v = this.opts.logY ? 10 ** t : t;
            const yy = Math.round(this.y(v)) + 0.5;
            ctx.strokeStyle = t === this.yTicks[0] ? COLORS.axis : COLORS.grid;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(plotL, yy);
            ctx.lineTo(plotR, yy);
            ctx.stroke();
            ctx.fillStyle = COLORS.inkMuted;
            ctx.fillText(this.opts.logY ? fmtLogTick(v) : fmtTick(v, maxAbs), plotL - 8, yy);
        }
        // x ticks: whole numbers, thinned to fit
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        const [, , xTicks] = niceScale(this.xMin, this.xMax, Math.max(3, Math.floor((plotR - plotL) / 60)));
        for (const t of xTicks) {
            if (t < this.xMin - 1e-9 || t > this.xMax + 1e-9 || !Number.isInteger(t)) {
                continue;
            }
            ctx.fillStyle = COLORS.inkMuted;
            ctx.fillText(t.toLocaleString("en-US"), this.x(t), plotB + 8);
        }
        ctx.fillStyle = COLORS.inkSecondary;
        ctx.fillText(this.opts.xLabel, (plotL + plotR) / 2, this.height - 16);
        ctx.save();
        ctx.translate(14, (this.m.top + plotB) / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textBaseline = "middle";
        ctx.fillText(this.opts.yLabel, 0, 0);
        ctx.restore();

        ctx.save();
        ctx.beginPath();
        ctx.rect(plotL - 6, this.m.top - 6, plotR - plotL + 12, plotB - this.m.top + 6);
        ctx.clip();
        const bars = this.series.filter((s) => s.kind === "bars");
        bars.forEach((s, k) => this.drawBars(s, k, bars.length));
        for (const s of this.series.filter((s) => s.kind === "scatter")) {
            this.drawScatter(s);
        }
        ctx.restore();

        this.drawEndLabels();

        if (this.hoverX !== null) {
            const hx = Math.round(this.x(this.hoverX)) + 0.5;
            ctx.strokeStyle = COLORS.inkMuted;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(hx, this.m.top);
            ctx.lineTo(hx, plotB);
            ctx.stroke();
        }
    }

    private drawScatter(s: ChartSeries): void {
        const ctx = this.ctx;
        // every measured map: small faint dots with a surface ring
        ctx.globalAlpha = 0.4;
        for (const p of s.points) {
            if (this.opts.logY && p.y <= 0) {
                continue;
            }
            ctx.beginPath();
            ctx.arc(this.x(p.x), this.y(p.y), 3, 0, Math.PI * 2);
            ctx.fillStyle = s.color;
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // theory trendline (dashed), sampled densely so curves stay smooth
        if (s.fit) {
            const lo = Math.min(...s.points.map((p) => p.x));
            const hi = Math.max(...s.points.map((p) => p.x));
            ctx.save();
            ctx.setLineDash([5, 4]);
            ctx.strokeStyle = COLORS.inkSecondary;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            let started = false;
            for (let k = 0; k <= 120; k++) {
                const xv = lo + ((hi - lo) * k) / 120;
                const yv = s.fit.at(xv);
                if (this.opts.logY && yv <= 0) {
                    started = false;
                    continue;
                }
                if (!started) {
                    ctx.moveTo(this.x(xv), this.y(yv));
                    started = true;
                } else {
                    ctx.lineTo(this.x(xv), this.y(yv));
                }
            }
            ctx.stroke();
            ctx.restore();
        }

        // averages: 2px line + dots
        const means = meansByX(s.points, this.opts.logY);
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        means.forEach(([xv, yv], k) => (k === 0 ? ctx.moveTo(this.x(xv), this.y(yv)) : ctx.lineTo(this.x(xv), this.y(yv))));
        ctx.stroke();
        for (const [xv, yv] of means) {
            dot(ctx, this.x(xv), this.y(yv), s.color, this.hoverX === xv ? 5 : 4);
        }
    }

    private drawBars(s: ChartSeries, index: number, count: number): void {
        const ctx = this.ctx;
        const means = meansByX(s.points, false);
        const step = this.xs.length > 1 ? (this.x(this.xs[1]) - this.x(this.xs[0])) : 40;
        const groupW = Math.min(48, step * 0.7);
        const barW = Math.max(2, groupW / count - 2);   // 2px surface gap between neighbours
        const base = this.y(this.opts.logY ? 10 ** this.yLo : Math.max(0, this.yLo));
        for (const [xv, yv] of means) {
            const left = this.x(xv) - groupW / 2 + index * (barW + 2);
            const top = this.y(yv);
            const h = Math.max(2, base - top);   // a 2px stub keeps a 0% bar visible
            ctx.fillStyle = s.color;
            ctx.globalAlpha = this.hoverX === null || this.hoverX === xv ? 1 : 0.55;
            ctx.beginPath();
            ctx.roundRect(left, base - h, barW, h, [Math.min(4, barW / 2), Math.min(4, barW / 2), 0, 0]);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    }

    /** Direct labels at the right end of each average line (skipped if they would collide). */
    private drawEndLabels(): void {
        const scatter = this.series.filter((s) => s.kind === "scatter");
        if (this.m.right < 60 || scatter.length === 0 || scatter.length > 4) {
            return;
        }
        const ends = scatter.map((s) => {
            const means = meansByX(s.points, this.opts.logY);
            const [xv, yv] = means.at(-1) ?? [0, 0];
            return { s, x: this.x(xv), y: this.y(yv) };
        }).sort((a, b) => a.y - b.y);
        // nudge apart labels that would overlap (keep them inside the plot)
        for (let k = 1; k < ends.length; k++) {
            ends[k].y = Math.max(ends[k].y, ends[k - 1].y + 16);
        }
        const ctx = this.ctx;
        ctx.font = "600 12px system-ui, sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        for (const e of ends) {
            ctx.fillStyle = COLORS.inkSecondary;
            ctx.fillText(e.s.label ?? e.s.name, e.x + 10, e.y);
        }
    }

    // --- interaction
    private onPointer(e: PointerEvent): void {
        const rect = this.canvas.getBoundingClientRect();
        const px = e.clientX - rect.left;
        if (px < this.m.left - 12 || px > this.width - this.m.right + 12 || this.xs.length === 0) {
            return this.setHover(null);
        }
        let best = this.xs[0];
        for (const xv of this.xs) {
            if (Math.abs(this.x(xv) - px) < Math.abs(this.x(best) - px)) {
                best = xv;
            }
        }
        this.setHover(best);
    }

    private onKey(e: KeyboardEvent): void {
        if (e.key === "Escape") {
            return this.setHover(null);
        }
        if ((e.key !== "ArrowLeft" && e.key !== "ArrowRight") || this.xs.length === 0) {
            return;
        }
        e.preventDefault();
        let idx = this.hoverX === null ? (e.key === "ArrowRight" ? -1 : this.xs.length) : this.xs.indexOf(this.hoverX);
        idx = Math.min(this.xs.length - 1, Math.max(0, idx + (e.key === "ArrowRight" ? 1 : -1)));
        this.setHover(this.xs[idx]);
    }

    private setHover(xv: number | null): void {
        this.hoverX = xv;
        this.draw();
        const tip = this.tooltip;
        if (xv === null) {
            tip.hidden = true;
            return;
        }
        tip.replaceChildren();
        const head = document.createElement("div");
        head.className = "tip-head";
        head.textContent = `n = ${xv.toLocaleString("en-US")}`;
        tip.appendChild(head);
        for (const s of this.series) {
            const vals = s.points.filter((p) => p.x === xv).map((p) => p.y);
            if (vals.length === 0) {
                continue;
            }
            // the same average the line shows: geometric on a log axis, arithmetic otherwise
            const pos = vals.filter((v) => v > 0);
            const avg = this.opts.logY && pos.length > 0
                ? 10 ** (pos.reduce((a, b) => a + Math.log10(b), 0) / pos.length)
                : vals.reduce((a, b) => a + b, 0) / vals.length;
            const row = document.createElement("div");
            row.className = "tip-row";
            const key = document.createElement("span");
            key.className = "line-key";
            key.style.background = s.color;
            const value = document.createElement("strong");
            value.textContent = this.opts.formatY(avg);
            const name = document.createElement("span");
            name.className = "tip-name";
            const kind = this.opts.logY ? "geometric mean" : "mean";
            name.textContent = `${s.name}${vals.length > 1 ? ` · ${kind} of ${vals.length}` : ""}`;
            row.append(key, value, name);
            tip.appendChild(row);
            if (s.fit) {
                const fitRow = document.createElement("div");
                fitRow.className = "tip-row tip-fit";
                fitRow.textContent = `theory fit ${s.fit.label}: ${this.opts.formatY(s.fit.at(xv))}`;
                tip.appendChild(fitRow);
            }
        }
        tip.hidden = false;
        const x = this.x(xv);
        const tipW = tip.offsetWidth;
        tip.style.left = `${x + 14 + tipW > this.width ? Math.max(0, x - 14 - tipW) : x + 14}px`;
        tip.style.top = `${this.m.top}px`;
    }
}

/** [x, mean y] pairs sorted by x (geometric mean on a log axis, so it sits inside the dots). */
function meansByX(points: readonly ChartPoint[], log = false): [number, number][] {
    const groups = new Map<number, number[]>();
    for (const p of points) {
        if (log && p.y <= 0) {
            continue;
        }
        const g = groups.get(p.x) ?? [];
        g.push(p.y);
        groups.set(p.x, g);
    }
    return [...groups.entries()].sort((a, b) => a[0] - b[0]).map(([x, v]) => [x,
        log ? 10 ** (v.reduce((s, y) => s + Math.log10(y), 0) / v.length) : v.reduce((s, y) => s + y, 0) / v.length]);
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, r: number): void {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = COLORS.surface;
    ctx.lineWidth = 2;
    ctx.stroke();
}

/** 0.001 ms, 0.01, 0.1, 1, 10, 100, 1,000 ... */
function fmtLogTick(v: number): string {
    if (v >= 1) {
        return Math.round(v).toLocaleString("en-US");
    }
    return String(Number(v.toPrecision(1)));
}

/** Round axis bounds to clean numbers: returns [min, max, ticks]. */
export function niceScale(lo: number, hi: number, count: number): [number, number, number[]] {
    const raw = (hi - lo) / Math.max(1, count);
    const mag = 10 ** Math.floor(Math.log10(raw || 1));
    const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((s) => s >= raw) ?? 10 * mag;
    const min = Math.floor(lo / step) * step;
    const max = Math.ceil(hi / step) * step;
    const ticks: number[] = [];
    for (let v = min; v <= max + step / 2; v += step) {
        ticks.push(Math.round(v / step) * step);
    }
    return [min, max, ticks];
}
