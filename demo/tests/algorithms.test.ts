// =============================================================================
//  AI-GENERATED FILE  -  written by Claude (Anthropic AI), 2026-11-03,
//  at the request of tonycons. See ../../AI_CONTRIBUTIONS.md for the full log.
//  Updated 2026-11-12 (Claude): tests for Held-Karp and the scaling study.
//  Human edits: please tag changed lines with   // [EDIT: <your name>]
// =============================================================================
/** Correctness checks on the maps the website itself generates. */
import { describe, expect, it } from "vitest";
import { generateInstance } from "../src/core/generator";
import * as greedy from "../src/solutions/greedy";
import * as subsetDp from "../src/solutions/subsetDp";
import { evaluateRoute, type Problem } from "../src/core/problem";
import { fitGrowth, GROWTH } from "../src/core/scaling";

describe("generator", () => {
    it("is reproducible from (n, seed) and stays on the map", () => {
        expect(generateInstance(50, 7)).toEqual(generateInstance(50, 7));
        expect(generateInstance(50, 7)).not.toEqual(generateInstance(50, 8));
        for (const it of generateInstance(500, 3).items) {
            expect(it.x).toBeGreaterThanOrEqual(0);
            expect(it.x).toBeLessThan(100);
            expect(it.y).toBeGreaterThanOrEqual(0);
            expect(it.y).toBeLessThan(100);
        }
    });
});

describe("evaluateRoute", () => {
    const inst = generateInstance(4, 1);
    it("rejects routes that skip or repeat items", () => {
        expect(() => evaluateRoute(inst, [0, 1, 2], "greedy")).toThrow();
        expect(() => evaluateRoute(inst, [0, 1, 2, 2], "greedy")).toThrow();
        expect(() => evaluateRoute(inst, [0, 1, 2, 4], "greedy")).toThrow();
    });
    it("score = total calories - spoilage loss", () => {
        const s = evaluateRoute(inst, [3, 2, 1, 0], "greedy");
        const calories = inst.items.reduce((a, it) => a + it.food.calories, 0);
        expect(s.totalScore + s.spoilageLoss).toBeCloseTo(calories, 9);
        expect(s.totalTime).toBe(s.arrivalTimes[3]);
    });
});

/** Best score over EVERY order of the items (n! of them): the ground truth for small maps. */
function bestScoreByExhaustiveSearch(inst: Problem): number {
    const n = inst.items.length;
    const order = [...Array(n).keys()];
    let best = -Infinity;
    const permute = (k: number): void => {           // Heap-style: fix positions 0..k-1, try each rest
        if (k === n) {
            best = Math.max(best, evaluateRoute(inst, order, "greedy").totalScore);
            return;
        }
        for (let i = k; i < n; i++) {
            [order[k], order[i]] = [order[i], order[k]];
            permute(k + 1);
            [order[k], order[i]] = [order[i], order[k]];
        }
    };
    permute(0);
    return best;
}

describe("Subset DP", () => {
    it("finds the true optimum: equals an exhaustive search of all n! orders (n = 1..8)", () => {
        // This is the proof that the table and its dominance rule (subsetDp.ts) are exact.
        for (let n = 1; n <= 8; n++) {
            for (let k = 0; k < (n <= 6 ? 12 : 4); k++) {
                const inst = generateInstance(n, 5000 + 100 * n + k);
                const { solution, stats } = subsetDp.solve(inst);
                expect(solution.totalScore).toBeCloseTo(bestScoreByExhaustiveSearch(inst), 6);
                expect(stats.bestLoss).toBeCloseTo(solution.spoilageLoss, 6);   // the table's own answer agrees
            }
        }
    });

    it("stays optimal when food spoils early (crowded map: label lists longer than 1)", () => {
        // A slow raccoon makes most food spoil before it is reached, which is the case the
        // (time, loss) label lists exist for.
        let longestList = 1;
        for (let k = 0; k < 12; k++) {
            const inst = { ...generateInstance(7, 7000 + k), speed: 0.15 };
            const { solution, stats } = subsetDp.solve(inst);
            expect(solution.totalScore).toBeCloseTo(bestScoreByExhaustiveSearch(inst), 6);
            longestList = Math.max(longestList, stats.maxFront);
        }
        expect(longestList).toBeGreaterThan(1);       // the test really exercised label lists
    });

    it("is never beaten by any of 300 random orders", () => {
        let state = 12345;   // tiny deterministic LCG so the test never flakes
        const rand = () => (state = (state * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
        for (const n of [5, 8, 10]) {
            const inst = generateInstance(n, 3000 + n);
            const best = subsetDp.solve(inst).solution.totalScore;
            for (let t = 0; t < 300; t++) {
                const order = [...Array(n).keys()];
                for (let i = n - 1; i > 0; i--) {   // Fisher-Yates shuffle
                    const j = Math.floor(rand() * (i + 1));
                    [order[i], order[j]] = [order[j], order[i]];
                }
                expect(evaluateRoute(inst, order, "greedy").totalScore).toBeLessThanOrEqual(best + 1e-6);
            }
        }
    });

    it("never scores below Greedy", () => {
        for (let k = 0; k < 20; k++) {
            const inst = generateInstance(2 + (k % 11), 2000 + k);
            expect(subsetDp.solve(inst).solution.totalScore)
                .toBeGreaterThanOrEqual(greedy.solve(inst).solution.totalScore - 1e-6);
        }
    });

    it("its table's optimum equals the score of the route it returns", () => {
        const inst = generateInstance(11, 5);
        const { solution, stats } = subsetDp.solve(inst);
        expect(stats.bestLoss).toBeCloseTo(solution.spoilageLoss, 6);
        expect(stats.cells).toBe(11 * 2 ** 10);   // n * 2^(n-1) cells (S, j) with j in S
        expect(stats.cellsBySize.reduce((a, b) => a + b, 0)).toBe(stats.cells);
        for (let s = 1; s <= 11; s++) {
            expect(stats.cellsBySize[s]).toBe(s * choose(11, s));
        }
    });

    it("snapshots are valid partial routes and do not change the answer", () => {
        const inst = generateInstance(9, 77);
        const plain = subsetDp.solve(inst).solution.order;
        const { solution, snapshots } = subsetDp.solve(inst, 30);
        expect(solution.order).toEqual(plain);
        expect(snapshots!.length).toBe(30);
        for (const f of snapshots!) {
            const ids = [...f.route].sort((a, b) => a - b);
            const fromSet = [...Array(9).keys()].filter((k) => (f.set >> k) & 1);
            expect(ids).toEqual(fromSet);          // the route eats exactly the items of S
        }
        expect(snapshots!.at(-1)!.route).toEqual(plain);   // last frame = the full set = the answer
    });

    it("refuses maps that would not fit in memory", () => {
        expect(() => subsetDp.solve(generateInstance(subsetDp.MAX_N + 1, 1))).toThrow();
    });
});

describe("Greedy", () => {
    it("recording decisions does not change its route", () => {
        const inst = generateInstance(14, 3);
        const plain = greedy.solve(inst).solution.order;
        const recorded = greedy.solve(inst, true);
        expect(recorded.solution.order).toEqual(plain);
        expect(recorded.decisions!.map((d) => d.chosen)).toEqual(plain);
    });
});

describe("trendline fit", () => {
    it("recovers a and b from exact data", () => {
        const points = [2, 4, 6, 8, 10].map((n) => ({ n, ms: 3 * GROWTH.subset_dp.f(n) + 5 }));
        const fit = fitGrowth(points, GROWTH.subset_dp.f)!;
        expect(fit.a).toBeCloseTo(3, 9);
        expect(fit.b).toBeCloseTo(5, 6);
        expect(fit.r2).toBeCloseTo(1, 9);
    });
});

/** Binomial coefficient C(n, s): how many sets of s items there are. */
function choose(n: number, s: number): number {
    let r = 1;
    for (let k = 1; k <= s; k++) {
        r = (r * (n - s + k)) / k;
    }
    return Math.round(r);
}
