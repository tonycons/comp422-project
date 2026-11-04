// =============================================================================
//  AI-GENERATED FILE  -  written by Claude (Anthropic AI), 2026-11-03,
//  at the request of tonycons. See ../../../ai-claude/AI_CONTRIBUTIONS.md for the full log.
//  Human edits: please tag changed lines with   // [EDIT: <your name>]
// =============================================================================
/**
 * Set up a race: one map, both algorithms solve it (and we time them).
 * Port of raccoon/race.py, trimmed to the two showcased algorithms.
 */
import { generateInstance } from "./generator";
import * as greedy from "./greedy";
import type { Problem } from "./problem";
import * as twoOpt from "./twoOpt";

/** Greedy's "thinking lines" are only drawn on maps this small (they'd be a blur above). */
export const RECORD_DECISIONS_MAX_N = 60;

/** Re-run tiny solves until this much time passes, for an accurate per-run time. */
const MIN_TIMED_MS = 40;
const MAX_REPEATS = 2000;

export interface Race {
    instance: Problem;
    greedy: greedy.GreedyResult & { ms: number };
    twoOpt: twoOpt.TwoOptResult & { ms: number };
}

/** Average wall-clock milliseconds of one call (browsers don't expose CPU time). */
export function timeIt(fn: () => unknown): number {
    fn(); // warm-up run so the JIT compiler doesn't count against the first algorithm
    let repeats = 0;
    const start = performance.now();
    let elapsed = 0;
    do {
        fn();
        repeats++;
        elapsed = performance.now() - start;
    } while (elapsed < MIN_TIMED_MS && repeats < MAX_REPEATS);
    return elapsed / repeats;
}

export function makeRace(n: number, seed: number): Race {
    const instance = generateInstance(n, seed);
    // Timed runs record nothing extra; the untimed runs below keep the animation data.
    const greedyMs = timeIt(() => greedy.solve(instance));
    const twoOptMs = timeIt(() => twoOpt.solve(instance));
    return {
        instance,
        greedy: { ...greedy.solve(instance, n <= RECORD_DECISIONS_MAX_N), ms: greedyMs },
        twoOpt: { ...twoOpt.solve(instance, true), ms: twoOptMs },
    };
}
