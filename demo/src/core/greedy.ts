// =============================================================================
//  AI-GENERATED FILE  -  written by Claude (Anthropic AI), 2026-11-03,
//  at the request of tonycons. See ../../../ai-claude/AI_CONTRIBUTIONS.md for the full log.
//  Updated 2026-11-03 (Claude): spoiled food is worth 0, so it is eaten last.
//  Human edits: please tag changed lines with   // [EDIT: <your name>]
// =============================================================================
/**
 * STRAIGHTFORWARD ALGORITHM: Greedy ("instant gratification")
 * Port of raccoon/algorithms/greedy.py with its default "ratio" formula.
 *
 * Standing where it is, the raccoon scores every uneaten item with an
 * ATTRACTIVENESS number, walks to the most attractive one, eats it, repeats.
 *
 *     GREEDY-RACCOON(items, den, speed)
 *      1  here <- den;  clock <- 0
 *      2  remaining <- all n items;  route <- empty list
 *      3  while remaining is not empty
 *      4      best <- NIL;  best_value <- -infinity
 *      5      for each item j in remaining
 *      6          travel <- distance(here, j) / speed
 *      7          value  <- ATTRACTIVENESS(j, travel, clock + travel)
 *      8          if value > best_value
 *      9              best <- j;  best_value <- value;  best_travel <- travel
 *     10      clock <- clock + best_travel;  here <- position of best
 *     11      remove best from remaining;  append best to route
 *     12  return route
 *
 * Spoiled food: an item that will already be spoiled on arrival is worth 0 and
 * loses nothing more, so it ranks below all fresh food (nearest rotten item first).
 *
 * Running time Theta(n^2): lines 6-9 run n + (n-1) + ... + 1 = n(n+1)/2 times.
 * Memory Theta(n).
 */
import { decayRate, distance, evaluateRoute, isSpoiledAt, type FoodItem, type Instance, type Solution } from "./problem";

export const INFO = {
  key: "greedy" as const,
  name: "Greedy",
  tagline: "picks the best-looking next meal",
  timeComplexity: "Θ(n²)",
  memoryComplexity: "Θ(n)",
};

const TINY = 1e-9; // avoids dividing by zero when food is right under the raccoon

/**
 * Smith's ratio rule (Python: attractiveness_ratio):
 *   decay rate x calories / travel time
 * = "calories this item loses per second, per second of walking to it".
 * Food already spoiled on arrival returns -travel: below every fresh item
 * (fresh values are > 0), and the nearest spoiled item first.
 */
export function attractiveness(item: FoodItem, travel: number, arrival: number): number {
  if (isSpoiledAt(item, arrival)) return -travel;
  return (decayRate(item.food) * item.food.calories) / Math.max(travel, TINY);
}

/** One step of the greedy raccoon's thinking (recorded only for the animation). */
export interface Decision {
  fromX: number;
  fromY: number;
  candidates: number[];  // every item it looked at
  chosen: number;
}

export interface GreedyResult {
  solution: Solution;
  decisions: Decision[] | null;
}

export function solve(inst: Instance, recordDecisions = false): GreedyResult {
  const items = inst.items;
  const decisions: Decision[] | null = recordDecisions ? [] : null;

  let [hx, hy] = inst.start;                                   // [L1]
  let clock = 0;                                               // [L1]
  const remaining = items.map((it) => it.id);                  // [L2] (kept in id order)
  const route: number[] = [];                                  // [L2]

  while (remaining.length > 0) {                               // [L3] runs n times
    let best = -1;                                             // [L4]
    let bestValue = -Infinity;                                 // [L4]
    let bestIndex = -1;
    let bestTravel = 0;

    for (let k = 0; k < remaining.length; k++) {               // [L5]
      const item = items[remaining[k]];
      const travel = distance(hx, hy, item.x, item.y) / inst.speed; // [L6]
      const value = attractiveness(item, travel, clock + travel); // [L7]
      if (value > bestValue) {                                 // [L8]
        best = item.id;                                        // [L9]
        bestValue = value;
        bestIndex = k;
        bestTravel = travel;
      }
    }

    if (decisions) decisions.push({ fromX: hx, fromY: hy, candidates: [...remaining], chosen: best });

    clock += bestTravel;                                       // [L10] walk there and eat it
    hx = items[best].x;
    hy = items[best].y;
    remaining.splice(bestIndex, 1);                            // [L11]
    route.push(best);                                          // [L11]
  }

  return { solution: evaluateRoute(inst, route, "greedy"), decisions }; // [L12]
}
