// =============================================================================
//  AI-GENERATED FILE  -  written by Claude (Anthropic AI), 2026-11-03,
//  at the request of tonycons. See ../../AI_CONTRIBUTIONS.md for the full log.
//  Human edits: please tag changed lines with   // [EDIT: <your name>]
// =============================================================================
/** Correctness checks on the maps the website itself generates. */
import { describe, expect, it } from "vitest";
import { generateInstance } from "../src/core/generator";
import * as greedy from "../src/core/greedy";
import { greedyKdRoute } from "../src/core/kdtree";
import { evaluateRoute } from "../src/core/problem";
import * as twoOpt from "../src/core/twoOpt";

const MAPS = Array.from({ length: 40 }, (_, k) => generateInstance([1, 2, 5, 14, 30, 80, 200, 400][k % 8], 1000 + k));

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

describe("algorithms", () => {
  it("k-d tree Greedy builds exactly the naive Greedy route", () => {
    for (const inst of MAPS) expect(greedyKdRoute(inst)).toEqual(greedy.solve(inst).solution.order);
  });

  it("2-opt starts from the Greedy route and never scores worse", () => {
    for (const inst of MAPS) {
      const g = greedy.solve(inst).solution;
      const t = twoOpt.solve(inst);
      expect(t.startRoute).toEqual(g.order);
      expect(t.solution.totalScore).toBeGreaterThanOrEqual(g.totalScore - 1e-6);
    }
  });

  it("replaying the recorded 2-opt moves reproduces the final route", () => {
    for (const inst of MAPS) {
      const t = twoOpt.solve(inst, true);
      const route = [...t.startRoute];
      for (const [i, j] of t.moves!) twoOpt.reverse(route, i, j);
      expect(route).toEqual(t.solution.order);
    }
  });

  it("recording decisions does not change Greedy's route", () => {
    const inst = MAPS[3];
    const plain = greedy.solve(inst).solution.order;
    const recorded = greedy.solve(inst, true);
    expect(recorded.solution.order).toEqual(plain);
    expect(recorded.decisions!.map((d) => d.chosen)).toEqual(plain);
  });
});
