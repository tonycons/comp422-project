// =============================================================================
//  AI-GENERATED FILE  -  written by Claude (Anthropic AI), 2026-11-12,
//  at the request of George Rule. See ../../../ai-claude/AI_CONTRIBUTIONS.md for the full log.
//  Human edits: please tag changed lines with   // [EDIT: <your name>]
// =============================================================================
/**
 * CLEVER ALGORITHM: Subset DP (subset dynamic programming with label dominance)
 * (TypeScript port of ai-claude/raccoon/algorithms/subset_dp.py -- same decisions, same [Lx] tags)
 *
 * The (set, last item) table of Held & Karp (1962) and Bellman (1962), which Wu, Huang &
 * Zhan (2004) and Roberti & Mingozzi (2014) use to solve the traveling repairman
 * (minimum latency / delivery man) problem exactly:
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
 * (dominance rules: see pareto.ts). Tsitsiklis (1992) does the same for repairman
 * problems: "a dynamic programming algorithm has to keep track of both time and waiting
 * time". If food never spoiled, each list would shrink to exactly one label and this
 * would be the one-value-per-cell table of Wu et al.
 *
 *     SUBSET-DP-RACCOON(items, den, speed)
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
 * References (updated 2026-11-13, Claude: sources that cover the REPAIRMAN problem, read
 * from the group's scientific_sources/ folder; Held & Karp's 1962 DP is a TSP algorithm)
 *  - B. Y. Wu, Z.-N. Huang, F.-J. Zhan, "Exact algorithms for the minimum latency
 *    problem", Information Processing Letters 92(6):303-309, 2004.
 *    doi:10.1016/j.ipl.2004.09.009   (Section 3.1: the O(n^2 * 2^n) DP over
 *    "configurations" (visited set, last vertex) for the repairman objective: our C(S, j))
 *  - R. Roberti and A. Mingozzi, "Dynamic ng-path relaxation for the delivery man
 *    problem", Transportation Science 48(3):413-424, 2014. doi:10.1287/trsc.2013.0474
 *    (Section 2: the same recursion F(S, i), "a well-known DP recursion"; Section 5: an
 *    exact method that adds "standard dominance rules")
 *  - J. N. Tsitsiklis, "Special cases of traveling salesman and repairman problems with
 *    time windows", Networks 22(3):263-282, 1992. doi:10.1002/net.3230220305
 *    (Section VIII, Theorems 8-9: forward DP over states (i, S) that propagates labels
 *    and tracks both time and accumulated waiting time: why a cell keeps a label list)
 *  - J. Pei, N. Mladenovic, D. Urosevic, J. Brimberg, X. Liu, "Solving the traveling
 *    repairman problem with profits: A novel variable neighborhood search approach",
 *    Information Sciences 507:108-123, 2020. doi:10.1016/j.ins.2019.08.017
 *    (Section 2.1 defines the problem ours is a weighted version of: profit p - t if
 *    p > t, else 0; our score is w * max(0, shelfLife - t). A heuristics paper: it
 *    supports the problem, not this algorithm.)
 *  - M. Held and R. M. Karp, "A dynamic programming approach to sequencing problems",
 *    J. Society for Industrial and Applied Mathematics 10(1):196-210, 1962.
 *    doi:10.1137/0110015   (origin of the (set, last) table, for the TSP)
 *  - R. Bellman, "Dynamic programming treatment of the travelling salesman problem",
 *    J. ACM 9(1):61-63, 1962. doi:10.1145/321105.321111   (the same table, independently)
 *  - A. Blum, P. Chalasani, D. Coppersmith, B. Pulleyblank, P. Raghavan, M. Sudan,
 *    "The minimum latency problem", STOC 1994, 163-171. doi:10.1145/195058.195125
 *    (the sum-of-arrival-times objective)
 *  Not from any of these: dominance Rule 2 (pareto.ts), the per-item weights, and the
 *  O(n^2 * 2^n * F) bound with label lists are our own.
 *  - TypeScript port of ai-claude/raccoon/algorithms/subset_dp.py; the [Lx] tags below
 *    match the pseudocode line numbers above.
 */
import { paretoFront, liveWeightFunction } from "./pareto";
import { distance, evaluateRoute, type Problem, type Solution } from "./problem";

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

    const stats: SubsetDpStats = {
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

    return { solution: evaluateRoute(inst, route, "subset_dp"), stats, snapshots: frames };   // [L12]
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
