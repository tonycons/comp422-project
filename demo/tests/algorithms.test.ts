// =============================================================================
//  AI-GENERATED FILE  -  written by Claude (Anthropic AI), 2026-11-03,
//  at the request of tonycons. See ../../ai-claude/AI_CONTRIBUTIONS.md for the full log.
//  Updated 2026-11-12 (Claude): tests for Held-Karp and the scaling study.
//  Human edits: please tag changed lines with   // [EDIT: <your name>]
// =============================================================================
/** Correctness checks on the maps the website itself generates. */
import { describe, expect, it } from "vitest";
import { generateInstance } from "../src/core/generator";
import * as greedy from "../src/core/greedy";
import * as subsetDp from "../src/core/subsetDp";
import { evaluateRoute } from "../src/core/problem";
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

describe("Subset DP", () => {
    // (Optimality itself is proven by the Python tests, which compare Subset DP with an
    //  exhaustive search, and parity.test.ts checks this port picks the same routes.)
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
            expect(stats.cellsBySize[s]).toBe(s * subsetDp.choose(11, s));
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
