// =============================================================================
//  AI-GENERATED FILE  -  written by Claude (Anthropic AI), 2026-11-03,
//  at the request of tonycons. See ../../ai-claude/AI_CONTRIBUTIONS.md for the full log.
//  Updated 2026-11-12 (Claude): checks Greedy and Held-Karp against Python.
//  Human edits: please tag changed lines with   // [EDIT: <your name>]
// =============================================================================
/**
 * The TypeScript port must make EXACTLY the same decisions as the Python.
 * Fixtures come from scripts/export_fixtures.py (run it after changing the Python).
 */
import { describe, expect, it } from "vitest";
import * as config from "../src/core/config";
import * as greedy from "../src/core/greedy";
import * as subsetDp from "../src/core/subsetDp";
import type { Problem } from "../src/core/problem";
import fixtures from "./fixtures/python_routes.json";

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

describe("config matches raccoon/config.py", () => {
    it("has the same world and food types", () => {
        const py = fixtures.config;
        expect([config.MAP_WIDTH, config.MAP_HEIGHT]).toEqual(py.map);
        expect([...config.DEN_POSITION]).toEqual(py.den);
        expect(config.RACCOON_SPEED).toBe(py.speed);
        expect(config.FOOD_TYPES.map((f) => [f.name, f.calories, f.shelfLife]))
            .toEqual(py.food_types.map((f) => [f.name, f.calories, f.shelf_life]));
        expect(py.greedy_attractiveness).toBe("ratio");   // the only formula ported
    });
});

describe.each(cases.map((c) => [`n=${c.n} seed=${c.seed}`, c] as const))(
    "same routes as Python on %s",
    (_label, c) => {
        const inst = toInstance(c);

        it("Greedy", () => {
            const { solution } = greedy.solve(inst);
            expect(solution.order).toEqual(c.greedy.order);
            expect(solution.totalScore).toBeCloseTo(c.greedy.total_score, 6);
        });

        if (c.subset_dp) {
            const py = c.subset_dp;
            it("Subset DP", () => {
                const { solution, stats } = subsetDp.solve(inst);
                expect(solution.order).toEqual(py.order);
                expect(solution.totalScore).toBeCloseTo(py.total_score, 6);
                expect(stats.maxFront).toBe(py.max_front);   // same labels kept
            });
        }
    },
);
