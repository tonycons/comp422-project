// =============================================================================
//  AI-GENERATED FILE  -  written by Claude (Anthropic AI), 2026-11-03,
//  at the request of tonycons. See ../../../AI_CONTRIBUTIONS.md for the full log.
//  Human edits: please tag changed lines with   // [EDIT: <your name>]
// =============================================================================
/**
 * CLEVER ALGORITHM: Greedy + 2-opt (adapted to the raccoon's spoilage cost)
 * Port of raccoon/algorithms/two_opt.py.
 *
 * Start with the Greedy route (built quickly with k-d trees), then keep
 * improving it with "2-opt moves": pick a stretch of the route and walk it
 * BACKWARDS. If that loses fewer calories, keep it. Stop when no move helps.
 *
 *     before:  den -> a -> [b -> c -> d] -> e ...
 *     after:   den -> a -> [d -> c -> b] -> e ...
 *
 * Reversing a stretch changes WHEN every item in it (and after it) is eaten, but
 * each candidate move is still checked in O(1) with running totals for the
 * reversed stretch:  T = walking time,  W = total spoil weight,
 * C = internal cost sum(w * time since the stretch began). Growing the stretch by
 * one item at the front:  C <- C + d*W;  T <- T + d;  W <- W + w_new.
 *
 *     TWO-OPT-RACCOON(items, den, L, P)        L = longest stretch, P = max passes
 *      1  route <- GREEDY-KD(items, den)
 *      2  repeat at most P times
 *      3      improved <- false
 *      4      for i <- 1 to n
 *      5          for j <- i+1 to min(n, i+L-1)
 *      6              delta <- change in spoilage if route[i..j] is reversed   # O(1)
 *      7              if delta < 0
 *      8                  reverse route[i..j];  recompute arrival times (Theta(n))
 *      9                  improved <- true
 *     10      if not improved: stop
 *     11  return route
 *
 * Running time: O(n log^2 n) for the start, plus per pass Theta(n*L) checks and
 * Theta(n) per accepted move. L and P are constants (config.ts).  Memory: Theta(n).
 */
import * as config from "./config";
import { greedyKdRoute } from "./kdtree";
import { evaluateRoute, spoilWeight, type Instance, type Solution } from "./problem";

export const INFO = {
  key: "two_opt" as const,
  name: "Greedy + 2-opt",
  tagline: "Greedy, then flips stretches that help",
  // M = accepted flips. The Python registry says "O(n log² n + P·n·L)", which leaves out the
  // Theta(n) recompute per flip; measured M is about 0.3n on random maps, so this is ~n² in practice.
  timeComplexity: "O(n log² n + P·n·L + M·n)",
  memoryComplexity: "Θ(n)",
};

/** One accepted 2-opt move: route positions i..j were reversed. */
export type Move = readonly [i: number, j: number];

export interface TwoOptResult {
  solution: Solution;
  startRoute: number[];  // the Greedy route it started from
  moves: Move[] | null;  // every accepted reversal, in order (for the animation)
}

export function solve(inst: Instance, recordMoves = false): TwoOptResult {
  const startRoute = greedyKdRoute(inst);                                      // [L1]
  const moves: Move[] | null = recordMoves ? [] : null;
  const route = improve(inst, startRoute, config.TWO_OPT_MAX_SEGMENT, config.LOCAL_SEARCH_MAX_PASSES,
    moves ? (i, j) => moves.push([i, j]) : undefined);
  return { solution: evaluateRoute(inst, route, "two_opt"), startRoute, moves }; // [L11]
}

/** 2-opt local search on `start` (item ids). Returns the improved route. */
export function improve(inst: Instance, start: readonly number[], maxSegment: number, maxPasses: number,
                        onMove?: (i: number, j: number) => void): number[] {
  const route = [...start];
  const n = route.length;
  if (n < 3) return route;
  const speed = inst.speed;
  const [denX, denY] = inst.start;
  const eps = 1e-9;

  for (let pass = 0; pass < maxPasses; pass++) {                              // [L2]
    let improved = false;                                                     // [L3]
    let a = routeArrays(inst, route);
    let i = 0;
    while (i < n - 1) {                                                       // [L4]
      let prevX: number, prevY: number, tPrev: number;
      if (i === 0) {
        prevX = denX; prevY = denY; tPrev = 0;
      } else {
        prevX = a.X[i - 1]; prevY = a.Y[i - 1]; tPrev = a.t[i - 1];
      }
      let T = 0, C = 0, W = a.w[i];          // reversed stretch = just route[i] so far
      let moved = false;
      const jEnd = Math.min(n, i + maxSegment);
      for (let j = i + 1; j < jEnd; j++) {                                    // [L5]
        const d = Math.hypot(a.X[j] - a.X[j - 1], a.Y[j] - a.Y[j - 1]) / speed; // put route[j] at the front
        C += d * W;
        T += d;
        W += a.w[j];
        const firstArrival = tPrev + Math.hypot(a.X[j] - prevX, a.Y[j] - prevY) / speed;
        let delta = (firstArrival * W + C) - (a.S[j + 1] - a.S[i]);           // [L6] the stretch itself
        if (j + 1 < n) {                                                      // [L6] everything after it
          const newNext = firstArrival + T + Math.hypot(a.X[i] - a.X[j + 1], a.Y[i] - a.Y[j + 1]) / speed;
          delta += (newNext - a.t[j + 1]) * a.Wsuf[j + 1];
        }
        if (delta < -eps) {                                                   // [L7]
          reverse(route, i, j);                                               // [L8]
          a = routeArrays(inst, route);                                       // [L8]
          onMove?.(i, j);
          improved = moved = true;                                            // [L9]
          break;
        }
      }
      if (!moved) i++;                    // after a successful move, try position i again
    }
    if (!improved) break;                                                     // [L10]
  }
  return route;
}

/** Reverse route[i..j] in place (inclusive). */
export function reverse<T>(route: T[], i: number, j: number): void {
  for (; i < j; i++, j--) {
    const tmp = route[i];
    route[i] = route[j];
    route[j] = tmp;
  }
}

/** Coordinates, weights, arrival times and running totals for a route. Theta(n). */
function routeArrays(inst: Instance, route: readonly number[]) {
  const n = route.length;
  const X = new Float64Array(n);
  const Y = new Float64Array(n);
  const w = new Float64Array(n);
  const t = new Float64Array(n);
  let clock = 0;
  let [px, py] = inst.start;
  for (let p = 0; p < n; p++) {
    const it = inst.items[route[p]];
    X[p] = it.x;
    Y[p] = it.y;
    w[p] = spoilWeight(it.food);
    clock += Math.hypot(X[p] - px, Y[p] - py) / inst.speed;
    t[p] = clock;
    px = X[p];
    py = Y[p];
  }
  const S = new Float64Array(n + 1);       // S[p] = sum of w*t over the first p items
  for (let p = 0; p < n; p++) S[p + 1] = S[p] + w[p] * t[p];
  const Wsuf = new Float64Array(n + 1);    // Wsuf[p] = total weight of items p..n-1
  for (let p = n - 1; p >= 0; p--) Wsuf[p] = Wsuf[p + 1] + w[p];
  return { X, Y, w, t, S, Wsuf };
}
