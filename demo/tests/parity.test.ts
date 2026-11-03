// =============================================================================
//  AI-GENERATED FILE  -  written by Claude (Anthropic AI), 2026-11-03,
//  at the request of tonycons. See ../../AI_CONTRIBUTIONS.md for the full log.
//  Human edits: please tag changed lines with   // [EDIT: <your name>]
// =============================================================================
/**
 * The TypeScript port must make EXACTLY the same decisions as the Python.
 * Fixtures come from scripts/export_fixtures.py (run it after changing the Python).
 */
import { describe, expect, it } from "vitest";
import * as config from "../src/core/config";
import * as greedy from "../src/core/greedy";
import { greedyKdRoute } from "../src/core/kdtree";
import type { Instance } from "../src/core/problem";
import * as twoOpt from "../src/core/twoOpt";
import fixtures from "./fixtures/python_routes.json";

const foodByName = new Map(config.FOOD_TYPES.map((f) => [f.name, f]));

function toInstance(c: (typeof fixtures.cases)[number]): Instance {
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
  it("has the same world, food types and 2-opt settings", () => {
    const py = fixtures.config;
    expect([config.MAP_WIDTH, config.MAP_HEIGHT]).toEqual(py.map);
    expect([...config.DEN_POSITION]).toEqual(py.den);
    expect(config.RACCOON_SPEED).toBe(py.speed);
    expect(config.FOOD_TYPES.map((f) => [f.name, f.calories, f.shelfLife]))
      .toEqual(py.food_types.map((f) => [f.name, f.calories, f.shelf_life]));
    expect(py.greedy_attractiveness).toBe("ratio");   // the only formula ported
    expect(config.TWO_OPT_MAX_SEGMENT).toBe(py.two_opt_max_segment);
    expect(config.LOCAL_SEARCH_MAX_PASSES).toBe(py.local_search_max_passes);
  });
});

describe.each(fixtures.cases.map((c) => [`n=${c.n} seed=${c.seed}`, c] as const))(
  "same routes as Python on %s",
  (_label, c) => {
    const inst = toInstance(c);

    it("Greedy", () => {
      const { solution } = greedy.solve(inst);
      expect(solution.order).toEqual(c.greedy.order);
      expect(solution.totalScore).toBeCloseTo(c.greedy.total_score, 6);
    });

    it("Greedy (k-d tree)", () => {
      expect(greedyKdRoute(inst)).toEqual(c.greedy_kd.order);
    });

    it("Greedy + 2-opt", () => {
      const { solution } = twoOpt.solve(inst);
      expect(solution.order).toEqual(c.two_opt.order);
      expect(solution.totalScore).toBeCloseTo(c.two_opt.total_score, 6);
    });
  },
);
