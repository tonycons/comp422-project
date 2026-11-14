// =============================================================================
//  AI-GENERATED FILE  -  written by Claude (Anthropic AI), 2026-11-03,
//  at the request of tonycons. See ../../../AI_CONTRIBUTIONS.md for the full log.
//  Updated 2026-11-03 (Claude): spoiled food is worth 0 calories.
//  Updated 2026-11-12 (Claude): algorithm keys are now Greedy / Held-Karp.
//  Human edits: please tag changed lines with   // [EDIT: <your name>]
// =============================================================================
/**
 * The problem itself: food, the map, and how a route is scored.
 *
 *   freshness(t) = 1 - t / shelfLife                 (1 = fresh, 0 = spoiled)
 *   score(t)     = calories * max(0, freshness(t))   (spoiled food is worth 0, never less)
 *   loss(t)      = calories - score(t) = w * min(t, shelfLife)
 *   total score  = sum of item scores  =  (all calories) - sum_i loss_i(t_i)
 *
 * where w = calories / shelfLife is the item's SPOIL WEIGHT (calories lost per
 * second while it is still fresh). This is a weighted Traveling Repairman
 * (minimum latency) problem whose costs stop growing at each shelf life. The
 * unweighted, uncapped version (minimize the sum of arrival times) is the minimum
 * latency problem of A. Blum et al., "The minimum latency problem", STOC 1994,
 * pp. 163-171, doi:10.1145/195058.195125.
 * A cost that stops growing is the Traveling Repairman Problem with Profits: profit
 * p_i - t_i if p_i > t_i, else 0 (J. Pei et al., "Solving the traveling repairman problem
 * with profits: A novel variable neighborhood search approach", Information Sciences
 * 507:108-123, 2020, doi:10.1016/j.ins.2019.08.017, Section 2.1). Our score is
 * w_i * max(0, shelfLife_i - t_i): the same with p_i = shelf life, plus a weight w_i.
 * (There the repairman may skip nodes; ours must eat everything, which gives the same
 * best score because spoiled items can be left for last.)
 *
 * NOTE on floating point: do not reorder the arithmetic in these formulas. A different
 * order can change the last digit and flip a near-tie, and tests/regression.test.ts
 * checks that the routes on its reference maps stay exactly the same.
 */

export interface FoodType {
    name: string;
    calories: number; // value when perfectly fresh
    shelfLife: number; // seconds until freshness reaches 0
}

export interface FoodItem {
    id: number; // index in Instance.items (0 .. n-1)
    x: number;
    y: number;
    food: FoodType;
}

export type Point = readonly [number, number];

/**
 * Fraction of freshness lost per second
 */
export const decayRate = (f: FoodType): number => 1.0 / f.shelfLife;

/**
 * Calories lost per second the raccoon makes this item wait
 */
export const spoilWeight = (f: FoodType): number => f.calories * decayRate(f);

/**
 * 1 = perfectly fresh,
 * 0 = just spoiled,
 * negative = spoiled for a while (the SCORE stops at 0).
 */
export const freshnessAt = (item: FoodItem, t: number): number =>
    1.0 - decayRate(item.food) * t;

/**
 * Calories the raccoon gets if it eats this item at time t (never below 0).
 */
export const scoreAt = (item: FoodItem, t: number): number =>
    item.food.calories * Math.max(0.0, freshnessAt(item, t));

/**
 * Calories lost by eating at time t instead of time 0: w * min(t, shelfLife).
 */
export const lossAt = (item: FoodItem, t: number): number =>
    item.food.calories * Math.min(1.0, decayRate(item.food) * t);

/**
 * True once the item is worth nothing (freshness has reached 0).
 */
export const isSpoiledAt = (item: FoodItem, t: number): boolean =>
    freshnessAt(item, t) <= 0.0;

export interface Problem {
    items: FoodItem[];
    start: Point; // the raccoon's den
    speed: number; // meters per second
    width: number;
    height: number;
    seed: number | null;
}

export const totalCalories = (inst: Problem): number =>
    inst.items.reduce((sum, it) => sum + it.food.calories, 0);

/** Straight-line distance. */
export const distance = (
    ax: number,
    ay: number,
    bx: number,
    by: number,
): number => Math.hypot(ax - bx, ay - by);

export const travelTime = (
    inst: Problem,
    ax: number,
    ay: number,
    bx: number,
    by: number,
): number => distance(ax, ay, bx, by) / inst.speed;

export type AlgorithmKey = "greedy" | "subset_dp";

/** A route through all food items plus everything we measured about it. */
export interface Solution {
    algorithm: AlgorithmKey;
    order: number[]; // item ids in the order they are eaten
    arrivalTimes: number[]; // arrivalTimes[k] = time the raccoon reaches order[k]
    itemScores: number[]; // itemScores[k]   = calories gained from order[k]
    totalScore: number;
    spoilageLoss: number; // calories lost to waiting = sum of loss_i(t_i)
    totalTime: number; // time the last item is eaten
    spoiledCount: number; // how many items were spoiled (worth 0) when eaten
}

/**
 * Walk the raccoon along `order` and score it. Every algorithm hands its route
 * to this ONE function, so all algorithms are scored by the same rules. Theta(n).
 */
export function evaluateRoute(
    inst: Problem,
    order: readonly number[],
    algorithm: AlgorithmKey,
): Solution {
    const n = inst.items.length;
    const seen = new Uint8Array(n);
    if (
        order.length !== n ||
        order.some((id) => id < 0 || id >= n || seen[id]++)
    ) {
        throw new Error(
            `${algorithm}: route must visit every item exactly once, got [${
                order.join(", ")
            }]`,
        );
    }

    let clock = 0;
    let [hx, hy] = inst.start;
    const arrivalTimes: number[] = [];
    const itemScores: number[] = [];
    let spoiled = 0;

    for (const id of order) {
        const item = inst.items[id];
        clock += travelTime(inst, hx, hy, item.x, item.y); // walk there
        hx = item.x;
        hy = item.y;
        arrivalTimes.push(clock);
        itemScores.push(scoreAt(item, clock)); // eat it
        if (isSpoiledAt(item, clock)) {
            spoiled++;
        }
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
