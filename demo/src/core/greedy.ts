/**
 * STRAIGHTFORWARD ALGORITHM: Greedy ("instant gratification")
 *
 * Standing where it is, the raccoon scores every uneaten item with an
 * ATTRACTIVENESS number, walks to the most attractive one, eats it, repeats.
 *
 *     GREEDY-RACCOON(items, den, speed)
 *      1  here = den
 *      2  clock = 0
 *      3  remaining = all n items
 *      4  route = empty list
 *      5  while remaining is not empty
 *      6      best = NIL
 *      7      best_value = -infinity
 *      8      for each item j in remaining
 *      9          travel = distance(here, j) / speed
 *     10          value = ATTRACTIVENESS(j, travel, clock + travel)
 *     11          if value > best_value
 *     12              best = j
 *     13              best_value = value
 *     14              best_travel = travel
 *     15      clock = clock + best_travel
 *     16      here = position of best
 *     17      remove best from remaining
 *     18      append best to route
 *     19  return route
 *
 * Spoiled food: an item that will already be spoiled on arrival is worth 0 and
 * loses nothing more, so it ranks below all fresh food (nearest rotten item first).
 *
 * Running time Theta(n^2): lines 9-14 run n + (n-1) + ... + 1 = n(n+1)/2 times.
 * Memory Theta(n).
 */
import { decayRate, distance, evaluateRoute, isSpoiledAt, type FoodItem, type Problem, type Solution } from "./problem";

export const INFO = {
    key: "greedy" as const,
    name: "Greedy",
    tagline: "picks the best-looking next meal",
    timeComplexity: "Θ(n²)",
    memoryComplexity: "Θ(n)",
};

/**
 * This function returns an attractiveness score for the food item.
 * The attractiveness score is explained in our report.
 * At the basic level, attractiveness is a calories-to-distance ratio. Highest calories at the shortest distance is the
 * most attractive. Then, the decay rate is added as a multiplier, which makes rapidly decaying items more "attractive"
 * in the sense that they must be consumed more urgently.
 * @param item The food item
 * @param travel The distance to the food item
 * @param arrival The arrival time upon reaching the food item
 */
export function attractiveness(item: FoodItem, travel: number, arrival: number): number
{
    if (isSpoiledAt(item, arrival)) {
        return -travel;
    }
    // avoids dividing by zero when food is right under the raccoon
    return (decayRate(item.food) * item.food.calories) / Math.max(travel, 1e-9);
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

export function solve(inst: Problem, recordDecisions = false): GreedyResult {
    const items = inst.items;
    const decisions: Decision[] | null = recordDecisions ? [] : null;

    let [hx, hy] = inst.start;                                         // [L1]
    let clock = 0;                                                     // [L2]
    const remaining = items.map((it) => it.id);                        // [L3] (kept in id order)
    const route: number[] = [];                                        // [L4]

    while (remaining.length > 0) {                                     // [L5] runs n times
        let best = -1;                                                 // [L6]
        let bestValue = -Infinity;                                     // [L7]
        let bestIndex = -1;
        let bestTravel = 0;

        for (let k = 0; k < remaining.length; k++) {                   // [L8]
            const item = items[remaining[k]];
            const travel = distance(hx, hy, item.x, item.y) / inst.speed; // [L9]
            const value = attractiveness(item, travel, clock + travel); // [L10]

            if (value > bestValue) {                                   // [L11]
                best = item.id;                                        // [L12]
                bestValue = value;                                     // [L13]
                bestIndex = k;
                bestTravel = travel;                                   // [L14]
            }
        }

        if (decisions) {
            decisions.push({ fromX: hx, fromY: hy, candidates: [...remaining], chosen: best });
        }

        clock += bestTravel;                                           // [L15] walk there and eat it
        hx = items[best].x;                                            // [L16]
        hy = items[best].y;                                            // [L16]
        remaining.splice(bestIndex, 1);                                // [L17]
        route.push(best);                                              // [L18]
    }

    return { solution: evaluateRoute(inst, route, "greedy"), decisions }; // [L19]
}
