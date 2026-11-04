// =============================================================================
//  AI-GENERATED FILE  -  written by Claude (Anthropic AI), 2026-11-03,
//  at the request of tonycons. See ../../../ai-claude/AI_CONTRIBUTIONS.md for the full log.
//  Human edits: please tag changed lines with   // [EDIT: <your name>]
// =============================================================================
/**
 * Random problem instances (port of raccoon/generator.py).
 *
 * Each map is fully determined by (n, seed). The random number generator here
 * (mulberry32) is NOT Python's Mersenne Twister, so seed 48 on this site is a
 * different map from seed 48 in `python main.py demo`. The algorithms are the
 * same; only the maps differ.
 */
import * as config from "./config";
import type { FoodItem, Problem } from "./problem";

/** Small, fast, seedable PRNG returning floats in [0, 1). */
export function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export const MAX_SEED = 999_999;
export const randomSeed = (): number => Math.floor(Math.random() * (MAX_SEED + 1));

/** Scatter n food items uniformly at random over the map. */
export function generateInstance(n: number, seed: number): Problem {
    const rng = mulberry32(seed);
    const items: FoodItem[] = [];
    for (let i = 0; i < n; i++) {
        const x = rng() * config.MAP_WIDTH;
        const y = rng() * config.MAP_HEIGHT;
        const food = config.FOOD_TYPES[Math.floor(rng() * config.FOOD_TYPES.length)];
        items.push({ id: i, x, y, food });
    }
    return {
        items,
        start: config.DEN_POSITION,
        speed: config.RACCOON_SPEED,
        width: config.MAP_WIDTH,
        height: config.MAP_HEIGHT,
        seed,
    };
}
