// =============================================================================
//  AI-GENERATED FILE  -  written by Claude (Anthropic AI), 2026-11-12,
//  at the request of George Rule. See ../../../ai-claude/AI_CONTRIBUTIONS.md for the full log.
//  Human edits: please tag changed lines with   // [EDIT: <your name>]
// =============================================================================
/**
 * CLEVER ALGORITHM: Held-Karp dynamic programming
 * (TypeScript port of ai-claude/raccoon/algorithms/held_karp.py -- same decisions, same [Lx] tags)
 *
 * The classic Held-Karp table (Held & Karp 1962; Bellman 1962):
 *
 *     C(S, j) = cheapest way to eat exactly the items in set S, eating j last
 *     C({j}, j) = cost of walking straight from the den to j
 *     C(S, j)   = min over i in S - {j} of  C(S - {j}, i) + (cost of walking i -> j and eating j)
 *     answer    = min over j of C(ALL, j)
 *
 * Fill the table for small sets first, so C(S - {j}, i) is always ready.
 *
 * The one change for the raccoon: an item's loss is w * min(arrival time, shelf life),
 * so what it costs to finish the route depends on the CLOCK, not just on which items
 * are left. A cell therefore keeps a short list of (time, loss) "labels" instead of one
 * number, and drops a label only when another one is at least as good on both counts
 * (dominance rules: see pareto.ts). If food never spoiled, each list would shrink
 * to exactly one label and this would be the textbook table.
 *
 *     HELD-KARP-RACCOON(items, den, speed)
 *      1  T[i][j] = travel time i -> j for every pair;  T0[j] = travel time den -> j
 *      2  for each item j:  C[{j}][j] = { (T0[j], loss_j(T0[j])) }
 *      3  for each subset S, smallest first (|S| >= 2)
 *      4      for each item j in S                        ▹ j = eaten last
 *      5          prev = S - {j};  candidates = empty list
 *      6          for each item i in prev                  ▹ i = eaten just before j
 *      7              for each label (t, c) in C[prev][i]
 *      8                  t' = t + T[i][j];  add (t', c + loss_j(t')) to candidates
 *      9          C[S][j] = PARETO-FRONT(candidates)       ▹ keep non-dominated labels
 *     10  best = the label with the smallest loss in any C[ALL][j]
 *     11  follow the back-pointers from best to rebuild the route
 *     12  return route
 *
 * Running time O(n^2 * 2^n * F): line 3 runs 2^n times, line 4 and line 6 n times each,
 * line 7 at most F times (F = longest label list, small in practice; solve() reports it).
 * Memory O(n * 2^n * F): one list per (S, j) cell.
 *
 * Sets are bitmasks: bit k of S is 1 when item k is in S, so "S - {j}" is S ^ (1 << j)
 * and it is always a smaller integer than S. That is why counting S = 1, 2, 3, ...
 * fills every smaller set first (line 3).
 *
 * Why it is optimal: every order of the items is some path through the table (eat the
 * first item, then the second, ...), and a label is only dropped when another label in
 * the SAME cell does at least as well however the route is finished (pareto.ts). So the
 * best finished label on line 10 is the best of all n! orders.
 *
 * References
 *  - M. Held and R. M. Karp, "A dynamic programming approach to sequencing problems",
 *    J. Society for Industrial and Applied Mathematics 10(1):196-210, 1962.
 *    doi:10.1137/0110015   (the C(S, j) recurrence and its O(n^2 * 2^n) bound)
 *  - R. Bellman, "Dynamic programming treatment of the travelling salesman problem",
 *    J. ACM 9(1):61-63, 1962. doi:10.1145/321105.321111   (the same DP, found independently)
 *  - Y. Dumas, J. Desrosiers, E. Gelinas, M. M. Solomon, "An optimal algorithm for the
 *    traveling salesman problem with time windows", Operations Research 43(2):367-371,
 *    1995. doi:10.1287/opre.43.2.367   (DP whose states carry (time, cost) labels with
 *    dominance tests: the idea behind keeping a label list per cell)
 *  - A. Blum, P. Chalasani, D. Coppersmith, B. Pulleyblank, P. Raghavan, M. Sudan,
 *    "The minimum latency problem", STOC 1994, 163-171. doi:10.1145/195058.195125
 *    (the sum-of-arrival-times objective our scoring is a weighted, capped version of)
 *  - TypeScript port of ai-claude/raccoon/algorithms/held_karp.py; the [Lx] tags below
 *    match the pseudocode line numbers above.
 */
import { paretoFront, liveWeightFunction } from "./pareto";
import { distance, evaluateRoute, type Problem, type Solution } from "./problem";

export const INFO = {
    key: "held_karp" as const,
    name: "Held-Karp",
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
export interface HeldKarpStats {
    cells: number;              // (S, j) cells filled = n * 2^(n-1)
    labelsKept: number;         // labels stored over the whole table
    candidates: number;         // labels built on line 8 (the real work)
    maxFront: number;           // F in the running-time bound
    cellsBySize: number[];      // cellsBySize[s] = cells whose set has s items = s * C(n, s)
    bestLoss: number;           // DP's optimal loss (equals solution.spoilageLoss)
}

/** One frame of the planning animation: the cheapest way the table found to eat set S. */
export interface Snapshot {
    set: number;        // the bitmask S
    route: number[];    // its best partial route (item ids, den first)
}

export interface HeldKarpResult {
    solution: Solution;
    stats: HeldKarpStats;
    snapshots: Snapshot[] | null;   // only when asked for (it is for the animation, not the answer)
}

/**
 * @param snapshots  if > 0, also record this many evenly spaced "best partial route
 *                   for set S" frames for the planning animation (read from the
 *                   finished table, so they never change the answer).
 */
export function solve(inst: Problem, snapshots = 0): HeldKarpResult {
    const items = inst.items;
    const n = items.length;
    if (n > MAX_N) {
        throw new Error(`Held-Karp needs 2^n memory; n = ${n} is above the limit of ${MAX_N}`);
    }
    if (n === 0) {
        return {
            solution: evaluateRoute(inst, [], "held_karp"),
            stats: { cells: 0, labelsKept: 0, candidates: 0, maxFront: 0, cellsBySize: [0], bestLoss: 0 },
            snapshots: snapshots > 0 ? [] : null,
        };
    }

    // [L1] travel times between every pair of items, and from the den
    const T = items.map((a) => items.map((b) => distance(a.x, a.y, b.x, b.y) / inst.speed));
    const T0 = items.map((it) => distance(inst.start[0], inst.start[1], it.x, it.y) / inst.speed);
    // loss of eating j at time t = cal[j] * min(1, dec[j] * t)  (same formula as lossAt in problem.ts)
    const cal = items.map((it) => it.food.calories);
    const dec = items.map((it) => 1.0 / it.food.shelfLife);
    const w = items.map((it) => it.food.calories * (1.0 / it.food.shelfLife));   // spoil weight
    const shelf = items.map((it) => it.food.shelfLife);
    const shelfClasses = [...new Set(shelf)].sort((a, b) => a - b);   // one class per food type
    const classOf = shelf.map((s) => shelfClasses.indexOf(s));

    const numSubsets = 1 << n;          // 2^n
    const ALL = numSubsets - 1;         // bitmask containing every item

    // table[S * n + j] = label list of cell (S, j); empty when j is not in S
    const table: Label[][] = new Array(numSubsets * n);
    const EMPTY: Label[] = [];
    table.fill(EMPTY);

    const stats: HeldKarpStats = {
        cells: 0, labelsKept: 0, candidates: 0, maxFront: 1,
        cellsBySize: new Array(n + 1).fill(0), bestLoss: 0,
    };

    // [L2] base case: walk straight from the den to j
    for (let j = 0; j < n; j++) {
        const t = T0[j];
        table[(1 << j) * n + j] = [{ t, loss: cal[j] * Math.min(1.0, dec[j] * t), i: -1, k: -1 }];
        stats.cells++;
        stats.labelsKept++;
        stats.cellsBySize[1]++;
    }

    /** W_live(t) for the items NOT in S (pareto.ts, Rule 2). Theta(n) to build. */
    const remainingWeight = (S: number) => {
        const perClass = new Array(shelfClasses.length).fill(0.0);
        for (let k = 0; k < n; k++) {
            if (!((S >> k) & 1)) {
                perClass[classOf[k]] += w[k];
            }
        }
        return liveWeightFunction(shelfClasses.map((s, c) => [s, perClass[c]] as [number, number]));
    };

    // Candidate labels for one cell, as parallel arrays (grown when needed; no per-label objects)
    let capacity = 1024;
    let candT = new Float64Array(capacity);
    let candLoss = new Float64Array(capacity);
    let candI = new Int32Array(capacity);
    let candK = new Int32Array(capacity);

    // [L3] every subset S in increasing integer order (so S - {j} is always finished first)
    for (let S = 1; S < numSubsets; S++) {
        if ((S & (S - 1)) === 0) {
            continue;                       // one item only: the base case above
        }
        const size = popcount(S);
        const wLive = remainingWeight(S);   // the same for every j in S
        for (let j = 0; j < n; j++) {       // [L4] j = the item eaten LAST in S
            if (!((S >> j) & 1)) {
                continue;
            }
            const prev = S ^ (1 << j);      // [L5] the items eaten before j
            const calJ = cal[j];
            const decJ = dec[j];
            let m = 0;                      // number of candidates so far
            for (let i = 0; i < n; i++) {   // [L6] i = the item eaten just before j
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
                for (let k = 0; k < labels.length; k++) {               // [L7]
                    const t2 = labels[k].t + travel;                    // [L8]
                    candT[m] = t2;
                    candLoss[m] = labels[k].loss + calJ * Math.min(1.0, decJ * t2);
                    candI[m] = i;
                    candK[m] = k;
                    m++;
                }
            }
            const keep = paretoFront(candT, candLoss, m, wLive);        // [L9]
            table[S * n + j] = keep.map((c) => ({ t: candT[c], loss: candLoss[c], i: candI[c], k: candK[c] }));
            stats.cells++;
            stats.cellsBySize[size]++;
            stats.candidates += m;
            stats.labelsKept += keep.length;
            if (keep.length > stats.maxFront) {
                stats.maxFront = keep.length;
            }
        }
    }

    // [L10] + [L11] the cheapest finished label, then follow its back-pointers
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

    return { solution: evaluateRoute(inst, route, "held_karp"), stats, snapshots: frames };   // [L12]
}

/** Lines 10-11 for any set S: its cheapest label over every last item, then the back-pointers. */
function bestRoute(table: Label[][], n: number, set: number): { loss: number; route: number[] } {
    let bestLoss = Infinity;
    let j = -1;
    let k = -1;
    for (let last = 0; last < n; last++) {                  // [L10]
        const labels = table[set * n + last];
        for (let idx = 0; idx < labels.length; idx++) {
            if (labels[idx].loss < bestLoss) {
                bestLoss = labels[idx].loss;
                j = last;
                k = idx;
            }
        }
    }
    const route: number[] = [];                             // [L11] walk back to the den
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

/** Binomial coefficient C(n, s): how many sets of s items there are. */
export function choose(n: number, s: number): number {
    let r = 1;
    for (let k = 1; k <= s; k++) {
        r = (r * (n - s + k)) / k;
    }
    return Math.round(r);
}
