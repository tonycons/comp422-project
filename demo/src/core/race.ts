// =============================================================================
//  AI-GENERATED FILE  -  written by Claude (Anthropic AI), 2026-11-03,
//  at the request of tonycons. See ../../../AI_CONTRIBUTIONS.md for the full log.
//  Updated 2026-11-12 (Claude): the race is now Greedy vs. Held-Karp.
//  Human edits: please tag changed lines with   // [EDIT: <your name>]
// =============================================================================
/**
 * Set up a race: one map, both algorithms solve it (and we time them).
 */
import { generateInstance } from "./generator";
import * as greedy from "../solutions/greedy";
import * as subsetDp from "../solutions/subsetDp";
import type { Problem } from "./problem";

/** Greedy's "thinking lines" are only drawn on maps this small (they'd be a blur above). */
export const RECORD_DECISIONS_MAX_N = 60;

/** Frames of Subset DP's table the planning animation steps through. */
export const SNAPSHOTS = 90;

/** Re-run quick solves until this much time passes, for an accurate per-run time. */
const MIN_TIMED_MS = 40;
const MAX_REPEATS = 2000;

export interface Race {
    instance: Problem;
    greedy: greedy.GreedyResult & { ms: number };
    subsetDp: subsetDp.SubsetDpResult & { ms: number };
}

/**
 * Average wall-clock milliseconds of one call (browsers don't expose CPU time).
 * A call that takes at least minMs on its own is only run once.
 */
export function timeIt(fn: () => unknown, minMs = MIN_TIMED_MS, warmUp = true): number {
    if (warmUp) {
        fn(); // so the JIT compiler doesn't count against the first algorithm
    }
    let repeats = 0;
    const start = performance.now();
    let elapsed = 0;
    do {
        fn();
        repeats++;
        elapsed = performance.now() - start;
    } while (elapsed < minMs && repeats < MAX_REPEATS);
    return elapsed / repeats;
}

export function makeRace(n: number, seed: number): Race {
    const instance = generateInstance(n, seed);
    // Timed runs record nothing extra; the untimed runs below keep the animation data.
    const greedyMs = timeIt(() => greedy.solve(instance));
    // On big maps one Subset DP run already takes long enough to time; skip its warm-up there.
    const dpMs = timeIt(() => subsetDp.solve(instance), MIN_TIMED_MS, n < 13);
    return {
        instance,
        greedy: { ...greedy.solve(instance, n <= RECORD_DECISIONS_MAX_N), ms: greedyMs },
        subsetDp: { ...subsetDp.solve(instance, SNAPSHOTS), ms: dpMs },
    };
}
