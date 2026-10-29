# =============================================================================
#  AI-GENERATED FILE  -  written by Claude (Anthropic AI), 2026-10-29,
#  at the request of George Rule. See AI_CONTRIBUTIONS.md for the full log.
#  Human edits: please tag changed lines with   # [EDIT: <your name>]
# =============================================================================
"""
LOCAL SEARCH: Greedy + 2-opt (adapted to the raccoon's spoilage cost)
====================================================================

Start with the Greedy route (built quickly with k-d trees), then keep
improving it with "2-opt moves": pick a stretch of the route and walk it
BACKWARDS. If that loses fewer calories, keep it. Stop when no move helps.

    before:  den -> a -> [b -> c -> d] -> e ...
    after:   den -> a -> [d -> c -> b] -> e ...

For ordinary TSP, checking a 2-opt move is easy because only two edges change.
For the raccoon it is harder: reversing a stretch changes WHEN every item in
it (and after it) is eaten. We still check each move in O(1) time using
running totals ("subsequence data", as in the minimum-latency literature):

  For the reversed stretch we keep   T = its walking time,
                                     W = its total spoil weight,
                                     C = its internal cost  sum(w * time since the stretch began).
  Growing the stretch by one item at the front updates all three in O(1):
        C <- C + d * W ;   T <- T + d ;   W <- W + w_new        (d = new first leg)
  Then   change = (new cost of the stretch) - (old cost of the stretch)
                + (how much later/earlier everything after it is eaten) * (weight after it)
  and the old values come from prefix sums. So each candidate move is O(1).

Pseudocode (the [Lx] tags in the code point back to these lines)
----------
    TWO-OPT-RACCOON(items, den, L, P)        L = longest stretch to reverse, P = max passes
     1  route <- GREEDY-KD(items, den)
     2  repeat at most P times
     3      improved <- false
     4      for i <- 1 to n
     5          for j <- i+1 to min(n, i+L-1)
     6              delta <- change in spoilage if route[i..j] is reversed      # O(1)
     7              if delta < 0
     8                  reverse route[i..j];  recompute arrival times (Theta(n))
     9                  improved <- true
    10      if not improved: stop
    11  return route

Running time:  O(n log^2 n) for the start, plus per pass Theta(n * L) checks
               and Theta(n) per accepted move. L and P are constants (config.py),
               so in practice it grows like n log^2 n -- but with a big constant.
               (Without the caps, local search has no good worst-case bound.)
Memory:        Theta(n).

Sources (verify before citing):
  G. A. Croes, "A method for solving traveling-salesman problems",
    Operations Research 6(6):791-812, 1958.  (the 2-opt move)
  M. M. Silva, A. Subramanian, T. Vidal, L. S. Ochi, "A simple and effective
    metaheuristic for the Minimum Latency Problem", European Journal of
    Operational Research 221(3):513-520, 2012.  (local search for the
    latency objective with constant-time move evaluation)
"""
from __future__ import annotations

import math
from typing import List

from .. import config
from ..problem import Instance, Solution, evaluate_route
from . import greedy_kd

KEY = "two_opt"
NAME = "Greedy + 2-opt"
TAGLINE = "Greedy, then flips stretches that help"
TIME_COMPLEXITY = "O(n log² n + P·n·L)"
MEMORY_COMPLEXITY = "Θ(n)"
MAX_N = None
GROWTH_LABEL = "n log$^2$n"


def growth(n: float) -> float:
    lg = math.log2(max(n, 2.0))
    return n * lg * lg


def solve(instance: Instance) -> Solution:
    start = greedy_kd.solve(instance)                                     # [L1]
    route = improve(instance, start.order,
                    max_segment=config.TWO_OPT_MAX_SEGMENT,
                    max_passes=config.LOCAL_SEARCH_MAX_PASSES)
    return evaluate_route(instance, route, KEY, {"plans_ahead": True})   # [L11]


def improve(instance: Instance, route: List[int], max_segment: int, max_passes: int) -> List[int]:
    """2-opt local search on `route` (a list of item ids). Returns the improved route."""
    route = list(route)
    n = len(route)
    if n < 3:
        return route
    items, speed = instance.items, instance.speed
    den_x, den_y = instance.start
    hypot = math.hypot
    eps = 1e-9

    for _pass in range(max_passes):                                       # [L2]
        improved = False                                                  # [L3]
        X, Y, w, t, S, Wsuf = _route_arrays(instance, route)
        i = 0
        while i < n - 1:                                                  # [L4]
            if i == 0:
                prev_x, prev_y, t_prev = den_x, den_y, 0.0
            else:
                prev_x, prev_y, t_prev = X[i - 1], Y[i - 1], t[i - 1]
            T, C, W = 0.0, 0.0, w[i]          # reversed stretch = just route[i] so far
            moved = False
            for j in range(i + 1, min(n, i + max_segment)):               # [L5]
                d = hypot(X[j] - X[j - 1], Y[j] - Y[j - 1]) / speed      # put route[j] at the front
                C += d * W
                T += d
                W += w[j]
                first_arrival = t_prev + hypot(X[j] - prev_x, Y[j] - prev_y) / speed
                delta = (first_arrival * W + C) - (S[j + 1] - S[i])       # [L6] the stretch itself
                if j + 1 < n:                                             # [L6] everything after it
                    new_next = first_arrival + T + hypot(X[i] - X[j + 1], Y[i] - Y[j + 1]) / speed
                    delta += (new_next - t[j + 1]) * Wsuf[j + 1]
                if delta < -eps:                                          # [L7]
                    route[i:j + 1] = route[i:j + 1][::-1]                 # [L8]
                    X, Y, w, t, S, Wsuf = _route_arrays(instance, route)  # [L8]
                    improved = moved = True                               # [L9]
                    break
            if not moved:
                i += 1                     # after a successful move, try position i again
        if not improved:                                                  # [L10]
            break
    return route


def _route_arrays(instance: Instance, route: List[int]):
    """Coordinates, weights, arrival times and running totals for a route. Theta(n)."""
    items, speed = instance.items, instance.speed
    X = [items[r].x for r in route]
    Y = [items[r].y for r in route]
    w = [items[r].food.spoil_weight for r in route]
    n = len(route)
    t = [0.0] * n
    clock, px, py = 0.0, instance.start[0], instance.start[1]
    for p in range(n):
        clock += math.hypot(X[p] - px, Y[p] - py) / speed
        t[p] = clock
        px, py = X[p], Y[p]
    S = [0.0] * (n + 1)              # S[p] = sum of w*t over the first p items
    for p in range(n):
        S[p + 1] = S[p] + w[p] * t[p]
    Wsuf = [0.0] * (n + 1)           # Wsuf[p] = total weight of items p..n-1
    for p in range(n - 1, -1, -1):
        Wsuf[p] = Wsuf[p + 1] + w[p]
    return X, Y, w, t, S, Wsuf
