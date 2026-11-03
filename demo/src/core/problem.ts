// =============================================================================
//  AI-GENERATED FILE  -  written by Claude (Anthropic AI), 2026-11-03,
//  at the request of tonycons. See ../../../AI_CONTRIBUTIONS.md for the full log.
//  Human edits: please tag changed lines with   // [EDIT: <your name>]
// =============================================================================
/**
 * The problem itself: food, the map, and how a route is scored.
 * TypeScript port of raccoon/problem.py -- see that file for the full write-up.
 *
 *   freshness(t) = 1 - t / shelfLife          (1 = fresh, 0 = spoiled, < 0 = rotten)
 *   score(t)     = calories * freshness(t)    (negative once spoiled)
 *   total score  = sum of item scores  =  (all calories) - sum_i w_i * t_i
 *
 * where w = calories / shelfLife is the item's SPOIL WEIGHT. Maximizing the
 * score is therefore the weighted Traveling Repairman (minimum latency) problem.
 *
 * NOTE on floating point: every formula below is written in the same order as
 * the Python, so both versions make identical decisions (see tests/parity.test.ts).
 */

export type Point = readonly [number, number];

export interface FoodType {
  name: string;
  calories: number;    // value when perfectly fresh
  shelfLife: number;   // seconds until freshness reaches 0
}

/** Fraction of freshness lost per second (Python: FoodType.decay_rate). */
export const decayRate = (f: FoodType): number => 1.0 / f.shelfLife;

/** Calories lost per second the raccoon makes this item wait (Python: spoil_weight). */
export const spoilWeight = (f: FoodType): number => f.calories * decayRate(f);

export interface FoodItem {
  id: number;          // index in Instance.items (0 .. n-1)
  x: number;
  y: number;
  food: FoodType;
}

export const freshnessAt = (item: FoodItem, t: number): number => 1.0 - decayRate(item.food) * t;
export const scoreAt = (item: FoodItem, t: number): number => item.food.calories * freshnessAt(item, t);
export const isSpoiledAt = (item: FoodItem, t: number): boolean => freshnessAt(item, t) < 0.0;

export interface Instance {
  items: FoodItem[];
  start: Point;        // the raccoon's den
  speed: number;       // meters per second
  width: number;
  height: number;
  seed: number | null;
}

export const totalCalories = (inst: Instance): number =>
  inst.items.reduce((sum, it) => sum + it.food.calories, 0);

/** Straight-line distance (Python: math.hypot). */
export const distance = (ax: number, ay: number, bx: number, by: number): number =>
  Math.hypot(ax - bx, ay - by);

export const travelTime = (inst: Instance, ax: number, ay: number, bx: number, by: number): number =>
  distance(ax, ay, bx, by) / inst.speed;

export type AlgorithmKey = "greedy" | "two_opt";

/** A route through all food items plus everything we measured about it. */
export interface Solution {
  algorithm: AlgorithmKey;
  order: number[];          // item ids in the order they are eaten
  arrivalTimes: number[];   // arrivalTimes[k] = time the raccoon reaches order[k]
  itemScores: number[];     // itemScores[k]   = calories gained from order[k]
  totalScore: number;
  spoilageLoss: number;     // calories lost to waiting = sum(w_i * t_i)
  totalTime: number;        // time the last item is eaten
  spoiledCount: number;     // how many items were rotten when eaten
}

/**
 * Walk the raccoon along `order` and score it. Every algorithm hands its route
 * to this ONE function, so all algorithms are scored by the same rules. Theta(n).
 */
export function evaluateRoute(inst: Instance, order: readonly number[], algorithm: AlgorithmKey): Solution {
  const n = inst.items.length;
  const seen = new Uint8Array(n);
  if (order.length !== n || order.some((id) => id < 0 || id >= n || seen[id]++)) {
    throw new Error(`${algorithm}: route must visit every item exactly once, got [${order.join(", ")}]`);
  }

  let clock = 0;
  let [hx, hy] = inst.start;
  const arrivalTimes: number[] = [];
  const itemScores: number[] = [];
  let spoiled = 0;
  for (const id of order) {
    const item = inst.items[id];
    clock += travelTime(inst, hx, hy, item.x, item.y);   // walk there
    hx = item.x;
    hy = item.y;
    arrivalTimes.push(clock);
    itemScores.push(scoreAt(item, clock));               // eat it
    if (isSpoiledAt(item, clock)) spoiled++;
  }

  const totalScore = itemScores.reduce((a, b) => a + b, 0);
  return {
    algorithm,
    order: [...order],
    arrivalTimes,
    itemScores,
    totalScore,
    spoilageLoss: totalCalories(inst) - totalScore,
    totalTime: clock,
    spoiledCount: spoiled,
  };
}
