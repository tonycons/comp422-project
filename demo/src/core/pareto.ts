// =============================================================================
//  AI-GENERATED FILE  -  written by Claude (Anthropic AI), 2026-11-12,
//  at the request of George Rule. See ../../../ai-claude/AI_CONTRIBUTIONS.md for the full log.
//  Human edits: please tag changed lines with   // [EDIT: <your name>]
// =============================================================================
/**
 * Which (time, loss) labels a Held-Karp cell may throw away.
 * TypeScript port of ai-claude/raccoon/algorithms/pareto.py (same order of operations).
 *
 * Two partial routes that ate the same items and stand at the same place can differ in
 * both the loss so far and the current time. A label is dropped only when another
 * label is guaranteed to do at least as well from here on ("A dominates B"):
 *
 *   Rule 1 (plain Pareto): A is no later and no more expensive than B.
 *       Any way of finishing from B also works from A, reaching every remaining item
 *       no later, and losses never shrink with time.
 *   Rule 2 (a second of delay is worth at most W_live calories): A is LATER than B
 *       by d seconds, but  loss_A + d * W_live(time_B) <= loss_B.
 *       Finishing from A along B's best route reaches every remaining item exactly d
 *       seconds later. Items still fresh lose at most w * d extra; items already
 *       spoiled lose nothing extra. W_live(t) = spoil weight of the remaining items
 *       whose shelf life is longer than t.
 *
 * If no food could ever spoil, Rule 2 would always leave exactly one label per cell:
 * the textbook Held-Karp table.
 *
 * Sources: Rule 1 is the standard dominance test of labeling DPs with a time resource,
 * e.g. Y. Dumas, J. Desrosiers, E. Gelinas, M. M. Solomon, "An optimal algorithm for the
 * traveling salesman problem with time windows", Operations Research 43(2):367-371, 1995,
 * doi:10.1287/opre.43.2.367. Rule 2 is our own (derived above for this scoring rule, not
 * taken from a paper); the Python tests check it against an exhaustive search.
 */

/** Treat values this close as equal (so float-noise twins are not both kept). */
export const EPS = 1e-9;

/**
 * Keep only the labels no other label dominates.
 * Labels are given as parallel arrays (time[k], loss[k]) for k = 0 .. count-1, so the
 * Held-Karp inner loop does not allocate an object per candidate.
 * Returns the indices of the survivors, sorted by time. `wLive` enables Rule 2.
 * O(m log m + m * f) for m labels and f survivors.
 */
export function paretoFront(
    time: ArrayLike<number>,
    loss: ArrayLike<number>,
    count: number,
    wLive?: (t: number) => number,
): number[] {
    const sorted = sortByTimeThenLoss(time, loss, count);
    const kept: number[] = [];
    for (let s = 0; s < count; s++) {
        const idx = sorted[s];
        const t = time[idx];
        const c = loss[idx];
        // Rule 1: every kept label is no later than this one, and kept losses only go down,
        // so the last kept label is the cheapest one to compare against.
        if (kept.length > 0 && loss[kept[kept.length - 1]] <= c + EPS) {
            continue;
        }
        // Rule 2: this later-but-cheaper label may beat some earlier ones (drop those, keep order).
        if (wLive) {
            let w = 0;
            for (let r = 0; r < kept.length; r++) {
                const k = kept[r];
                if (c + (t - time[k]) * wLive(time[k]) > loss[k] - EPS) {
                    kept[w++] = k;
                }
            }
            kept.length = w;
        }
        kept.push(idx);
    }
    return kept;
}

let scratch = new Int32Array(256);

/**
 * Indices 0..count-1 sorted by (time, loss), ties kept in their original order
 * (a stable sort, the same order Python's sorted() gives). The lists are short,
 * so insertion sort is the fastest choice; long lists fall back to Array.sort.
 * Returns a shared scratch buffer: read it before calling again.
 */
function sortByTimeThenLoss(time: ArrayLike<number>, loss: ArrayLike<number>, count: number): Int32Array {
    if (count > scratch.length) {
        scratch = new Int32Array(2 * count);
    }
    const a = scratch;
    if (count > 64) {
        const idx = Array.from({ length: count }, (_, k) => k);
        idx.sort((x, y) => time[x] - time[y] || loss[x] - loss[y]);
        a.set(idx);
        return a;
    }
    for (let k = 0; k < count; k++) {
        const tk = time[k];
        const lk = loss[k];
        let p = k - 1;
        // shift right everything that must come AFTER label k (strictly greater keeps it stable)
        while (p >= 0 && (time[a[p]] > tk || (time[a[p]] === tk && loss[a[p]] > lk))) {
            a[p + 1] = a[p];
            p--;
        }
        a[p + 1] = k;
    }
    return a;
}

/** Build W_live(t) from [shelf life, total spoil weight of remaining items with that shelf life] pairs. */
export function liveWeightFunction(pairs: [number, number][]): (t: number) => number {
    return (t: number) => {
        let sum = 0;
        for (const [shelf, weight] of pairs) {
            if (shelf > t) {
                sum += weight;
            }
        }
        return sum;
    };
}
