// =============================================================================
//  AI-GENERATED FILE  -  written by Claude (Anthropic AI), 2026-11-03,
//  at the request of tonycons. See ../../AI_CONTRIBUTIONS.md for the full log.
//  Updated 2026-11-13 (Claude): now a regression test against frozen reference routes.
//  Human edits: please tag changed lines with   // [EDIT: <your name>]
// =============================================================================
/**
 * Regression test: on 14 fixed maps (n = 1 to 500), both algorithms must keep producing
 * EXACTLY the routes recorded in fixtures/reference_routes.json. It catches a code change
 * that alters a decision by accident. (That Subset DP's routes are OPTIMAL is checked
 * separately, against an exhaustive search, in algorithms.test.ts.)
 * If you change an algorithm or config.ts on purpose, update the fixture file on purpose too.
 */
import { describe, expect, it } from "vitest";
import * as config from "../src/core/config";
import * as greedy from "../src/solutions/greedy";
import * as subsetDp from "../src/solutions/subsetDp";
import type { Problem } from "../src/core/problem";
import fixtures from "./fixtures/reference_routes.json";

interface Case {
    n: number;
    seed: number;
    items: { x: number; y: number; food: string }[];
    greedy: { order: number[]; total_score: number };
    subset_dp?: { order: number[]; total_score: number; max_front: number };
}

const cases = fixtures.cases as Case[];
const foodByName = new Map(config.FOOD_TYPES.map((f) => [f.name, f]));

function toInstance(c: Case): Problem {
    return {
        items: c.items.map((it, id) => ({ id, x: it.x, y: it.y, food: foodByName.get(it.food)! })),
        start: config.DEN_POSITION,
        speed: config.RACCOON_SPEED,
        width: config.MAP_WIDTH,
        height: config.MAP_HEIGHT,
        seed: c.seed,
    };
}

describe.each(cases.map((c) => [`n=${c.n} seed=${c.seed}`, c] as const))(
    "same routes as the reference on %s",
    (_label, c) => {
        const inst = toInstance(c);

        it("Greedy", () => {
            const { solution } = greedy.solve(inst);
            expect(solution.order).toEqual(c.greedy.order);
            expect(solution.totalScore).toBeCloseTo(c.greedy.total_score, 6);
        });

        if (c.subset_dp) {
            const ref = c.subset_dp;
            it("Subset DP", () => {
                const { solution, stats } = subsetDp.solve(inst);
                expect(solution.order).toEqual(ref.order);
                expect(solution.totalScore).toBeCloseTo(ref.total_score, 6);
                expect(stats.maxFront).toBe(ref.max_front);   // same labels kept
            });
        }
    },
);
