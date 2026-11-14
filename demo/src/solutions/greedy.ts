/**
 * STRAIGHTFORWARD ALGORITHM: Greedy ("instant gratification").
 *
 * Standing where it is, the raccoon scores every uneaten item with attractiveness()
 * below, walks to the most attractive one, eats it, and repeats. Food that would already
 * be spoiled on arrival ranks below all fresh food (nearest first).
 *
 * Theta(n^2) time, Theta(n) memory. Not always optimal: it never looks past the next meal.
 * Pseudocode, analysis and sources: see the project report.
 */
import { decayRate, distance, evaluateRoute, isSpoiledAt, type FoodItem, type Problem, type Solution } from "../core/problem";

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
 * (decay rate x calories = calories lost per second while fresh, so this is Smith's 1956 ratio rule.) [EDIT: Claude]
 * Spoiled-on-arrival food returns -travel: below every fresh item (all > 0), nearest first.          [EDIT: Claude]
 * @param item The food item
 * @param travel The travel time (seconds) to the food item; equals the distance at speed 1 m/s   [EDIT: Claude]
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

    let [hx, hy] = inst.start;
    let clock = 0;
    const remaining = items.map((it) => it.id);  // kept in id order
    const route: number[] = [];

    while (remaining.length > 0) {  // runs n times
        let best = -1;
        let bestValue = -Infinity;
        let bestIndex = -1;
        let bestTravel = 0;

        for (let k = 0; k < remaining.length; k++) {
            const item = items[remaining[k]];
            const travel = distance(hx, hy, item.x, item.y) / inst.speed;
            const value = attractiveness(item, travel, clock + travel);

            if (value > bestValue) {
                best = item.id;
                bestValue = value;
                bestIndex = k;
                bestTravel = travel;
            }
        }

        if (decisions) {
            decisions.push({ fromX: hx, fromY: hy, candidates: [...remaining], chosen: best });
        }

        clock += bestTravel;  // walk there and eat it
        hx = items[best].x;
        hy = items[best].y;
        remaining.splice(bestIndex, 1);
        route.push(best);
    }

    return { solution: evaluateRoute(inst, route, "greedy"), decisions };
}
