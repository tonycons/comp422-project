// =============================================================================
//  AI-GENERATED FILE  -  written by Claude (Anthropic AI), 2026-11-12,
//  at the request of George Rule. See ../../../AI_CONTRIBUTIONS.md for the full log.
//  Updated 2026-11-14 (Claude): the label-dominance code (was pareto.ts) now lives here;
//  pseudocode and analysis moved to the project report.
//  Human edits: please tag changed lines with   // [EDIT: <your name>]
// =============================================================================
/**
 * CLEVER ALGORITHM: Subset DP (exact; always finds the best route).
 *
 * A table with one cell per (set of items S, item j eaten last), filled for small sets
 * first. Because spoiled food stops losing calories, the cost of finishing a route depends
 * on the clock, so a cell keeps a short list of (t, lost) labels (the clock and the
 * calories lost so far) instead of one number, and drops only the labels another label
 * dominates (see nonDominated() below).
 *
 * O(n^2 * 2^n * F) time and O(n * 2^n * F) memory, F = the longest label list (small in
 * practice; solve() reports it as stats.maxFront).
 * Pseudocode, correctness proof and sources: see the project report.
 */
import { distance, evaluateRoute, spoilWeight, type Problem, type Solution } from "../core/problem";

export const INFO = {
    key: "subset_dp" as const,
    name: "Subset DP",
    tagline: "plans the whole route before leaving",
    timeComplexity: "Θ(n²·2ⁿ)",
    memoryComplexity: "Θ(n·2ⁿ)",
};

/** Exponential memory: above this many items the table would not fit in a browser tab. */
export const MAX_N = 16;

/** One DP label: reached the cell's last item at `t` having lost `loss` calories. */
export interface Label {
    t: number;
    loss: number;
    i: number;   // item eaten just before (-1 = came from the den)
    k: number;   // index of the label it extends inside cell (S - {j}, i)
}

/** Counts recorded for the planning animation and the "work done" charts. */
export interface SubsetDpStats {
    cells: number;              // (S, j) cells filled = n * 2^(n-1)
    candidates: number;         // candidate labels built (the real work)
    maxFront: number;           // F in the running-time bound
    cellsBySize: number[];      // cellsBySize[s] = cells whose set has s items = s * C(n, s)
    bestLoss: number;           // DP's optimal loss (equals solution.spoilageLoss)
}

/** One frame of the planning animation: the cheapest way the table found to eat set S. */
export interface Snapshot {
    set: number;        // the bitmask S
    route: number[];    // its best partial route (item ids, den first)
}

export interface SubsetDpResult {
    solution: Solution;
    stats: SubsetDpStats;
    snapshots: Snapshot[] | null;   // only when asked for (it is for the animation, not the answer)
}

/**
 * @param snapshots  if > 0, also record this many evenly spaced "best partial route
 *                   for set S" frames for the planning animation (read from the
 *                   finished table, so they never change the answer).
 */
export function solve(inst: Problem, snapshots = 0): SubsetDpResult {
    const items = inst.items;
    const n = items.length;
    if (n > MAX_N) {
        throw new Error(`Subset DP needs 2^n memory; n = ${n} is above the limit of ${MAX_N}`);
    }
    if (n === 0) {
        return {
            solution: evaluateRoute(inst, [], "subset_dp"),
            stats: { cells: 0, candidates: 0, maxFront: 0, cellsBySize: [0], bestLoss: 0 },
            snapshots: snapshots > 0 ? [] : null,
        };
    }

    // travel times between every pair of items, and from the den
    const T = items.map((a) => items.map((b) => distance(a.x, a.y, b.x, b.y) / inst.speed));
    const T0 = items.map((it) => distance(inst.start[0], inst.start[1], it.x, it.y) / inst.speed);
    // loss of eating j at time t = cal[j] * min(1, dec[j] * t)  (same formula as lossAt in problem.ts)
    const cal = items.map((it) => it.food.calories);
    const dec = items.map((it) => 1.0 / it.food.shelfLife);
    const w = items.map((it) => spoilWeight(it.food));   // calories lost per second while fresh
    const shelf = items.map((it) => it.food.shelfLife);
    const shelfClasses = [...new Set(shelf)].sort((a, b) => a - b);   // one class per food type
    const classOf = shelf.map((s) => shelfClasses.indexOf(s));

    const numSubsets = 1 << n;          // 2^n
    const ALL = numSubsets - 1;  // bitmask containing every item

    // table[S * n + j] = label list of cell (S, j); empty when j is not in S
    const table: Label[][] = new Array(numSubsets * n);
    const EMPTY: Label[] = [];
    table.fill(EMPTY);

    const stats: SubsetDpStats = {
        cells: 0, candidates: 0, maxFront: 1,
        cellsBySize: new Array(n + 1).fill(0), bestLoss: 0,
    };

    // base case: walk straight from the den to j
    for (let j = 0; j < n; j++) {
        const t = T0[j];
        table[(1 << j) * n + j] = [{ t, loss: cal[j] * Math.min(1.0, dec[j] * t), i: -1, k: -1 }];
        stats.cells++;
        stats.cellsBySize[1]++;
    }

    /** W_live(t) for the items NOT in S: their total spoil weight w, counting only items whose shelf life is longer than t. */
    const liveWeight = (S: number): ((t: number) => number) => {
        const perClass = new Array(shelfClasses.length).fill(0.0);
        for (let k = 0; k < n; k++) {
            if (!((S >> k) & 1)) {
                perClass[classOf[k]] += w[k];
            }
        }
        return (t: number) => {
            let sum = 0;
            for (let c = 0; c < shelfClasses.length; c++) {
                if (shelfClasses[c] > t) {
                    sum += perClass[c];
                }
            }
            return sum;
        };
    };

    // Candidate labels for one cell, as parallel arrays (grown when needed; no per-label objects)
    let capacity = 1024;
    let candT = new Float64Array(capacity);
    let candLoss = new Float64Array(capacity);
    let candI = new Int32Array(capacity);
    let candK = new Int32Array(capacity);

    // every subset S in increasing integer order (so S - {j} is always finished first)
    for (let S = 1; S < numSubsets; S++) {
        if ((S & (S - 1)) === 0) {
            continue;                       // one item only: the base case above
        }
        const size = popcount(S);
        const wLive = liveWeight(S);        // the same for every j in S
        for (let j = 0; j < n; j++) {  // j = the item eaten LAST in S
            if (!((S >> j) & 1)) {
                continue;
            }
            const prev = S ^ (1 << j);  // the items eaten before j
            const calJ = cal[j];
            const decJ = dec[j];
            let m = 0;  // number of candidates so far
            for (let i = 0; i < n; i++) {  // i = the item eaten just before j
                if (!((prev >> i) & 1)) {
                    continue;
                }
                const travel = T[i][j];
                const labels = table[prev * n + i];
                if (m + labels.length > capacity) {
                    capacity = 2 * (m + labels.length);
                    candT = grow(candT, capacity);
                    candLoss = grow(candLoss, capacity);
                    candI = grow(candI, capacity);
                    candK = grow(candK, capacity);
                }
                for (let k = 0; k < labels.length; k++) {
                    const t2 = labels[k].t + travel;
                    candT[m] = t2;
                    candLoss[m] = labels[k].loss + calJ * Math.min(1.0, decJ * t2);
                    candI[m] = i;
                    candK[m] = k;
                    m++;
                }
            }
            const keep = nonDominated(candT, candLoss, m, wLive);
            table[S * n + j] = keep.map((c) => ({ t: candT[c], loss: candLoss[c], i: candI[c], k: candK[c] }));
            stats.cells++;
            stats.cellsBySize[size]++;
            stats.candidates += m;
            if (keep.length > stats.maxFront) {
                stats.maxFront = keep.length;
            }
        }
    }

    // the cheapest finished label, then follow its back-pointers
    const { loss: bestLoss, route } = bestRoute(table, n, ALL);
    stats.bestLoss = bestLoss;

    let frames: Snapshot[] | null = null;
    if (snapshots > 0) {
        frames = [];
        for (let f = 1; f <= snapshots; f++) {
            const set = Math.max(1, Math.round((f / snapshots) * ALL));
            frames.push({ set, route: bestRoute(table, n, set).route });
        }
    }

    return { solution: evaluateRoute(inst, route, "subset_dp"), stats, snapshots: frames };
}

/** For any set S: its cheapest label over every last item, then the route back to the den. */
function bestRoute(table: Label[][], n: number, set: number): { loss: number; route: number[] } {
    let bestLoss = Infinity;
    let j = -1;
    let k = -1;
    for (let last = 0; last < n; last++) {
        const labels = table[set * n + last];
        for (let idx = 0; idx < labels.length; idx++) {
            if (labels[idx].loss < bestLoss) {
                bestLoss = labels[idx].loss;
                j = last;
                k = idx;
            }
        }
    }
    const route: number[] = [];  // walk back to the den
    let S = set;
    while (j !== -1) {
        route.push(j);
        const label = table[S * n + j][k];
        S ^= 1 << j;
        j = label.i;
        k = label.k;
    }
    route.reverse();
    return { loss: bestLoss, route };
}

// -----------------------------------------------------------------------------
// Keeping the non-dominated labels
// -----------------------------------------------------------------------------
/** Treat losses this close as equal, so two labels that differ only by float noise are not both kept. */
const EPS = 1e-9;

/**
 * Indices of the labels no other label dominates, sorted by time.
 * A dominates B (B is dropped) when  loss_A + max(0, t_A - t_B) * W_live(t_B) <= loss_B,
 * where W_live(t) = spoil weight of the uneaten items still fresh at time t.
 * Labels come as parallel arrays (time[k], loss[k]) for k = 0 .. count-1, so the inner
 * loop of solve() does not allocate an object per candidate.
 * O(m log m + m * f) for m candidate labels and f survivors.
 */
function nonDominated(time: ArrayLike<number>, loss: ArrayLike<number>, count: number, wLive: (t: number) => number): number[] {
    const sorted = sortByTimeThenLoss(time, loss, count);
    const kept: number[] = [];
    for (let s = 0; s < count; s++) {
        const idx = sorted[s];
        const t = time[idx];
        const c = loss[idx];
        // Case t_A <= t_B: every kept label is no later than this one, and kept losses only
        // go down, so the last kept label is the cheapest one to compare against.
        if (kept.length > 0 && loss[kept[kept.length - 1]] <= c + EPS) {
            continue;
        }
        // Case t_A > t_B: this later-but-cheaper label may dominate some earlier ones (drop those, keep order).
        let w = 0;
        for (let r = 0; r < kept.length; r++) {
            const k = kept[r];
            if (c + (t - time[k]) * wLive(time[k]) > loss[k] - EPS) {
                kept[w++] = k;
            }
        }
        kept.length = w;
        kept.push(idx);
    }
    return kept;
}

let scratch = new Int32Array(256);

/**
 * Indices 0..count-1 sorted by (time, loss), ties kept in their original order (a stable
 * sort). The lists are short, so insertion sort is the fastest choice; long lists fall
 * back to Array.sort. Returns a shared scratch buffer: read it before calling again.
 */
function sortByTimeThenLoss(time: ArrayLike<number>, loss: ArrayLike<number>, count: number): Int32Array {
    if (count > scratch.length) {
        scratch = new Int32Array(2 * count);
    }
    const a = scratch;
    if (count > 64) {
        const idx = Array.from({ length: count }, (_, k) => k);
        idx.sort((x, y) => time[x] - time[y] || loss[x] - loss[y]);
        a.set(idx);
        return a;
    }
    for (let k = 0; k < count; k++) {
        const tk = time[k];
        const lk = loss[k];
        let p = k - 1;
        // shift right everything that must come AFTER label k (strictly greater keeps it stable)
        while (p >= 0 && (time[a[p]] > tk || (time[a[p]] === tk && loss[a[p]] > lk))) {
            a[p + 1] = a[p];
            p--;
        }
        a[p + 1] = k;
    }
    return a;
}

// -----------------------------------------------------------------------------
// Small helpers
// -----------------------------------------------------------------------------
/** Copy a typed array into a bigger one. */
function grow<A extends Float64Array | Int32Array>(a: A, size: number): A {
    const b = new (a.constructor as new (n: number) => A)(size);
    b.set(a);
    return b;
}

/** Number of 1 bits (items in the set). */
export function popcount(x: number): number {
    let c = 0;
    while (x) {
        x &= x - 1;
        c++;
    }
    return c;
}
