// =============================================================================
//  AI-GENERATED FILE  -  written by Claude (Anthropic AI), 2026-11-12,
//  at the request of George Rule. See ../../../ai-claude/AI_CONTRIBUTIONS.md for the full log.
//  Human edits: please tag changed lines with   // [EDIT: <your name>]
// =============================================================================
/**
 * The scaling study behind the "How they scale" charts, run in the browser.
 *
 * For every map size n it builds QUALITY_MAPS_PER_SIZE random maps (fixed seeds, so the
 * calorie results are the same on every computer) and records
 *   - planning time of Greedy and Subset DP on the first MAPS_PER_SIZE of them
 *     (the project asks for at least 10 instances per size),
 *   - how many calories Subset DP's optimal route beats Greedy's by (on all of them).
 * Greedy is also timed on large maps, where its Theta(n^2) curve is visible.
 *
 * Trendlines: the project asks for a trendline "from the theoretical analysis", so each
 * algorithm's times are fitted to  ms = a * f(n) + b  with f(n) its Theta bound, by
 * ordinary least squares (the closed-form simple linear regression on x = f(n)), and
 * R^2 = 1 - SS_res / SS_tot reports how well the theory curve matches.
 *
 * It runs in small steps and yields to the browser between them, so the page stays
 * responsive and the charts can fill in as results arrive.
 */
import { generateInstance } from "./generator";
import * as greedy from "./greedy";
import * as subsetDp from "./subsetDp";
import { totalCalories } from "./problem";
import { timeIt } from "./race";

export const MAPS_PER_SIZE = 10;                                       // timed maps per size (the project asks for >= 10)
export const QUALITY_MAPS_PER_SIZE = 20;                               // maps per size for the calorie charts
export const EXACT_SIZES = Array.from({ length: 13 }, (_, k) => k + 2);  // n = 2 .. 14
export const GREEDY_LARGE_SIZES = [100, 200, 300, 400, 500, 600, 800, 1000, 1200, 1500];

/** Each timed call repeats until this much time passes (keeps tiny times accurate). */
const MIN_MS = 6;

export interface TimePoint {
    n: number;
    ms: number;
}

export interface QualityPoint {
    n: number;
    seed: number;
    extraCalories: number;       // Subset DP score - Greedy score (>= 0)
    extraPercent: number;        // the same, as % of all the calories on the map
    extraSpoilagePercent: number; // how much MORE Greedy lost to spoilage than the optimum, in %
    greedyOptimal: boolean;      // Greedy happened to find a best route
}

export interface ScalingData {
    time: { greedy: TimePoint[]; subset_dp: TimePoint[] };   // n = 2..14, same maps for both
    greedyLarge: TimePoint[];                               // Greedy alone on big maps
    quality: QualityPoint[];
}

export const emptyScaling = (): ScalingData => ({
    time: { greedy: [], subset_dp: [] },
    greedyLarge: [],
    quality: [],
});

/** Fixed seed of the r-th map of size n (so every computer measures the same maps). */
export const seedFor = (n: number, r: number): number => 50_000 + 100 * n + r;

/** The study as a list of small jobs (one map each). */
function jobs(data: ScalingData): (() => void)[] {
    const list: (() => void)[] = [];
    // warm up the JIT compiler so the first sizes are not penalised
    list.push(() => {
        for (let r = 0; r < 30; r++) {
            const inst = generateInstance(8, r);
            greedy.solve(inst);
            subsetDp.solve(inst);
        }
    });
    for (const n of EXACT_SIZES) {
        for (let r = 0; r < QUALITY_MAPS_PER_SIZE; r++) {
            const timed = r < MAPS_PER_SIZE;
            list.push(() => {
                const inst = generateInstance(n, seedFor(n, r));
                let g = greedy.solve(inst).solution;      // Greedy's route
                let h = subsetDp.solve(inst).solution;    // the optimal route
                if (timed) {   // time both (the timed runs return the same routes again)
                    data.time.greedy.push({ n, ms: timeIt(() => (g = greedy.solve(inst).solution), MIN_MS, false) });
                    data.time.subset_dp.push({ n, ms: timeIt(() => (h = subsetDp.solve(inst).solution), MIN_MS, false) });
                }
                // Subset DP is optimal, so extra >= 0 (clamped against float noise)
                const extra = Math.max(0, h.totalScore - g.totalScore);
                data.quality.push({
                    n,
                    seed: seedFor(n, r),
                    extraCalories: extra,
                    extraPercent: (extra / totalCalories(inst)) * 100,
                    extraSpoilagePercent: h.spoilageLoss > 0 ? (extra / h.spoilageLoss) * 100 : 0,
                    greedyOptimal: extra < 1e-6,
                });
            });
        }
    }
    for (const n of GREEDY_LARGE_SIZES) {
        for (let r = 0; r < MAPS_PER_SIZE; r++) {
            list.push(() => {
                const inst = generateInstance(n, seedFor(n, r));
                data.greedyLarge.push({ n, ms: timeIt(() => greedy.solve(inst), MIN_MS, false) });
            });
        }
    }
    return list;
}

/**
 * Run the whole study. `onUpdate(done, total)` is called after every job (redraw there).
 * Returns false if `shouldStop()` became true first.
 */
export async function runScaling(
    data: ScalingData,
    onUpdate: (done: number, total: number) => void,
    shouldStop: () => boolean = () => false,
): Promise<boolean> {
    const list = jobs(data);
    for (let k = 0; k < list.length; k++) {
        if (shouldStop()) {
            return false;
        }
        list[k]();
        onUpdate(k + 1, list.length);
        await new Promise((resolve) => setTimeout(resolve, 0));   // let the page breathe
    }
    return true;
}

// ---------------------------------------------------------------------------
// Theory curves and the least-squares trendline the project asks for
// ---------------------------------------------------------------------------

/**
 * f(n) for each algorithm's Theta bound.
 *   Greedy:    n^2         (lines 9-14 of its pseudocode run n(n+1)/2 times)
 *   Subset DP: n^2 * 2^n   (Held & Karp 1962; for the repairman objective Wu et al. 2004; the label-list
 *                           factor F is small and treated as a constant)
 */
export const GROWTH: Record<"greedy" | "subset_dp", { label: string; f: (n: number) => number }> = {
    greedy: { label: "a·n² + b", f: (n) => n * n },
    subset_dp: { label: "a·n²·2ⁿ + b", f: (n) => n * n * 2 ** n },
};

export interface Fit {
    a: number;
    b: number;
    r2: number;
    at: (n: number) => number;
}

/** Least squares for  ms = a * f(n) + b  over every measured point. */
export function fitGrowth(points: readonly TimePoint[], f: (n: number) => number): Fit | null {
    if (points.length < 3) {
        return null;
    }
    const xs = points.map((p) => f(p.n));
    const ys = points.map((p) => p.ms);
    const mx = mean(xs);
    const my = mean(ys);
    let sxy = 0;
    let sxx = 0;
    for (let i = 0; i < xs.length; i++) {
        sxy += (xs[i] - mx) * (ys[i] - my);
        sxx += (xs[i] - mx) ** 2;
    }
    if (sxx === 0) {
        return null;
    }
    const a = sxy / sxx;
    const b = my - a * mx;
    let ssRes = 0;
    let ssTot = 0;
    for (let i = 0; i < xs.length; i++) {
        ssRes += (ys[i] - (a * xs[i] + b)) ** 2;
        ssTot += (ys[i] - my) ** 2;
    }
    return { a, b, r2: ssTot > 0 ? 1 - ssRes / ssTot : 1, at: (n) => a * f(n) + b };
}

export const mean = (v: readonly number[]): number => v.reduce((s, x) => s + x, 0) / Math.max(1, v.length);

/** Group values by n: [[n, values], ...] sorted by n. */
export function byN<T extends { n: number }>(points: readonly T[], value: (p: T) => number): [number, number[]][] {
    const groups = new Map<number, number[]>();
    for (const p of points) {
        const g = groups.get(p.n) ?? [];
        g.push(value(p));
        groups.set(p.n, g);
    }
    return [...groups.entries()].sort((a, b) => a[0] - b[0]);
}
