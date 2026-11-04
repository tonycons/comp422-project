// =============================================================================
//  AI-GENERATED FILE  -  written by Claude (Anthropic AI), 2026-11-03,
//  at the request of tonycons. See ../../../ai-claude/AI_CONTRIBUTIONS.md for the full log.
//  Human edits: please tag changed lines with   // [EDIT: <your name>]
// =============================================================================
/**
 * One algorithm's map, drawn on a <canvas>. Two phases (like the Python race):
 *   drawPlanning(progress)  - the algorithm computing its route
 *   drawWalking(t)          - the raccoon walking its route, t = seconds since leaving the den
 * Both are pure functions of their argument, so the timeline can be scrubbed freely.
 */
import type { Decision } from "../core/greedy";
import { freshnessAt, type AlgorithmKey, type Problem, type Solution } from "../core/problem";
import { reverse, type Move } from "../core/twoOpt";
import { ALGORITHM_COLORS, COLORS, fitCanvas, foodStyle, STALE_BELOW, traceShape } from "./theme";

export interface PanelData {
    key: AlgorithmKey;
    instance: Problem;
    solution: Solution;
    decisions?: Decision[] | null;   // Greedy: what it looked at each step
    startRoute?: number[];           // 2-opt: the Greedy route it started from
    moves?: Move[] | null;           // 2-opt: every accepted reversal
}

// Detail switches by map size (things that turn into noise on busy maps)
const SHOW_ORDER_MAX_N = 40;         // number each eaten item
const SHOW_FRESHNESS_MAX_N = 60;     // little freshness bar under each item
const SHOW_PLAN_MAX_N = 250;         // 2-opt: dashed line of the rest of its plan

/** How the 2-opt planning replay splits its bar: first build Greedy's route, then flip. */
export const PLAN_BUILD_FRACTION = 0.15;

export class MapView {
    private ctx!: CanvasRenderingContext2D;
    private size = 0;
    private pad = 14;
    private data: PanelData | null = null;
    private eatenAt = new Float64Array(0);   // item id -> arrival time
    private rank = new Int32Array(0);        // item id -> position in the route
    // 2-opt replay cache
    private replayRoute: number[] = [];
    private replayApplied = 0;

    constructor(private readonly canvas: HTMLCanvasElement) {}

    setData(data: PanelData): void {
        this.data = data;
        const n = data.instance.items.length;
        this.eatenAt = new Float64Array(n);
        this.rank = new Int32Array(n);
        data.solution.order.forEach((id, k) => {
            this.eatenAt[id] = data.solution.arrivalTimes[k];
            this.rank[id] = k;
        });
        this.replayRoute = [...(data.startRoute ?? [])];
        this.replayApplied = 0;
    }

    resize(): void {
        this.size = this.canvas.clientWidth;
        this.ctx = fitCanvas(this.canvas, this.size, this.size);
    }

    // --- coordinates: map meters -> canvas pixels (y points up, like the Python plots)
    private px(x: number): number {
        return this.pad + (x / this.data!.instance.width) * (this.size - 2 * this.pad);
    }
    private py(y: number): number {
        return this.size - this.pad - (y / this.data!.instance.height) * (this.size - 2 * this.pad);
    }
    private markerRadius(): number {
        const n = this.data!.instance.items.length;
        const scale = this.size / 420;
        const r = n <= 20 ? 7 : n <= 60 ? 6 : n <= 150 ? 4.5 : n <= 500 ? 3.2 : 2.3;
        return Math.max(2, r * Math.min(1.25, Math.max(0.7, scale)));
    }

    // ---------------------------------------------------------------------------
    /** Phase 1. progress = 0..1 of THIS algorithm's own planning bar. */
    drawPlanning(progress: number): void {
        const d = this.data;
        if (!d || !this.ctx) {
            return;
        }
        this.clear();

        if (d.key === "two_opt" && d.startRoute && d.moves) {
            // Replay: first draw Greedy's route appearing, then apply the recorded flips.
            const build = Math.min(1, progress / PLAN_BUILD_FRACTION);
            const flips = progress <= PLAN_BUILD_FRACTION ? 0
                : Math.round(((progress - PLAN_BUILD_FRACTION) / (1 - PLAN_BUILD_FRACTION)) * d.moves.length);
            const route = this.replayTo(flips);
            const shown = Math.ceil(build * route.length);
            this.strokeRoute(route.slice(0, shown), COLORS.inkSecondary, 1.25, 0.55);
            if (flips > 0 && progress < 1) {
                const [i, j] = d.moves[flips - 1];
                // highlight the stretch that was just reversed (plus the legs into/out of it)
                const lo = Math.max(0, i - 1);
                const seg = route.slice(lo, Math.min(route.length, j + 2));
                this.strokeRoute(seg, ALGORITHM_COLORS.two_opt, 3, 1, i === 0);
            } else if (progress >= 1) {
                this.strokeRoute(route, ALGORITHM_COLORS.two_opt, 2, 0.9);
            }
        }
        this.drawItems(0, false);
        this.drawDen();
    }

    /** How many 2-opt flips the replay is showing at this progress (for the caption). */
    static flipsAt(progress: number, totalMoves: number): number {
        if (progress <= PLAN_BUILD_FRACTION) {
            return 0;
        }
        return Math.round(((progress - PLAN_BUILD_FRACTION) / (1 - PLAN_BUILD_FRACTION)) * totalMoves);
    }

    private replayTo(count: number): number[] {
        const d = this.data!;
        if (count < this.replayApplied) {
            this.replayRoute = [...d.startRoute!];
            this.replayApplied = 0;
        }
        while (this.replayApplied < count) {
            const [i, j] = d.moves![this.replayApplied++];
            reverse(this.replayRoute, i, j);
        }
        return this.replayRoute;
    }

    // ---------------------------------------------------------------------------
    /** Phase 2. t = seconds since the raccoon left its den. */
    drawWalking(t: number): void {
        const d = this.data;
        if (!d || !this.ctx) {
            return;
        }
        this.clear();
        const { order, arrivalTimes } = d.solution;
        const n = order.length;
        const k = eatenCount(arrivalTimes, t);           // items eaten so far
        const [rx, ry] = this.raccoonAt(t, k);

        // Greedy "thinking": faint lines to every candidate it weighed for this step
        if (d.decisions && k < n) {
            const dec = d.decisions[k];
            const ctx = this.ctx;
            ctx.save();
            ctx.strokeStyle = COLORS.inkMuted;
            ctx.globalAlpha = 0.28;
            ctx.lineWidth = 0.75;
            ctx.beginPath();
            for (const c of dec.candidates) {
                if (c === dec.chosen) {
                    continue;
                }
                ctx.moveTo(this.px(dec.fromX), this.py(dec.fromY));
                ctx.lineTo(this.px(d.instance.items[c].x), this.py(d.instance.items[c].y));
            }
            ctx.stroke();
            ctx.restore();
        }

        // 2-opt planned ahead: dashed line through the rest of its route
        if (d.key === "two_opt" && k < n && n <= SHOW_PLAN_MAX_N) {
            const ctx = this.ctx;
            ctx.save();
            ctx.setLineDash([3, 4]);
            ctx.strokeStyle = ALGORITHM_COLORS.two_opt;
            ctx.globalAlpha = 0.45;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(this.px(rx), this.py(ry));
            for (let p = k; p < n; p++) {
                ctx.lineTo(this.px(d.instance.items[order[p]].x), this.py(d.instance.items[order[p]].y));
            }
            ctx.stroke();
            ctx.restore();
        }

        // Trail walked so far
        const trail: [number, number][] = [[...d.instance.start] as [number, number]];
        for (let p = 0; p < k; p++) {
            trail.push([d.instance.items[order[p]].x, d.instance.items[order[p]].y]);
        }
        trail.push([rx, ry]);
        this.strokePoints(trail, ALGORITHM_COLORS[d.key], 2, 0.9);

        this.drawItems(t, true);
        this.drawDen();
        this.drawRaccoon(rx, ry);
    }

    /** Where the raccoon is at time t (k = items already eaten). */
    private raccoonAt(t: number, k: number): [number, number] {
        const d = this.data!;
        const { order, arrivalTimes } = d.solution;
        const items = d.instance.items;
        if (order.length === 0) {
            return [...d.instance.start] as [number, number];
        }
        if (k >= order.length) {
            const last = items[order[order.length - 1]];
            return [last.x, last.y];
        }
        const [fx, fy] = k === 0 ? d.instance.start : [items[order[k - 1]].x, items[order[k - 1]].y];
        const target = items[order[k]];
        const t0 = k === 0 ? 0 : arrivalTimes[k - 1];
        const leg = arrivalTimes[k] - t0;
        const f = leg > 0 ? Math.min(1, Math.max(0, (t - t0) / leg)) : 1;
        return [fx + (target.x - fx) * f, fy + (target.y - fy) * f];
    }

    // ---------------------------------------------------------------------------
    private clear(): void {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.size, this.size);
        ctx.fillStyle = COLORS.surface;
        ctx.fillRect(0, 0, this.size, this.size);
        ctx.strokeStyle = COLORS.axis;
        ctx.lineWidth = 1;
        ctx.strokeRect(this.pad - 0.5, this.pad - 0.5, this.size - 2 * this.pad + 1, this.size - 2 * this.pad + 1);
    }

    private drawItems(t: number, walking: boolean): void {
        const d = this.data!;
        const ctx = this.ctx;
        const n = d.instance.items.length;
        const r = this.markerRadius();
        const showBars = n <= SHOW_FRESHNESS_MAX_N;
        const showOrder = walking && n <= SHOW_ORDER_MAX_N;
        ctx.font = `600 ${Math.max(9, Math.round(r * 1.5))}px system-ui, sans-serif`;
        ctx.textBaseline = "middle";

        for (const it of d.instance.items) {
            const x = this.px(it.x);
            const y = this.py(it.y);
            const style = foodStyle(it.food.name);
            const eaten = walking && this.eatenAt[it.id] <= t;
            const fresh = freshnessAt(it, t);

            if (eaten) {
                // eaten: a faint ghost of the marker (+ the order it was eaten in)
                ctx.globalAlpha = 0.2;
                traceShape(ctx, style.shape, x, y, r);
                ctx.fillStyle = style.color;
                ctx.fill();
                ctx.globalAlpha = 1;
                if (showOrder) {
                    ctx.fillStyle = COLORS.inkSecondary;
                    ctx.fillText(String(this.rank[it.id] + 1), x + r + 2, y - r);
                }
                continue;
            }

            traceShape(ctx, style.shape, x, y, r);
            ctx.fillStyle = fresh <= 0 ? COLORS.rottenFood : style.color;   // spoiled = worth 0
            ctx.fill();
            if (r >= 3.5) {                          // 2px surface ring keeps overlaps legible
                ctx.strokeStyle = COLORS.surface;
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }

            if (showBars) {
                const w = Math.max(14, r * 3.2);
                const h = 3;
                const bx = x - w / 2;
                const by = y + r + 4;
                ctx.fillStyle = COLORS.grid;
                ctx.fillRect(bx, by, w, h);
                if (fresh <= 0) {
                    ctx.fillStyle = COLORS.spoiled;
                    ctx.fillRect(bx, by, w, h);
                } else {
                    ctx.fillStyle = fresh < STALE_BELOW ? COLORS.stale : COLORS.fresh;
                    ctx.fillRect(bx, by, w * fresh, h);
                }
            }
        }
    }

    private drawDen(): void {
        const [dx, dy] = this.data!.instance.start;
        const s = Math.max(8, this.markerRadius() * 1.8);
        const ctx = this.ctx;
        ctx.fillStyle = COLORS.den;
        ctx.strokeStyle = COLORS.surface;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(this.px(dx) - s / 2, this.py(dy) - s / 2, s, s, 2);
        ctx.fill();
        ctx.stroke();
    }

    private drawRaccoon(x: number, y: number): void {
        const ctx = this.ctx;
        const r = Math.max(5, this.markerRadius() * 1.1);
        ctx.beginPath();
        ctx.arc(this.px(x), this.py(y), r, 0, Math.PI * 2);
        ctx.fillStyle = COLORS.raccoon;
        ctx.fill();
        ctx.strokeStyle = COLORS.surface;
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    /** Stroke den -> route items (or just the items when fromDen is false). */
    private strokeRoute(ids: readonly number[], color: string, width: number, alpha: number, fromDen = true): void {
        const items = this.data!.instance.items;
        const pts: [number, number][] = ids.map((id) => [items[id].x, items[id].y]);
        if (fromDen) {
            pts.unshift([...this.data!.instance.start] as [number, number]);
        }
        this.strokePoints(pts, color, width, alpha);
    }

    private strokePoints(pts: [number, number][], color: string, width: number, alpha: number): void {
        if (pts.length < 2) {
            return;
        }
        const ctx = this.ctx;
        ctx.save();
        ctx.strokeStyle = color;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = width;
        ctx.beginPath();
        pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(this.px(x), this.py(y)) : ctx.lineTo(this.px(x), this.py(y))));
        ctx.stroke();
        ctx.restore();
    }
}

/** Number of arrival times <= t (binary search; arrival times are sorted). */
export function eatenCount(arrivalTimes: readonly number[], t: number): number {
    let lo = 0;
    let hi = arrivalTimes.length;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (arrivalTimes[mid] <= t) {
            lo = mid + 1;
        } else {
            hi = mid;
        }
    }
    return lo;
}
