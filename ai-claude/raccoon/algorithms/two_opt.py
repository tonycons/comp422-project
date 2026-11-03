# =============================================================================
#  AI-GENERATED FILE  -  written by Claude (Anthropic AI), 2026-10-29,
#  at the request of George Rule. See AI_CONTRIBUTIONS.md for the full log.
#  Updated 2026-11-03 (Claude): spoiled food is worth 0 -> estimate, then confirm.
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
it (and after it) is eaten. So each move is checked in two steps:

  1. ESTIMATE in O(1).  Pretend every item that is still fresh keeps losing
     w calories per second and every spoiled item loses nothing. Under that
     straight-line model a move can be scored with running totals
     ("subsequence data", as in the minimum-latency literature):
        for the reversed stretch keep   T = its walking time,
                                        W = its total (still-fresh) spoil weight,
                                        C = its internal cost  sum(w * time since the stretch began).
        Growing the stretch by one item at the front updates all three in O(1):
            C <- C + d * W ;   T <- T + d ;   W <- W + w_new        (d = new first leg)
        estimate = (new cost of the stretch) - (old cost of the stretch)
                 + (how much later/earlier everything after it is eaten) * (weight after it)
     with the old values taken from prefix sums.
  2. CONFIRM in Theta(n).  The estimate is only exact while no item crosses its
     shelf life, so a move that looks good is re-scored with the real rules
     (spoiled food = 0 calories) and kept only if it really loses fewer calories.

Pseudocode (the [Lx] tags in the code point back to these lines)
----------
    TWO-OPT-RACCOON(items, den, L, P)        L = longest stretch to reverse, P = max passes
     1  route <- GREEDY-KD(items, den)
     2  repeat at most P times
     3      improved <- false
     4      for i <- 1 to n
     5          for j <- i+1 to min(n, i+L-1)
     6              estimate <- estimated change if route[i..j] is reversed        # O(1)
     7              if estimate < 0 and the EXACT loss after reversing is lower    # Theta(n)
     8                  reverse route[i..j];  recompute arrival times (Theta(n))
     9                  improved <- true
    10      if not improved: stop
    11  return route

Running time:  O(n log^2 n + P * (n * L + V * n))
               n log^2 n for the start (Greedy with k-d trees); per pass n * L
               estimates at O(1) each, plus Theta(n) for each of the V moves that
               looked good and were checked exactly (accepted moves included).
               L and P are constants (config.py). V grows with n (on random maps
               it is a fraction of n), so in practice this is roughly n^2 -- the
               same order as plain Greedy. 2-opt wins on route quality, not speed.
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
TIME_COMPLEXITY = "O(n log² n + P·n·L + V·n)"     # V = moves checked exactly
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
    speed = instance.speed
    den_x, den_y = instance.start
    hypot = math.hypot
    eps = 1e-9

    for _pass in range(max_passes):                                       # [L2]
        improved = False                                                  # [L3]
        a = _route_arrays(instance, route)
        i = 0
        while i < n - 1:                                                  # [L4]
            if i == 0:
                prev_x, prev_y, t_prev = den_x, den_y, 0.0
            else:
                prev_x, prev_y, t_prev = a.X[i - 1], a.Y[i - 1], a.t[i - 1]
            T, C, W = 0.0, 0.0, a.w[i]        # reversed stretch = just route[i] so far
            moved = False
            for j in range(i + 1, min(n, i + max_segment)):               # [L5]
                d = hypot(a.X[j] - a.X[j - 1], a.Y[j] - a.Y[j - 1]) / speed   # put route[j] at the front
                C += d * W
                T += d
                W += a.w[j]
                first_arrival = t_prev + hypot(a.X[j] - prev_x, a.Y[j] - prev_y) / speed
                estimate = (first_arrival * W + C) - (a.S[j + 1] - a.S[i])   # [L6] the stretch itself
                if j + 1 < n:                                                # [L6] everything after it
                    new_next = first_arrival + T + hypot(a.X[i] - a.X[j + 1], a.Y[i] - a.Y[j + 1]) / speed
                    estimate += (new_next - a.t[j + 1]) * a.Wsuf[j + 1]
                if estimate < -eps:                                       # [L7] looks good...
                    flipped = route[:i] + route[i:j + 1][::-1] + route[j + 1:]
                    new_tail = _tail_loss(instance, flipped, i, prev_x, prev_y, t_prev)
                    if new_tail < a.loss_suffix[i] - eps:                 # [L7] ...and really is
                        route = flipped                                   # [L8]
                        a = _route_arrays(instance, route)                # [L8]
                        improved = moved = True                           # [L9]
                        break
            if not moved:
                i += 1                     # after a successful move, try position i again
        if not improved:                                                  # [L10]
            break
    return route


class _RouteArrays:
    """Everything the move checks need about the current route, in route order."""
    __slots__ = ("X", "Y", "w", "t", "S", "Wsuf", "loss_suffix")


def _route_arrays(instance: Instance, route: List[int]) -> _RouteArrays:
    """Coordinates, arrival times, estimate weights and running totals. Theta(n).

    w[p]           spoil weight used by the ESTIMATE: the item's w while it is still
                   fresh at its current arrival time, 0 once it has spoiled
    S[p]           sum of w*t over the first p positions
    Wsuf[p]        total estimate weight of positions p..n-1
    loss_suffix[p] EXACT calories lost by positions p..n-1 (spoiled food = 0)
    """
    items, speed = instance.items, instance.speed
    n = len(route)
    a = _RouteArrays()
    a.X = [items[r].x for r in route]
    a.Y = [items[r].y for r in route]
    a.t = [0.0] * n
    a.w = [0.0] * n
    exact = [0.0] * n
    clock, px, py = 0.0, instance.start[0], instance.start[1]
    for p in range(n):
        item = items[route[p]]
        clock += math.hypot(a.X[p] - px, a.Y[p] - py) / speed
        a.t[p] = clock
        px, py = a.X[p], a.Y[p]
        a.w[p] = 0.0 if item.is_spoiled_at(clock) else item.food.spoil_weight
        exact[p] = item.loss_at(clock)
    a.S = [0.0] * (n + 1)
    for p in range(n):
        a.S[p + 1] = a.S[p] + a.w[p] * a.t[p]
    a.Wsuf = [0.0] * (n + 1)
    a.loss_suffix = [0.0] * (n + 1)
    for p in range(n - 1, -1, -1):
        a.Wsuf[p] = a.Wsuf[p + 1] + a.w[p]
        a.loss_suffix[p] = a.loss_suffix[p + 1] + exact[p]
    return a


def _tail_loss(instance: Instance, route: List[int], start: int,
               x: float, y: float, clock: float) -> float:
    """EXACT calories lost by route[start:], starting from (x, y) at time `clock`. Theta(n).

    Summed from the END so the result is computed in the same order as
    loss_suffix (and the TypeScript demo), keeping comparisons consistent.
    """
    items, speed = instance.items, instance.speed
    losses = []
    for r in route[start:]:
        item = items[r]
        clock += math.hypot(item.x - x, item.y - y) / speed
        x, y = item.x, item.y
        losses.append(item.loss_at(clock))
    total = 0.0
    for value in reversed(losses):
        total += value
    return total
